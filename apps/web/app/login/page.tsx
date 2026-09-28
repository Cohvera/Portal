"use client";
import { useEffect, useState } from "react";
const messages: Record<string, string> = {
  configuration:
    "De Microsoft-aanmelding is nog niet volledig geconfigureerd of tijdelijk niet bereikbaar. Neem contact op met de portaalbeheerder.",
  no_portal_role:
    "Je Microsoft-account heeft geen Portal.User- of Portal.Admin-rol. Vraag toegang via de juiste Entra-groep.",
  identity_link_required:
    "Er bestaat al een lokaal account met dit e-mailadres. Een beheerder moet de Entra object-ID aan dat account koppelen.",
  account_disabled:
    "Je Cohvera-account is gedeactiveerd. Neem contact op met een portaalbeheerder.",
  invalid_flow:
    "De aanmeldpoging is verlopen of kon niet worden gevalideerd. Probeer opnieuw.",
  expired:
    "Je sessie is verlopen. Meld opnieuw aan om je actuele rechten op te halen.",
};
export default function LoginPage() {
  const [config, setConfig] = useState<{
      mode: string;
      configured: boolean;
    } | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("error");
    if (code) setMessage(messages[code] || "Aanmelden is niet gelukt.");
    fetch("/api/auth/config", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setConfig)
      .catch(() =>
        setMessage("De aanmeldservice is tijdelijk niet bereikbaar."),
      );
  }, []);
  return (
    <main className="login-page">
      <section className="login-card">
        <span className="eyebrow">COHVERA · DIGITAL HUB</span>
        <h1>
          Jouw werkplek.
          <br />
          Eén Microsoft-login.
        </h1>
        <p>
          Meld je aan met je zakelijke Cohvera-account. Je ziet alleen de
          bedrijven en onderdelen waarvoor je toegang hebt.
        </p>
        {message && (
          <div className="alert" role="alert">
            {message}
          </div>
        )}
        {!config ? (
          <p role="status">Aanmelding controleren…</p>
        ) : config.mode === "development" ? (
          <>
            <div className="inspection-info">
              Deze omgeving gebruikt nog de expliciete ontwikkelmodus.
              Microsoft-login is hier niet actief.
            </div>
            <a className="button-primary" href="/">
              Open ontwikkelomgeving
            </a>
          </>
        ) : config.configured ? (
          <a className="button-primary" href="/auth/login">
            Aanmelden met Microsoft →
          </a>
        ) : (
          <div className="alert">
            Microsoft Entra is nog niet volledig ingesteld voor deze omgeving.
          </div>
        )}
        <small>
          Microsoft verzorgt je wachtwoord, MFA en de toegangsvoorwaarden.
          Cohvera bewaart geen Microsoft-wachtwoorden.
        </small>
      </section>
    </main>
  );
}
