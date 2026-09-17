"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";

export function LockerReleaseModal({
  isOpen,
  lockerNumber,
  onConfirm,
  onCancel,
  loading = false,
}: {
  isOpen: boolean;
  lockerNumber: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}): React.JSX.Element | null {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state on modal open
      setReason("");
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape" && isOpen && !loading) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(2px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="release-modal-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "var(--card)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div>
          <h2 id="release-modal-title" style={{ margin: "0 0 0.25rem", fontSize: "1.125rem", fontWeight: 700 }}>
            Liberar locker {lockerNumber}
          </h2>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
            El casillero volverá a quedar disponible para asignación. El registro anterior se conservará intacto en el historial.
          </p>
        </div>

        <div>
          <Input
            label="Motivo de liberación"
            placeholder="ej. Cambio de turno, baja, solicitud voluntaria…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (reason.trim()) onConfirm(reason.trim());
            }}
            disabled={!reason.trim() || loading}
            loading={loading}
            style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
          >
            Liberar casillero
          </Button>
        </div>
      </div>
    </div>
  );
}
