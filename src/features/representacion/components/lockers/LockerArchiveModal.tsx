"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";

export interface LockerArchiveTarget {
  id: string;
  locker_number: string;
  archived_at?: string | null;
  active_assignment?: unknown | null;
  reserved_for_worker_id?: string | null;
  pending_review_items_count?: number;
  pending_review_item?: unknown | null;
}

interface LockerArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lockerNumber: string, isRestored: boolean) => void;
  locker: LockerArchiveTarget | null;
}

export function LockerArchiveModal({
  isOpen,
  onClose,
  onSuccess,
  locker,
}: LockerArchiveModalProps): React.JSX.Element | null {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isArchived = Boolean(locker?.archived_at);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state on modal open
      setReason("");
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen || !locker) return null;

  // Validaciones de seguridad para archivado
  const hasActiveWorker = Boolean(locker.active_assignment);
  const isReserved = Boolean(locker.reserved_for_worker_id);
  const hasPendingReview = Boolean(
    (locker.pending_review_items_count && locker.pending_review_items_count > 0) ||
    locker.pending_review_item
  );

  const canArchive = !hasActiveWorker && !isReserved && !hasPendingReview;

  async function handleConfirm(): Promise<void> {
    if (!locker) return;
    if (!isArchived && !reason.trim()) {
      setError("Debe proporcionar un motivo para retirar/archivar el casillero.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = isArchived
        ? { action: "restore", locker_id: locker.id }
        : { action: "archive", locker_id: locker.id, reason: reason.trim() };

      const res = await fetch("/api/union/lockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo procesar la solicitud.");
      }

      onSuccess(locker.locker_number, isArchived);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

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
      aria-labelledby="archive-modal-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "var(--card)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div>
          <h2 id="archive-modal-title" style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", fontWeight: 700 }}>
            {isArchived
              ? `Reactivar casillero ${locker.locker_number}`
              : `Retirar / Archivar casillero ${locker.locker_number}`}
          </h2>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
            {isArchived
              ? "El casillero volverá al inventario activo como disponible para asignación."
              : "Retira el casillero del inventario activo sin borrar su historial ni sus asignaciones pasadas."}
          </p>
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

        {!isArchived && !canArchive ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
              fontSize: "0.8125rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <strong>Operación no permitida:</strong>
            {hasActiveWorker ? <span>• Tiene un trabajador actualmente asignado. Libéralo primero.</span> : null}
            {isReserved ? <span>• El casillero se encuentra reservado. Cancela la reserva primero.</span> : null}
            {hasPendingReview ? (
              <span>• Tiene incidencias de conciliación pendientes. Resuélvelas en la bandeja de pendientes.</span>
            ) : null}
          </div>
        ) : null}

        {!isArchived ? (
          <div>
            <Input
              label="Motivo del retiro *"
              placeholder="ej. Mueble desmantelado, casillero inservible, remodelación…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading || !canArchive}
              required
              autoFocus
            />
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={loading}
            disabled={loading || (!isArchived && (!canArchive || !reason.trim()))}
            style={
              isArchived
                ? { backgroundColor: "#16a34a", borderColor: "#16a34a" }
                : { backgroundColor: "#ea580c", borderColor: "#ea580c" }
            }
          >
            {isArchived ? "Reactivar casillero" : "Archivar casillero"}
          </Button>
        </div>
      </div>
    </div>
  );
}
