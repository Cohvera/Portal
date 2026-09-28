"use client";
import { useEffect, useRef } from "react";
export default function Confirm({
  title,
  description,
  reason = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  reason?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="catalog-dialog"
      aria-labelledby="inspection-confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form
        className="task-form"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(String(new FormData(e.currentTarget).get("reason") || ""));
        }}
      >
        <h2 id="inspection-confirm-title">{title}</h2>
        <p>{description}</p>
        {reason && (
          <label>
            Reden
            <textarea name="reason" required maxLength={1000} autoFocus />
          </label>
        )}
        <footer className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Annuleren
          </button>
          <button className="button-primary">Bevestigen</button>
        </footer>
      </form>
    </dialog>
  );
}
