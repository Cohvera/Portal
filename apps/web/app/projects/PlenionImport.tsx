"use client";
import { useState } from "react";
import { request } from "../../lib/projects";

export function PlenionImport({companyCode, onImported}: {companyCode:string; onImported:()=>Promise<void>}) {
  const [payload, setPayload] = useState<unknown>(null);
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <details className="card">
    <summary>Projecten uit Plenion importeren</summary>
    <p>Doelbedrijf: <strong>Warco</strong>. Cohvera selecteert statuscode 07.
      Historische versies worden overgeslagen. Ontbrekende projecten worden niet verwijderd.</p>
    <label>JSON-bestand van de reader
      <input type="file" accept=".json,application/json" disabled={busy} onChange={async event => {
        const file = event.target.files?.[0];
        setPayload(null); setFilename(""); setMessage("");
        if (!file) return;
        try {
          if (file.size > 5 * 1024 * 1024) throw new Error("Het bestand mag maximaal 5 MB zijn.");
          const data: unknown = JSON.parse(await file.text());
          if (!data || typeof data !== "object" || !("source" in data) || data.source !== "plenion_reader_projects")
            throw new Error("Kies portal-projects.json, gemaakt met de opdracht portal van de reader.");
          setPayload(data); setFilename(file.name);
        } catch (error) { setMessage(error instanceof Error ? error.message : "Bestand niet leesbaar."); }
      }} />
    </label>
    {filename && <p>{filename} staat klaar. Controleer dat dit bestand afkomstig is van de Plenion-database van Warco.</p>}
    <button className="button-primary" disabled={busy || !payload} onClick={async () => {
      setBusy(true); setMessage("");
      try {
        const result = await request<{count:number; skipped:number; duplicate:boolean}>(
          `/api/companies/${encodeURIComponent(companyCode)}/projects/import/plenion`,
          {method:"POST", body:JSON.stringify(payload)});
        setMessage(`${result.count} projecten ${result.duplicate ? "waren al geïmporteerd" : "geïmporteerd"}. ${result.skipped} records buiten de selectie of historische versies overgeslagen.`);
        setPayload(null);
        try { await onImported(); } catch { setMessage("Import gelukt. Vernieuw de pagina om het overzicht bij te werken."); }
      } catch(error) { setMessage(error instanceof Error ? error.message : "Import mislukt."); }
      finally { setBusy(false); }
    }}>{busy ? "Importeren…" : "Importeren bij Warco"}</button>
    {message && <p role="status">{message}</p>}
  </details>;
}
