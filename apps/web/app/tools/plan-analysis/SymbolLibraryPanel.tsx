"use client";
import { useEffect, useRef, useState } from "react";
import {
  LIBRARY_KEY,
  emptyLibrary,
  parseLibrary,
  saveExample,
  decodeExample,
  type SymbolLibrary,
  type SavedSymbol,
  type SavedExample,
} from "../../../lib/symbol-library";
import type { SymbolSample } from "../../../lib/symbol-match";
function Thumbnail({ example }: { example: SavedExample }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const sample = decodeExample(example);
    c.width = sample.width;
    c.height = sample.height;
    const ctx = c.getContext("2d");
    if (ctx) {
      const image = ctx.createImageData(c.width, c.height);
      image.data.set(sample.pixels);
      ctx.putImageData(image, 0, 0);
    }
  }, [example]);
  return (
    <canvas
      ref={ref}
      className="symbol-preview"
      aria-label="Bewaard voorbeeld"
    />
  );
}
export default function SymbolLibraryPanel({
  name,
  capture,
  disabled,
  onChoose,
}: {
  name: string;
  capture: (() => SymbolSample) | null;
  disabled: boolean;
  onChoose: (symbol: SavedSymbol | null) => void;
}) {
  const [library, setLibrary] = useState<SymbolLibrary>(emptyLibrary),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [ready, setReady] = useState(false),
    [rename, setRename] = useState("");
  const current = library.symbols.find((s) => s.id === selected);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIBRARY_KEY);
      if (raw) setLibrary(parseLibrary(raw));
    } catch {
      setError(
        "De lokale bibliotheek kon niet worden geladen. Importeer een reservekopie of bewaar een nieuwe bibliotheek.",
      );
    } finally {
      setReady(true);
    }
  }, []);
  function persist(next: SymbolLibrary, id: string) {
    try {
      const valid = parseLibrary(JSON.stringify(next));
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(valid));
      setLibrary(valid);
      setSelected(id);
      const chosen = valid.symbols.find((s) => s.id === id) ?? null;
      setRename(chosen?.name ?? "");
      onChoose(chosen);
      setError("");
      setNotice("Bibliotheek bewaard in deze browser.");
    } catch (e) {
      setError(
        e instanceof Error && e.name === "QuotaExceededError"
          ? "Browseropslag vol. Exporteer je bibliotheek en verwijder ongebruikte voorbeelden."
          : e instanceof Error
            ? e.message
            : "Bewaren mislukt.",
      );
    }
  }
  function add() {
    if (!capture) return;
    try {
      const example = saveExample(capture());
      if (current) {
        persist(
          {
            ...library,
            symbols: library.symbols.map((s) =>
              s.id === current.id
                ? { ...s, examples: [...s.examples, example] }
                : s,
            ),
          },
          current.id,
        );
      } else {
        const id = crypto.randomUUID();
        persist(
          {
            ...library,
            symbols: [
              ...library.symbols,
              { id, name: name.trim(), examples: [example] },
            ],
          },
          id,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Voorbeeld bewaren mislukt.");
    }
  }
  function exportLibrary() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(library, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "cohvera-symbolenbibliotheek.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="symbol-library">
      <h3>Mijn symbolenbibliotheek</h3>
      <p>
        Bewaar per type een vrijstaand, gedraaid of doorkruist voorbeeld. Alleen
        de uitsnedes worden lokaal bewaard, op dit apparaat in deze browser.
        Exporteer een reservekopie om ze op een ander apparaat te gebruiken.
      </p>
      <label>
        Bewaard symbool
        <select
          disabled={disabled || !ready}
          value={selected}
          onChange={(e) => {
            const id = e.target.value;
            setSelected(id);
            const s = library.symbols.find((x) => x.id === id) ?? null;
            setRename(s?.name ?? "");
            onChoose(s);
            setNotice("");
          }}>
          <option value="">Nieuw symbool / los voorbeeld</option>
          {library.symbols.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.examples.length} voorbeelden)
            </option>
          ))}
        </select>
      </label>
      {current && (
        <>
          <p>
            Bij zoeken worden alle {current.examples.length} bewaarde
            voorbeelden van <strong>{current.name}</strong> gebruikt.
          </p>
          <label>
            Bibliotheeknaam
            <input
              value={rename}
              maxLength={100}
              disabled={disabled}
              onChange={(e) => setRename(e.target.value)}
            />
          </label>
          <button
            className="secondary-button"
            disabled={disabled || !rename.trim()}
            onClick={() =>
              persist(
                {
                  ...library,
                  symbols: library.symbols.map((s) =>
                    s.id === selected ? { ...s, name: rename.trim() } : s,
                  ),
                },
                selected,
              )
            }>
            Naam bewaren
          </button>
          <div className="symbol-library-examples">
            {current.examples.map((e, i) => (
              <div key={e.id}>
                <Thumbnail example={e} />
                <button
                  className="secondary-button"
                  disabled={disabled}
                  aria-label={`Voorbeeld ${i + 1} verwijderen`}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Voorbeeld ${i + 1} verwijderen uit ${current.name}?`,
                      )
                    )
                      return;
                    const remaining = current.examples.filter(
                      (x) => x.id !== e.id,
                    );
                    persist(
                      {
                        ...library,
                        symbols: remaining.length
                          ? library.symbols.map((s) =>
                              s.id === selected
                                ? { ...s, examples: remaining }
                                : s,
                            )
                          : library.symbols.filter((s) => s.id !== selected),
                      },
                      remaining.length ? selected : "",
                    );
                  }}>
                  Verwijderen
                </button>
              </div>
            ))}
          </div>
          <button
            className="secondary-button"
            disabled={disabled}
            onClick={() => {
              if (
                window.confirm(
                  `Symbool ${current.name} en alle voorbeelden verwijderen?`,
                )
              )
                persist(
                  {
                    ...library,
                    symbols: library.symbols.filter((s) => s.id !== selected),
                  },
                  "",
                );
            }}>
            Symbool verwijderen
          </button>
        </>
      )}
      <button
        className="secondary-button"
        disabled={disabled || !ready || !capture || (!current && !name.trim())}
        onClick={add}>
        {current
          ? "Gekozen uitsnede als extra voorbeeld bewaren"
          : "Gekozen uitsnede als nieuw symbool bewaren"}
      </button>
      <p>
        Maximaal 40 types, 8 voorbeelden per type en 4 MB. Bij een andere
        planschaal kan een nieuw voorbeeld nodig zijn.
      </p>
      <div className="plan-actions">
        <button
          className="secondary-button"
          disabled={disabled || !library.symbols.length}
          onClick={exportLibrary}>
          Bibliotheek exporteren
        </button>
        <label>
          Bibliotheek importeren
          <input
            type="file"
            accept=".json,application/json"
            disabled={disabled || !ready}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                if (f.size > 4_000_000)
                  throw new Error("Bestand groter dan 4 MB.");
                const next = parseLibrary(await f.text());
                if (
                  library.symbols.length &&
                  !window.confirm(
                    "De huidige lokale bibliotheek vervangen door dit bestand? Exporteer eerst een reservekopie als je die wilt behouden.",
                  )
                )
                  return;
                persist(next, "");
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Import mislukt.",
                );
              }
            }}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
