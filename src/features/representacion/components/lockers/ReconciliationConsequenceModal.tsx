"use client";

import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";

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
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
    >
      <div style={{ maxWidth: "520px", width: "100%" }}>
        <Card padding="1.5rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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
                <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.125rem", fontWeight: 700 }}>
                  {title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.25rem",
                  color: "var(--muted)",
                  cursor: "pointer",
                  padding: "0.25rem",
                }}
              >
                ✕
              </button>
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
        </Card>
      </div>
    </div>
  );
}
