"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { ResponsiveDialog } from "@/shared/components/ui/ResponsiveDialog";

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
    <ResponsiveDialog
      open={isOpen}
      onClose={onClose}
      title={
        isArchived
          ? `Reactivar casillero ${locker.locker_number}`
          : `Retirar / Archivar casillero ${locker.locker_number}`
      }
      description={
        isArchived
          ? "El casillero volverá al inventario activo como disponible para asignación."
          : "Retira el casillero del inventario activo sin borrar su historial ni sus asignaciones pasadas."
      }
      size="sm"
      closeOnOverlay={!loading}
      footer={
        <>
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
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
          <Input
            label="Motivo del retiro *"
            placeholder="ej. Mueble desmantelado, casillero inservible, remodelación…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading || !canArchive}
            required
            autoFocus
          />
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}
