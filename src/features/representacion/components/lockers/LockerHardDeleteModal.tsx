"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { ResponsiveDialog } from "@/shared/components/ui";

export interface LockerDeleteTarget {
  id: string;
  locker_number: string;
  active_assignment?: unknown | null;
  archived_at?: string | null;
}

interface LockerHardDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lockerNumber: string) => void;
  locker: LockerDeleteTarget | null;
}

export function LockerHardDeleteModal({
  isOpen,
  onClose,
  onSuccess,
  locker,
}: LockerHardDeleteModalProps): React.JSX.Element | null {
  const [confirmInput, setConfirmInput] = useState("");
  const [hasAgreed, setHasAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state on modal open
      setConfirmInput("");
      setHasAgreed(false);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!locker) return null;

  const isArchived = Boolean(locker.archived_at);
  const isConfirmed = confirmInput.trim().toUpperCase() === locker.locker_number.trim().toUpperCase();
  const canDelete = isArchived && isConfirmed && hasAgreed;

  async function handleDelete(): Promise<void> {
    if (!locker || !canDelete) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/union/lockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_unused",
          locker_id: locker.id,
          confirm_locker_number: confirmInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo eliminar el casillero.");
      }

      onSuccess(locker.locker_number);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar la eliminación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={onClose}
      title={`Eliminar definitivamente ${locker.locker_number}`}
      description="Esta operación destruye físicamente el registro en la base de datos de manera irreversible. Solo se permite si el casillero se encuentra en papelera y nunca ha tenido historial ni actividad registrada."
      size="sm"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.25rem 0.625rem",
            borderRadius: "999px",
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            fontSize: "0.75rem",
            fontWeight: 700,
          }}
        >
          🔒 CANDADO DE SEGURIDAD ESTRICTA
        </div>

        {error ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: "0.8125rem",
              fontWeight: 500,
            }}
          >
            {error}
          </div>
        ) : null}

        {!isArchived ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              fontSize: "0.8125rem",
              lineHeight: 1.4,
            }}
          >
            <strong>Acción bloqueada:</strong> Este casillero no está en la papelera.
            Para proteger la auditoría sindical y prevenir borrados accidentales, primero debes enviarlo a la papelera.
          </div>
        ) : (
          <div
            style={{
              backgroundColor: "#f8fafc",
              border: "1px solid var(--border)",
              borderRadius: "0.375rem",
              padding: "0.75rem 1rem",
              fontSize: "0.8125rem",
              color: "var(--muted)",
              lineHeight: 1.4,
            }}
          >
            ℹ️ <strong>Aviso de resguardo:</strong> Los casilleros en papelera se conservan de forma segura
            con todo su historial. No es necesario eliminarlos definitivamente a menos que se trate de un error
            de captura sin uso.
          </div>
        )}

        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.375rem",
            padding: "0.75rem 1rem",
            fontSize: "0.8125rem",
            color: "#991b1b",
            lineHeight: 1.4,
          }}
        >
          Si el casillero fue importado en un censo, tiene asignaciones previas, reservas o incidencias,
          la base de datos <strong>rechazará la eliminación</strong> para proteger la auditoría sindical.
        </div>

        {/* Verificación 1: Checkbox explícito de riesgo */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.625rem",
            fontSize: "0.8125rem",
            color: "var(--fg)",
            cursor: isArchived && !loading ? "pointer" : "not-allowed",
            lineHeight: 1.4,
          }}
        >
          <input
            type="checkbox"
            checked={hasAgreed}
            onChange={(e) => setHasAgreed(e.target.checked)}
            disabled={loading || !isArchived}
            style={{ marginTop: "0.15rem", cursor: isArchived && !loading ? "pointer" : "not-allowed" }}
          />
          <span>
            Comprendo que este casillero está en la papelera y confirmo su <strong>destrucción física definitiva</strong> e irreversible.
          </span>
        </label>

        {/* Verificación 2: Entrada exacta del número */}
        <div>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.375rem" }}>
            Escribe exactamente <span style={{ fontFamily: "monospace", color: "#b91c1c" }}>{locker.locker_number}</span> para desbloquear la destrucción:
          </label>
          <Input
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={locker.locker_number}
            disabled={loading || !isArchived}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            loading={loading}
            disabled={loading || !canDelete}
            style={{ backgroundColor: "#dc2626", borderColor: "#dc2626" }}
          >
            Destruir definitivamente
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
