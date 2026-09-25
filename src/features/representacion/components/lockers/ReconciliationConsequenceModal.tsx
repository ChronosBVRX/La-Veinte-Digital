"use client";

import { Button } from "@/shared/components/ui/Button";
import { ResponsiveDialog } from "@/shared/components/ui";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  selectedOptionLabel: string;
  consequences: string[];
  isSubmitting: boolean;
}

export function ReconciliationConsequenceModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  selectedOptionLabel,
  consequences,
  isSubmitting,
}: Props): React.JSX.Element | null {
  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={onClose}
      title={title}
      size="md"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--primary)",
            }}
          >
            Confirmar Conciliación
          </span>
        </div>

        <div
          style={{
            backgroundColor: "var(--accent)",
            padding: "0.75rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Opción elegida:</div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
            {selectedOptionLabel}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.5rem", color: "var(--fg)" }}>
            Consecuencias que se aplicarán en la base de datos:
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.8125rem",
              color: "var(--fg)",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
              lineHeight: 1.4,
            }}
          >
            {consequences.length > 0 ? (
              consequences.map((c, i) => (
                <li key={i} style={{ color: c.includes("liberará") ? "#b45309" : "inherit" }}>
                  {c}
                </li>
              ))
            ) : (
              <li>Se aplicará la asignación seleccionada y se resolverá el caso.</li>
            )}
          </ul>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            borderTop: "1px solid var(--border)",
            paddingTop: "1rem",
            marginTop: "0.5rem",
          }}
        >
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} loading={isSubmitting}>
            Confirmar y guardar
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
