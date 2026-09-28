"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { request } from "../../../lib/projects";
import { useCompany } from "../../PortalShell";

type Company = { id: string; code: string; name: string };
type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: { permission: { key: string; description: string | null } }[];
};
type Account = {
  entraObjectId?: string | null;
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  memberships: { company: Company; role: Role }[];
};
type Overview = {
  entraConfigured:boolean;
  authMode: "development" | "entra";
  actorId: string;
  users: Account[];
  roles: Role[];
  companies: Company[];
};
const permissionNames: Record<string, string> = {
  "portal.admin": "Volledig platformbeheer",
  "companies.read": "Bedrijven bekijken",
  "companies.switch": "Bedrijf wisselen",
  "users.read": "Accounts bekijken",
  "users.manage": "Accounts beheren",
  "projects.read": "Projecten bekijken",
  "projects.manage": "Projecten beheren",
  "tasks.read": "Taken bekijken",
  "tasks.manage": "Taken beheren",
  "plugins.read": "Tools bekijken",
  "plugins.manage": "Plugins beheren",
  "notifications.read": "Notificaties bekijken",
  "audit.read": "Activiteit bekijken",
  "inspections.read": "Keuringen bekijken",
  "inspections.write": "Keuringen beheren",
  "solar.read": "Solar bekijken",
  "solar.write": "Solar beheren",
  "charging-workorders.read": "Werkbonnen bekijken",
  "charging-workorders.write": "Werkbonnen beheren",
  "ventilation.read": "Ventilatie bekijken",
};

