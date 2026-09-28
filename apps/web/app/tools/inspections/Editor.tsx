"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  addMonths,
  completionIssues,
  documentCategories,
  inspectionStatuses,
  inspectionTypes,
  newInspection,
  nextCycleAvailable,
  validateInspection,
  type InspectionData,
  type InspectionRecord,
} from "@cohvera/contracts";
import { dateLabel, inspectionRequest, today } from "./api";
import Confirm from "./Confirm";

type Props = {
  writable:boolean;
  record: InspectionRecord | null;
  url: string;
  nextId: string | null;
  onOpen: (id: string) => void;
  onSaved: (record: InspectionRecord) => void;
  onClose: () => void;
};
const tabs = [
  "Dossier",
  "Voorbereiding",
  "Opvolging",
  "Documenten",
  "Historiek",
];
export default function Editor({
  writable,
  record,
  url,
  nextId,
  onOpen,
  onSaved,
  onClose,
}: Props) {
  const [data, setData] = useState<InspectionData>(
    () => record?.data || newInspection(),
  );
  useEffect(() => {
    setData(record?.data || newInspection());
    setError("");
  }, [record]);
  const [tab, setTab] = useState("Dossier"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    reason?: boolean;
    run: (reason: string) => void;
  } | null>(null);
  const dirty =
    JSON.stringify(data) !== JSON.stringify(record?.data || newInspection());
  const issues = completionIssues(data, record?.documents || [], today());
  function openCycle(id: string) {
    if (dirty)
      setConfirm({
        title: "Wijzigingen verlaten?",
        description: "De niet-opgeslagen wijzigingen gaan verloren.",
        run: () => onOpen(id),
      });
    else onOpen(id);
  }
  const set = <K extends keyof InspectionData>(
    key: K,
    value: InspectionData[K],
  ) => setData((d) => ({ ...d, [key]: value }));
  async function perform(work: () => Promise<InspectionRecord>) {
    setBusy(true);
    setError("");
    try {
      onSaved(await work());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (dirty)
      setConfirm({
        title: "Wijzigingen verlaten?",
        description: "De niet-opgeslagen wijzigingen gaan verloren.",
        run: onClose,
      });
    else onClose();
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    try {
      validateInspection(data);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (issues.length) {
      setError(issues.join(" "));
      return;
    }
    const run = (reason: string) =>
      perform(() =>
        inspectionRequest(
          record ? `${url}/${record.id}` : url,
          record ? "PATCH" : "POST",
          { data, version: record?.version, reason },
        ),
      );
    if (
      record &&
      (["ARCHIVED", "OUT_OF_SERVICE"].includes(data.status) ||
        ["CONFORM", "REINSPECTION", "ARCHIVED", "OUT_OF_SERVICE"].includes(
          record.data.status,
        ))
    )
      setConfirm({
        title: "Dossier wijzigen",
        description:
          "Leg vast waarom je deze status of vastgelegde keuringsgegevens wijzigt.",
        reason: true,
        run,
      });
    else void run("");
  }
  async function upload(file: File, category: string) {
    if (file.size > 4 * 1024 * 1024) {
      setError("Maximaal 4 MB per document.");
      return;
    }
    if (!record || dirty) return;
    await perform(async () => {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () =>
          reject(new Error("Bestand kon niet worden gelezen."));
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(file);
      });
      return inspectionRequest(`${url}/${record.id}/documents`, "POST", {
        version: record.version,
        name: file.name,
        category,
        content,
      });
    });
  }
  const [category, setCategory] = useState("Keuringsrapport");
  function text(
    key: keyof InspectionData,
    label: string,
    type = "text",
    required = false,
  ) {
    return (
      <label key={key}>
        {label}
        <input
          type={type}
          required={required}
          maxLength={key === "projectFolder" ? 1000 : 300}
          value={String(data[key])}
          onChange={(e) => set(key, e.target.value as never)}
        />
      </label>
    );
  }
  return (
    <section className="inspection-editor">
      <div className="inspection-topline no-print">
        <button className="secondary-button" disabled={busy} onClick={close}>
          ← Overzicht
        </button>
        <span>
          {record ? `Dossier · versie ${record.version}` : "Nieuw dossier"}
          {dirty ? " · niet opgeslagen" : ""}
        </span>
        {record && (
          <button
            className="secondary-button"
            disabled={busy || dirty}
            onClick={() => window.print()}
          >
            Afdrukken / PDF
          </button>
        )}
      </div>
      <header className="section-heading">
        <div>
          <p className="eyebrow">Keuringsdossier</p>
          <h2>{data.title || "Nieuwe keuring"}</h2>
          <p className="muted">
            {data.customer || "Vul de klant en installatie in"}
            {data.address ? ` · ${data.address}` : ""}
          </p>
        </div>
        <span className={`inspection-status s-${data.status}`}>
          {inspectionStatuses[data.status]}
        </span>
      </header>
      {record?.previousId && (
        <p className="muted">
          Dit is een vervolgdossier.{" "}
          <button
            type="button"
            className="secondary-button no-print"
            disabled={busy}
            onClick={() => openCycle(record.previousId!)}
          >
            Vorige cyclus bekijken
          </button>
        </p>
      )}
      <nav className="inspection-tabs no-print" aria-label="Dossieronderdelen">
        {tabs.map((t) => (
          <button
            type="button"
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Opvolging"
              ? ` (${data.followUps.filter((f) => !f.done).length})`
              : t === "Documenten"
                ? ` (${record?.documents.length || 0})`
                : ""}
          </button>
        ))}
      </nav>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={save} noValidate>
        <fieldset disabled={busy||!writable} className="inspection-fields">
          <div
            className={`inspection-panel ${tab !== "Dossier" ? "inspection-hidden" : ""}`}
          >
            <div className="form-grid">
              {text("title", "Titel", "text", true)}
              {text("customer", "Klant", "text", true)}
              {text("address", "Adres van de installatie", "text", true)}
              {text("owner", "Verantwoordelijke")}
              {text("contactEmail", "E-mail klant", "email")}
              {text("phone", "Telefoon", "tel")}
              <label>
                Type keuring
                <select
                  value={data.type}
                  onChange={(e) => set("type", e.target.value)}
                >
                  {inspectionTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={data.status}
                  disabled={!record}
                  onChange={(e) =>
                    set("status", e.target.value as InspectionData["status"])
                  }
                >
                  {Object.entries(inspectionStatuses).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {text("ean", "EAN / referentie installatie")}
              {text("projectFolder", "Projectmap / dossierverwijzing")}
            </div>
            <label>
              Notities
              <textarea
                rows={4}
                maxLength={10000}
                value={data.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </label>
          </div>
          <div
            className={`inspection-panel ${tab !== "Voorbereiding" ? "inspection-hidden" : ""}`}
          >
            <h3>Gereed voor de keurder</h3>
            <p className="muted">
              Deze controles moeten klaar zijn voordat je het dossier inplant.
            </p>
            <div className="inspection-checks">
              {Object.entries({
                access: "Toegang tot de installatie geregeld",
                installation: "Installatie en dossier gecontroleerd",
                diagrams: "Benodigde schema’s en plannen beschikbaar",
              }).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={data.checklist[key as keyof typeof data.checklist]}
                    onChange={(e) =>
                      set("checklist", {
                        ...data.checklist,
                        [key]: e.target.checked,
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="form-grid">
              {text("inspector", "Keurder / keuringsorganisme")}
              {text("plannedDate", "Geplande datum", "date")}
              {text("plannedTime", "Tijdstip", "time")}
              {text("round", "Ronde / planningsgroep")}
              {text("grounding", "Aardingsweerstand (Ω)")}
            </div>
            <p className="muted">
              Groepeer dossiers met dezelfde rondenaam en datum in het tabblad
              Planning.
            </p>
          </div>
          <div
            className={`inspection-panel ${tab !== "Opvolging" ? "inspection-hidden" : ""}`}
          >
            <h3>Resultaat & volgende cyclus</h3>
            <div className="form-grid">
              {text("inspectedDate", "Uitgevoerde keuring", "date")}
              {text("reportNumber", "Rapportnummer")}
              <label>
                Herhaling (maanden, 0 = eenmalig)
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={data.intervalMonths}
                  onChange={(e) =>
                    set("intervalMonths", Number(e.target.value))
                  }
                />
              </label>
              {text("nextDate", "Bevestigde volgende keuringsdatum", "date")}
            </div>
            <button
              className="secondary-button no-print"
              type="button"
              disabled={!data.inspectedDate || !data.intervalMonths}
              onClick={() => {
                try {
                  set(
                    "nextDate",
                    addMonths(data.inspectedDate, data.intervalMonths),
                  );
                } catch {
                  setError("Vul eerst een geldige keuringsdatum in.");
                }
              }}
            >
              Datum voorstellen op basis van interval
            </button>
            <div className="section-heading">
              <h3>Opvolgacties</h3>
              <button
                type="button"
                className="secondary-button no-print"
                disabled={data.followUps.length >= 100}
                onClick={() =>
                  set("followUps", [
                    ...data.followUps,
                    {
                      id: crypto.randomUUID(),
                      title: "",
                      owner: data.owner,
                      dueDate: "",
                      done: false,
                    },
                  ])
                }
              >
                + Actie toevoegen
              </button>
            </div>
            {!data.followUps.length && (
              <p className="muted">
                Nog geen opvolgacties. Leg hier opmerkingen en herstelwerk vast.
              </p>
            )}
            {data.followUps.map((f, i) => (
              <div className="inspection-followup" key={f.id}>
                <label className="inspection-done">
                  <input
                    aria-label="Actie afgerond"
                    type="checkbox"
                    checked={f.done}
                    onChange={(e) =>
                      set(
                        "followUps",
                        data.followUps.map((v, j) =>
                          j === i ? { ...v, done: e.target.checked } : v,
                        ),
                      )
                    }
                  />
                  Klaar
                </label>
                {(["title", "owner", "dueDate"] as const).map((key) => (
                  <label key={key}>
                    {key === "title"
                      ? "Actie"
                      : key === "owner"
                        ? "Verantwoordelijke"
                        : "Uiterlijk"}
                    <input
                      required={key === "title"}
                      maxLength={key === "owner" ? 100 : 300}
                      type={key === "dueDate" ? "date" : "text"}
                      value={f[key]}
                      onChange={(e) =>
                        set(
                          "followUps",
                          data.followUps.map((v, j) =>
                            j === i ? { ...v, [key]: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
                <button
                  className="secondary-button no-print"
                  type="button"
                  aria-label="Actie verwijderen"
                  onClick={() =>
                    set(
                      "followUps",
                      data.followUps.filter((_, j) => i !== j),
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
            {record && (
              <div className="inspection-cycle no-print">
                <h3>Vervolgdossier</h3>
                <p>
                  Vanaf drie maanden vóór de volgende keuring, of direct bij een
                  herkeuring. Resultaten en documenten van deze cyclus blijven
                  hier bewaard.
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    dirty ||
                    !!nextId ||
                    !nextCycleAvailable(record.data, today())
                  }
                  onClick={() =>
                    setConfirm({
                      title: "Vervolgdossier aanmaken?",
                      description:
                        "Er wordt één nieuw dossier voor de volgende cyclus aangemaakt. Het huidige dossier blijft bewaard.",
                      run: () =>
                        perform(() =>
                          inspectionRequest(
                            `${url}/${record.id}/next-cycle`,
                            "POST",
                            { version: record.version },
                          ),
                        ),
                    })
                  }
                >
                  {nextId
                    ? "Vervolgdossier bestaat al"
                    : "Nieuwe cyclus voorbereiden"}
                </button>
                {nextId && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openCycle(nextId)}
                  >
                    Vervolgdossier openen →
                  </button>
                )}
              </div>
            )}
          </div>
          <div
            className={`inspection-panel ${tab !== "Documenten" ? "inspection-hidden" : ""}`}
          >
            <h3>Bewijsstukken & documenten</h3>
            <p className="muted">
              PDF, PNG of JPG · maximaal 4 MB per bestand. Documenten worden bij
              dit dossier opgeslagen.
            </p>
            {(!record || dirty) && (
              <p className="inspection-info">
                Sla het dossier eerst op om documenten toe te voegen of te
                verwijderen.
              </p>
            )}
            <div className="form-grid no-print">
              <label>
                Documenttype
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {documentCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Bestand toevoegen
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={
                    !record ||
                    dirty ||
                    ["ARCHIVED", "OUT_OF_SERVICE"].includes(data.status)
                  }
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void upload(f, category);
                  }}
                />
              </label>
            </div>
            {record?.documents.map((doc) => (
              <div className="inspection-document" key={doc.id}>
                <div>
                  <a href={`${url}/${record.id}/documents/${doc.id}`} download>
                    {doc.name}
                  </a>
                  <p className="muted">
                    {doc.category} · {Math.ceil(doc.size / 1024)} KB ·{" "}
                    {dateLabel(doc.createdAt)}
                  </p>
                </div>
                <button
                  className="secondary-button no-print"
                  type="button"
                  disabled={
                    dirty ||
                    [
                      "CONFORM",
                      "REINSPECTION",
                      "ARCHIVED",
                      "OUT_OF_SERVICE",
                    ].includes(data.status)
                  }
                  onClick={() =>
                    setConfirm({
                      title: "Document verwijderen?",
                      description: `${doc.name} wordt uit dit dossier verwijderd. De verwijdering komt in de historiek.`,
                      reason: true,
                      run: (reason) =>
                        perform(() =>
                          inspectionRequest(
                            `${url}/${record.id}/documents/${doc.id}/remove`,
                            "POST",
                            { version: record.version, reason },
                          ),
                        ),
                    })
                  }
                >
                  Verwijderen
                </button>
              </div>
            ))}
            {!record?.documents.length && (
              <div className="inspection-empty">
                Nog geen documenten toegevoegd.
              </div>
            )}
          </div>
          <div
            className={`inspection-panel ${tab !== "Historiek" ? "inspection-hidden" : ""}`}
          >
            <h3>Wijzigingsgeschiedenis</h3>
            <p className="muted">
              Dossierwijzigingen, documenten en nieuwe cycli worden automatisch
              vastgelegd.
            </p>
            {record?.events.map((event) => (
              <article className="inspection-event" key={event.id}>
                <strong>{event.actor}</strong>
                <time>{new Date(event.createdAt).toLocaleString("nl-BE")}</time>
                <p>{event.detail}</p>
              </article>
            ))}
            {!record?.events.length && (
              <p>De historiek start zodra je het dossier aanmaakt.</p>
            )}
          </div>
        </fieldset>
        {issues.length > 0 && (
          <div className="inspection-info no-print">
            <strong>Nodig voor deze status</strong>
            <ul>
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        <footer className="inspection-save no-print">
          <span>
            {dirty
              ? "Je hebt niet-opgeslagen wijzigingen."
              : "Alle wijzigingen opgeslagen."}
          </span>
          <button
            className="button-primary"
            disabled={!writable || busy || (!dirty && !!record)}
          >
            {busy
              ? "Bezig…"
              : record
                ? "Wijzigingen opslaan"
                : "Dossier aanmaken"}
          </button>
        </footer>
      </form>
      {confirm && (
        <Confirm
          {...confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={(reason) => {
            const run = confirm.run;
            setConfirm(null);
            run(reason);
          }}
        />
      )}
    </section>
  );
}
