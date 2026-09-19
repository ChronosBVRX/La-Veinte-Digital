"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import type { LockerMapItem } from "@/features/representacion/lib/lockers";

interface LockerMoveFlowProps {
  isOpen: boolean;
  onClose: () => void;
  sourceLocker: LockerMapItem | null;
  onSuccess: () => void;
}

export function LockerMoveFlow({
  isOpen,
  onClose,
  sourceLocker,
  onSuccess,
}: LockerMoveFlowProps): React.JSX.Element | null {
  const [targetNumber, setTargetNumber] = useState("");
  const [reason, setReason] = useState("Reubicación de casillero");
  const [availableLockers, setAvailableLockers] = useState<Array<{ id: string; locker_number: string; zone_name?: string }>>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sourceLocker) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset modal state on open
    setTargetNumber("");
    setSelectedTargetId("");
    setError(null);
    setLoadingList(true);

    fetch(`/api/union/lockers/map?zone_id=all`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { lockers?: LockerMapItem[]; zones?: Array<{ id: string; name: string }> }) => {
        const zonesMap = new Map((data.zones ?? []).map((z) => [z.id, z.name]));
        const free = (data.lockers ?? [])
          .filter((l) => l.effective_state.isAvailable && l.id !== sourceLocker.id)
          .map((l) => ({
            id: l.id,
            locker_number: l.locker_number,
            zone_name: l.zone_id ? zonesMap.get(l.zone_id) : "Sin ubicar",
          }));
        setAvailableLockers(free);
      })
      .catch(() => {
        setError("No se pudieron cargar los casilleros disponibles.");
      })
      .finally(() => {
        setLoadingList(false);
      });
  }, [isOpen, sourceLocker]);

  if (!isOpen || !sourceLocker) return null;

  const asg = sourceLocker.active_assignment;

  async function handleMove(): Promise<void> {
    const targetId = selectedTargetId || availableLockers.find((l) => l.locker_number.trim() === targetNumber.trim())?.id;
    if (!targetId) {
      setError("Selecciona o escribe un número de casillero destino disponible.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/union/lockers/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_locker_id: sourceLocker?.id,
          to_locker_id: targetId,
          move_reason: reason.trim() || "Reubicación",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al reubicar trabajador");

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fallo al mover casillero");
    } finally {
      setSubmitting(false);
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
        backgroundColor: "rgba(15, 23, 42, 0.5)",
        backdropFilter: "blur(2px)",
        padding: "1rem",
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          backgroundColor: "var(--card)",
          borderRadius: "0.75rem",
          maxWidth: "480px",
          width: "100%",
          padding: "1.5rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)" }}>
            Cambiar de Casillero
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--muted)" }}
          >
            ✕
          </button>
        </div>

        {/* Resumen del trabajador */}
        <div
          style={{
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "0.5rem",
            padding: "0.875rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#1e40af", fontWeight: 600 }}>
            Trabajador a reubicar:
          </div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1e3a8a", marginTop: "0.15rem" }}>
            {asg?.worker_name || "Trabajador"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "#3b82f6", marginTop: "0.1rem" }}>
            Matrícula: <strong>{asg?.employee_number}</strong> · Casillero actual: <strong>#{sourceLocker.locker_number}</strong>
          </div>
        </div>

        {/* Casillero Destino */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.35rem" }}>
            Casillero destino disponible:
          </label>
          {loadingList ? (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Cargando casilleros libres...</div>
          ) : availableLockers.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "#dc2626" }}>No hay casilleros disponibles en la delegación.</div>
          ) : (
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--fg)",
                fontSize: "0.875rem",
              }}
            >
              <option value="">-- Seleccionar de {availableLockers.length} casilleros libres --</option>
              {availableLockers.map((l) => (
                <option key={l.id} value={l.id}>
                  Locker #{l.locker_number} ({l.zone_name})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Motivo */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.35rem" }}>
            Motivo del cambio:
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Cambio de turno, solicitud del trabajador, cercanía a vestidores"
          />
        </div>

        {error && (
          <div style={{ color: "#dc2626", fontSize: "0.8125rem", marginBottom: "1rem" }} role="alert">
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleMove}
            loading={submitting}
            disabled={submitting || (!selectedTargetId && !targetNumber)}
          >
            Confirmar reubicación atómica
          </Button>
        </div>
      </div>
    </div>
  );
}