export default function AccountsPage() {
  const { companyCode } = useCompany();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("accounts");
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<Account | null>(null);
  const [access, setAccess] = useState<Record<string, string>>({});
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  async function refresh() {
    const result = await request<Overview>("/api/admin/accounts");
    setData(result);
    setError("");
  }
  useEffect(() => {
    void refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  function open(account: Account | null = null) {
    setEditing(account);
    setVersion((v) => v + 1);
    setActive(account?.isActive ?? true);
    setFormError("");
    const company = data?.companies.find((c) => c.code === companyCode);
    const role = data?.roles.find((r) => r.key === "viewer");
    setAccess(
      account
        ? Object.fromEntries(
            account.memberships.map((m) => [m.company.id, m.role.id]),
          )
        : company && role
          ? { [company.id]: role.id }
          : {},
    );
    dialog.current?.showModal();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") || "").trim();
    if (!displayName) {
      setFormError("Vul een naam in.");
      return;
    }
    const memberships = Object.entries(access)
      .filter(([, roleId]) => !!roleId)
      .map(([companyId, roleId]) => ({ companyId, roleId }));
    if (data?.authMode === "development" && active && !memberships.length) {
      setFormError("Kies minstens één bedrijf voor een actief account.");
      return;
    }
    setBusy(true);
    setFormError("");
    setMessage("");
    try {
      await request(`/api/admin/accounts${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          displayName,
          email: form.get("email"),
          isActive: active,
          memberships,
          entraObjectId: form.get("entraObjectId") || undefined,
        }),
      });
      dialog.current?.close();
      setMessage(
        editing
          ? "Account en bedrijfstoegang bijgewerkt."
          : "Account aangemaakt. Er is geen uitnodigingsmail verzonden.",
      );
      try {
        await refresh();
      } catch {
        setError(
          "Opgeslagen, maar het overzicht kon niet worden vernieuwd. Herlaad de pagina.",
        );
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }
  const visible =
    data?.users.filter(
      (u) =>
        `${u.displayName} ${u.email}`
          .toLocaleLowerCase("nl")
          .includes(query.trim().toLocaleLowerCase("nl")) &&
        (companyFilter === "all" ||
          u.memberships.some((m) => m.company.id === companyFilter)) &&
        (statusFilter === "all" || u.isActive === (statusFilter === "active")),
    ) || [];
  return (
    <main className="main accounts-page">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Beheer · Alle bedrijven</p>
          <h1>Accounts & rechten</h1>
          <p className="muted">
            Wie werkt mee, bij welk bedrijf en met welke rol?
          </p>
        </div>
        <button
          className="button-primary"
          disabled={!data || busy}
          onClick={() => open()}
        >
          + Account toevoegen
        </button>
      </header>
      <aside className="accounts-development">
        <strong>
          {data?.authMode === "entra"
            ? "Microsoft Entra + bedrijfsrechten"
            : "Ontwikkelomgeving"}
        </strong>
        <p>
          {data?.authMode === "entra"
            ? "Aanmelden en portaalbeheer worden via de Entra-groepen SG-PORTAL-Users en SG-PORTAL-Admins toegekend. Hier beheer je alleen de bedrijfstoegang en werkzaamheden. Nieuwe Microsoft-gebruikers krijgen niet automatisch toegang tot bedrijfsgegevens."
            : "Deze omgeving werkt met een expliciete ontwikkelidentiteit. Microsoft-aanmelding wordt actief met AUTH_MODE=entra en de juiste configuratie."}
        </p>
      </aside>
      {message && (
        <div role="status" className="success-box">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="alert">
          {error}{" "}
          <button
            className="secondary-button"
            onClick={() => {
              setLoading(true);
              void refresh()
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
          >
            Opnieuw laden
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">Accounts laden…</p>
      ) : (
        data && (
          <>
            <section className="cards account-stats">
              <article className="card">
                <span>Accounts</span>
                <strong>{data.users.length}</strong>
              </article>
              <article className="card">
                <span>Actief</span>
                <strong>{data.users.filter((u) => u.isActive).length}</strong>
              </article>
              <article className="card">
                <span>Gedeactiveerd</span>
                <strong>{data.users.filter((u) => !u.isActive).length}</strong>
              </article>
              <article className="card">
                <span>Rollen</span>
                <strong>{data.roles.length}</strong>
              </article>
            </section>
            <div
              className="catalog-filters account-tabs"
              aria-label="Beheeronderdelen"
            >
              <button
                aria-pressed={tab === "accounts"}
                onClick={() => setTab("accounts")}
              >
                Accounts
              </button>
              <button
                aria-pressed={tab === "roles"}
                onClick={() => setTab("roles")}
              >
                Rollen & rechten
              </button>
            </div>
            {tab === "accounts" ? (
              <>
                <div className="task-toolbar">
                  <label>
                    Zoeken
                    <input
                      type="search"
                      placeholder="Naam of e-mailadres…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label>
                    Bedrijf
                    <select
                      value={companyFilter}
                      onChange={(e) => setCompanyFilter(e.target.value)}
                    >
                      <option value="all">Alle bedrijven</option>
                      {data.companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Accountstatus
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Alle statussen</option>
                      <option value="active">Actief</option>
                      <option value="inactive">Gedeactiveerd</option>
                    </select>
                  </label>
                </div>
                <div className="account-list">
                  {visible.map((u) => (
                    <article className="card account-row" key={u.id}>
                      <div className="account-identity">
                        <span className="account-avatar" aria-hidden="true">
                          {u.displayName.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <h2>{u.displayName}</h2>
                          <p>{u.email}</p>
                        </div>
                      </div>
                      <div className="account-access">
                        {u.memberships.map((m) => (
                          <span
                            className="account-membership"
                            key={m.company.id}
                          >
                            <strong>{m.company.name}</strong>
                            <span>{m.role.name}</span>
                          </span>
                        ))}
                        {!u.memberships.length && (
                          <span className="muted">Geen bedrijfstoegang</span>
                        )}
                      </div>
                      <div className="account-controls">
                        <span
                          className={`availability ${u.isActive ? "availability-available" : "availability-planned"}`}
                        >
                          {u.isActive ? "Actief" : "Gedeactiveerd"}
                        </span>
                        {u.id === data.actorId &&
                        data.authMode === "development" ? (
                          <span className="muted">Huidig beheeraccount</span>
                        ) : (
                          <button
                            className="secondary-button"
                            onClick={() => open(u)}
                            aria-label={`${u.displayName} bewerken`}
                          >
                            Bewerken
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                {!visible.length && (
                  <div className="empty-state">
                    Geen accounts gevonden voor deze filters.
                  </div>
                )}
              </>
            ) : (
              <section className="account-roles">
                <div className="catalog-note">
                  <strong>Een rol per bedrijf</strong>
                  <p>
                    Een gebruiker kan bijvoorbeeld Manager zijn bij Cohvera en
                    Lezer bij Q-Home. Deze bedrijfsrollen worden door de API
                    afgedwongen; ze geven geen Entra-portaalbeheer.
                  </p>
                </div>
                <div className="project-grid">
                  {data.roles.map((role) => (
                    <article className="card role-card" key={role.id}>
                      <p className="eyebrow">
                        {role.key === "portal-admin" ? "Beheer" : "Bedrijfsrol"}
                      </p>
                      <h2>{role.name}</h2>
                      <p className="muted">
                        {role.description ||
                          (role.key === "portal-admin"
                            ? "Beheert accounts, bedrijfstoegang en het platform."
                            : "Standaardrol")}
                      </p>
                      <details>
                        <summary>
                          {role.permissions.length} rechten bekijken
                        </summary>
                        <ul>
                          {role.permissions.map((p) => (
                            <li key={p.permission.key}>
                              {permissionNames[p.permission.key] ||
                                p.permission.description ||
                                p.permission.key}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )
      )}
      <dialog
        ref={dialog}
        className="catalog-dialog account-dialog"
        aria-labelledby="account-dialog-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form key={version} className="task-form" onSubmit={save}>
          <header className="section-heading">
            <div>
              <p className="eyebrow">Accountbeheer</p>
              <h2 id="account-dialog-title">
                {editing ? "Account bewerken" : "Account toevoegen"}
              </h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              aria-label="Sluiten"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <fieldset disabled={busy}>
            <label>
              Naam
              <input
                name="displayName"
                required
                maxLength={100}
                defaultValue={editing?.displayName || ""}
              />
            </label>
            <label>
              E-mailadres
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={editing?.email || ""}
              />
            </label>
            {(data?.authMode === "entra" || data?.entraConfigured) && (
              <label>
                Entra object-ID (optioneel, voor bestaand account)
                <input
                  name="entraObjectId"
                  maxLength={36}
                  readOnly={!!editing?.entraObjectId}
                  defaultValue={editing?.entraObjectId || ""}
                  placeholder="Object-ID van de gebruiker uit Entra"
                />
                <small>
                  Nieuwe gebruikers verschijnen na hun eerste aanmelding. Koppel
                  bestaande accounts uitsluitend via de object-ID, niet via
                  e-mailadres.
                </small>
              </label>
            )}
            <label>
              Status
              <select
                value={active ? "active" : "inactive"}
                onChange={(e) => setActive(e.target.value === "active")}
              >
                <option value="active">Actief</option>
                <option value="inactive">Gedeactiveerd</option>
              </select>
            </label>
            {!active && (
              <p className="muted">
                Het account blijft bewaard. Bedrijfstoegang kan worden
                voorbereid, maar het account staat als inactief geregistreerd.
              </p>
            )}
            <h3>Bedrijfstoegang</h3>
            <p className="muted">
              Kies per bedrijf een rol of laat de toegang uitgeschakeld.
            </p>
            {data?.companies.map((c) => (
              <label className="membership-field" key={c.id}>
                {c.name}
                <select
                  aria-label={`Rol bij ${c.name}`}
                  value={access[c.id] || ""}
                  onChange={(e) =>
                    setAccess({ ...access, [c.id]: e.target.value })
                  }
                >
                  <option value="">Geen toegang</option>
                  {data.roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          {formError && (
            <div role="alert" className="alert">
              {formError}
            </div>
          )}
          <footer className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Annuleren
            </button>
            <button className="button-primary" disabled={busy}>
              {busy ? "Opslaan…" : "Account opslaan"}
            </button>
          </footer>
        </form>
      </dialog>
    </main>
  );
}
