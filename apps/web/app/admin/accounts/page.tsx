"use client";
import { useEffect, useState } from "react";
import { request } from "../../../lib/projects";
type Mapping = {
  groupId?: string;
  groupName?: string;
  name: string;
  companyCode: string;
  roleKey: string;
};
type Account = {
  id: string;
  displayName: string;
  email: string;
  isActive: boolean;
  entraObjectId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  portalRoles: string[];
  groups: Mapping[];
  receivedGroups: string[] | null;
  groupsSynced: boolean;
  groupsClaimPresent: boolean;
  memberships: {
    company: { name: string; code: string };
    role: { name: string };
  }[];
};
type Overview = {
  users: Account[];
  mappings: Mapping[];
  configurationError: boolean;
};
export default function AccountsPage() {
  const [data, setData] = useState<Overview | null>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [company, setCompany] = useState("");
  async function refresh() {
    try {
      setData(await request<Overview>("/api/admin/accounts"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt.");
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const users =
    data?.users.filter(
      (u) =>
        `${u.displayName} ${u.email}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!company || u.memberships.some((m) => m.company.code === company)),
    ) || [];
  const companies = [
    ...new Map(
      data?.users.flatMap((u) =>
        u.memberships.map((m) => [m.company.code, m.company.name] as const),
      ) || [],
    ).entries(),
  ];
  return (
    <main className="main accounts-page">
      <header className="section-heading">
        <div>
          <p className="eyebrow">Microsoft Entra · Alleen bekijken</p>
          <h1>Accounts</h1>
          <p className="muted">
            Gebruikers, groepen en bedrijfstoegang op één plek.
          </p>
        </div>
        <button className="secondary-button" onClick={() => void refresh()}>
          Vernieuwen
        </button>
      </header>
      <aside className="accounts-development">
        <strong>Beheer gebeurt in Microsoft Entra</strong>
        <p>
          Dit overzicht toont accounts die bij het portaal bekend zijn, geen
          volledige Microsoft-gebruikerslijst. Groepen en portaalrollen tonen de
          laatst gesynchroniseerde aanmelding. Wijzigingen worden bij een nieuwe
          aanmelding opgehaald.
        </p>
        <a href="https://entra.microsoft.com" target="_blank" rel="noreferrer">
          Open Microsoft Entra ↗
        </a>
      </aside>
      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}
      {!data && !error && <p role="status">Accounts laden…</p>}
      {data && (
        <>
          {(data.configurationError || !data.mappings.length) && (
            <div className="alert">
              De groepskoppelingen zijn nog niet correct ingesteld. Er wordt bij
              een nieuwe aanmelding geen bedrijfstoegang toegekend zonder een
              passende koppeling.
            </div>
          )}
          <section className="cards account-stats">
            <article className="card">
              <span>Bekende accounts</span>
              <strong>{data.users.length}</strong>
            </article>
            <article className="card">
              <span>Met bedrijfstoegang</span>
              <strong>
                {data.users.filter((u) => u.memberships.length).length}
              </strong>
            </article>
            <article className="card">
              <span>Groepskoppelingen</span>
              <strong>{data.mappings.length}</strong>
            </article>
          </section>
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
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              >
                <option value="">Alle bedrijven</option>
                {companies.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="account-list">
            {users.map((u) => (
              <article className="card" key={u.id}>
                <header className="section-heading">
                  <div>
                    <h2>{u.displayName}</h2>
                    <p className="muted">{u.email}</p>
                  </div>
                  <span className="availability">
                    {u.isActive ? "Lokaal actief" : "Lokaal geblokkeerd"}
                  </span>
                </header>
                <p>
                  <strong>Portaalrol:</strong>{" "}
                  {u.portalRoles.join(", ") ||
                    "Nog geen aanmelding geregistreerd"}
                </p>
                <div className="account-access">
                  {u.memberships.map((m) => (
                    <span className="account-membership" key={m.company.code}>
                      <strong>{m.company.name}</strong>
                      <span>{m.role.name}</span>
                    </span>
                  ))}
                  {!u.memberships.length && (
                    <span className="muted">Geen bedrijfstoegang</span>
                  )}
                </div>
                <p>
                  <strong>Laatste aanmelding:</strong>{" "}
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString("nl-BE")
                    : "Nog niet aangemeld"}
                </p>
                {!u.groupsSynced && (
                  <p className="muted">
                    Bedrijfstoegang nog niet via Entra-groepen gesynchroniseerd.
                  </p>
                )}
                {u.groupsSynced && !u.groupsClaimPresent && (
                  <p className="muted">
                    Microsoft stuurde bij de laatste aanmelding geen
                    groepsclaim.
                  </p>
                )}
                <details>
                  <summary>Groepen en accountgegevens</summary>
                  <p>
                    Microsoft object-ID: {u.entraObjectId || "Niet gekoppeld"}
                  </p>
                  <p>
                    Geregistreerd:{" "}
                    {new Date(u.createdAt).toLocaleDateString("nl-BE")}
                  </p>
                  <p><strong>Door Microsoft meegestuurde groepen:</strong></p>
                  {u.receivedGroups == null ? <p className="muted">Nog niet geregistreerd. Meld opnieuw aan nadat deze versie is uitgerold.</p> : u.receivedGroups.length ? <ul>{u.receivedGroups.map(g => <li key={g}>{g}</li>)}</ul> : <p>Geen groepen ontvangen.</p>}
                  <p><strong>Herkende bedrijfskoppelingen:</strong></p>
                  {u.groups.map((g, i) => (
                    <p key={i}>
                      <strong>{g.name}</strong> → {g.companyCode} · {g.roleKey}
                      <br />
                      <small>{g.groupId || "Koppeling op groepsnaam"}</small>
                    </p>
                  ))}
                  {!u.groups.length && (
                    <p>
                      Geen gekoppelde bedrijfsgroepen bij de laatste aanmelding.
                    </p>
                  )}
                </details>
              </article>
            ))}
          </div>
          {!users.length && (
            <div className="empty-state">Geen accounts gevonden.</div>
          )}
          <section className="card" style={{ marginTop: 24 }}>
            <h2>Groepen → bedrijven</h2>
            <p className="muted">
              De ingestelde koppelingen. Groepslidmaatschap beheer je in Entra.
            </p>
            {data.mappings.map((m, i) => (
              <p key={i}>
                <strong>{m.name}</strong> → {m.companyCode} · {m.roleKey}
              </p>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
