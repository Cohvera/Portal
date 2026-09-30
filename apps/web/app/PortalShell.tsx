"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { coefHubs } from "../lib/coef";
type Company = { id: string; code: string; name: string };
type Identity = {
  userId: string;
  displayName: string;
  email: string;
  roles: string[];
  mode: "development" | "entra";
  companies: Company[];
  canManageCatalog: boolean;
  businessAccess: {
    companyCode: string;
    permissions: string[];
    businessAdmin: boolean;
  }[];
};
const CompanyContext = createContext({
  displayName: "",
  companies: [] as Company[],
  companyCode: "",
  canManageCatalog: false,
  can: (_permission: string): boolean => false,
});
export const useCompany = () => useContext(CompanyContext);
export default function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    isLogin = pathname === "/login";
  const [identity, setIdentity] = useState<Identity | null>(null),
    [error, setError] = useState(""),
    [companyCode, setCompanyCode] = useState(""),
    [open, setOpen] = useState(false);
  useEffect(() => {
    if (isLogin) return;
    let active = true;
    async function refresh() {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (r.status === 401) {
          window.location.replace("/login");
          return;
        }
        if (!r.ok)
          throw new Error(
            "Je sessie kon niet worden gecontroleerd. Probeer opnieuw.",
          );
        const next = (await r.json()) as Identity;
        if (!active) return;
        setIdentity(next);
        setError("");
        setCompanyCode((current) =>
          next.companies.some((c) => c.code === current)
            ? current
            : next.companies.find(
                (c) => c.code === localStorage.getItem("cohvera.companyCode"),
              )?.code ||
              next.companies[0]?.code ||
              "",
        );
      } catch (e) {
        if (active) {
          setIdentity(null);
          setError((e as Error).message);
        }
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 60000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    const originalFetch = window.fetch;
    const wrappedFetch: typeof fetch = async (...args) => {
      const response = await originalFetch(...args);
      const target = args[0] instanceof Request ? args[0].url : String(args[0]);
      const u = new URL(target, window.location.href);
      if (
        response.status === 401 &&
        u.origin === location.origin &&
        u.pathname.startsWith("/api/")
      )
        window.location.replace("/login?error=expired");
      return response;
    };
    window.fetch = wrappedFetch;
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
    };
  }, [isLogin]);
  useEffect(() => setOpen(false), [pathname]);
  if (isLogin) return <>{children}</>;
  if (!identity)
    return (
      <main className="main">
        <h1>Cohvera</h1>
        {error ? (
          <div role="alert" className="alert">
            {error}
            <button
              className="secondary-button"
              onClick={() => location.reload()}
            >
              Opnieuw proberen
            </button>
          </div>
        ) : (
          <p role="status">Sessie controleren…</p>
        )}
      </main>
    );
  const access = identity.businessAccess.find(
    (a) => a.companyCode === companyCode,
  );
  const can = (permission: string) =>
    !!access &&
    (access.businessAdmin || access.permissions.includes(permission));
  const links = [
    { href: "/", name: "Overzicht" },
    ...(can("projects.read") ? [{ href: "/projects", name: "Projecten" }] : []),
    ...(can("tasks.read") ? [{ href: "/tasks", name: "Mijn taken" }] : []),
    ...coefHubs.map((h) => ({ href: `/hubs/${h.slug}`, name: h.name })),
    { href: "/tools", name: "Tools & Solutions" },
    ...(can("notifications.read")
      ? [{ href: "/#notifications", name: "Notificaties" }]
      : []),
    ...(can("audit.read") ? [{ href: "/#audit", name: "Audit" }] : []),
    ...(identity.canManageCatalog
      ? [
          { href: "/admin/accounts", name: "Accounts" },
          { href: "/admin/plugins", name: "Plugin Manager" },
        ]
      : []),
  ];
  const required = pathname.startsWith("/tools/inspections")
    ? "inspections.read"
    : pathname.startsWith("/projects")
      ? "projects.read"
      : pathname.startsWith("/tasks")
        ? "tasks.read"
        : null;
  const denied = pathname.startsWith("/admin/")
    ? !identity.canManageCatalog
    : required
      ? !can(required)
      : false;
  const noCompany = !companyCode && !pathname.startsWith("/admin/");
  return (
    <CompanyContext.Provider
      value={{
        displayName: identity.displayName,
        companies: identity.companies,
        companyCode,
        canManageCatalog: identity.canManageCatalog,
        can,
      }}
    >
      <div className="shell">
        <button
          className="mobile-menu"
          aria-expanded={open}
          aria-controls="portal-sidebar"
          onClick={() => setOpen(!open)}
        >
          ☰ Menu
        </button>
        <aside
          id="portal-sidebar"
          className={`sidebar ${open ? "is-open" : ""}`}
        >
          <Link href="/" className="brand">
            COHVERA
            <br />
            <small>DIGITAL HUB</small>
          </Link>
          <label className="muted" htmlFor="company">
            Actief bedrijf
          </label>
          <select
            id="company"
            className="company-select"
            value={companyCode}
            disabled={!identity.companies.length}
            onChange={(e) => {
              setCompanyCode(e.target.value);
              localStorage.setItem("cohvera.companyCode", e.target.value);
              void fetch(
                `/api/companies/${encodeURIComponent(e.target.value)}/select`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                },
              );
            }}
          >
            {identity.companies.length ? (
              identity.companies.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name}
                </option>
              ))
            ) : (
              <option value="">Nog geen bedrijf toegewezen</option>
            )}
          </select>
          <nav className="nav" aria-label="Hoofdnavigatie">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={
                  (
                    l.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(l.href)
                  )
                    ? "page"
                    : undefined
                }
              >
                {l.name}
              </Link>
            ))}
          </nav>
          <div className="sidebar-profile">
            <strong>{identity.displayName}</strong>
            <small>
              {identity.mode === "development"
                ? "Ontwikkelomgeving"
                : identity.roles.includes("Portal.Admin")
                  ? "Portaalbeheerder"
                  : "Microsoft-account"}
            </small>
            {identity.mode === "entra" && (
              <form action="/auth/logout" method="post">
                <button className="secondary-button">Afmelden</button>
              </form>
            )}
          </div>
        </aside>
        <div className="portal-content">
          {denied ? (
            <main className="main">
              <h1>Geen toegang</h1>
              <p>Je rol geeft geen toegang tot dit onderdeel.</p>
              <Link href="/">Terug naar overzicht</Link>
            </main>
          ) : noCompany ? (
            <main className="main">
              <h1>Welkom, {identity.displayName}</h1>
              <p>
                Je bent aangemeld. Er is nog geen bedrijfstoegang aan je account
                toegewezen.
              </p>
              <p>Neem contact op met de beheerder van jullie Microsoft Entra-omgeving. Accountbeheer gebeurt buiten dit portaal.</p>
            </main>
          ) : (
            <div key={`${identity.userId}:${companyCode}`}>{children}</div>
          )}
        </div>
      </div>
    </CompanyContext.Provider>
  );
}
