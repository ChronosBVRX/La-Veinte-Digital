"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { ResponsiveDialog } from "@/shared/components/ui";
import type { LockerMapItem } from "@/features/representacion/lib/lockers";

interface LockerSwapFlowProps {
  isOpen: boolean;
  onClose: () => void;
  sourceLocker: LockerMapItem | null;
  onSuccess: () => void;
}

export function LockerSwapFlow({
  isOpen,
  onClose,
  sourceLocker,
  onSuccess,
}: LockerSwapFlowProps): React.JSX.Element | null {
  const [assignedLockers, setAssignedLockers] = useState<Array<{ id: string; locker_number: string; worker_name?: string }>>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [reason, setReason] = useState("Intercambio mutuo de casilleros acordado");
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !sourceLocker) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset modal state on open
    setSelectedTargetId("");
    setError(null);
    setLoadingList(true);

    fetch(`/api/union/lockers/map?zone_id=all`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { lockers?: LockerMapItem[] }) => {
        const occupied = (data.lockers ?? [])
          .filter((l) => l.effective_state.kind === "assigned" && l.id !== sourceLocker.id)
          .map((l) => ({
            id: l.id,
            locker_number: l.locker_number,
            worker_name: l.active_assignment?.worker_name || "Ocupado",
          }));
        setAssignedLockers(occupied);
      })
      .catch(() => {
        setError("No se pudieron cargar los casilleros ocupados.");
      })
      .finally(() => {
        setLoadingList(false);
      });
  }, [isOpen, sourceLocker]);

  if (!sourceLocker) return null;

  const asgA = sourceLocker.active_assignment;
  const targetLocker = assignedLockers.find((l) => l.id === selectedTargetId);

  async function handleSwap(): Promise<void> {
    if (!selectedTargetId) {
      setError("Selecciona el segundo casillero para realizar el intercambio.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/union/lockers/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locker_a_id: sourceLocker?.id,
          locker_b_id: selectedTargetId,
          swap_reason: reason.trim() || "Intercambio mutuo",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al intercambiar casilleros");

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fallo al intercambiar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={onClose}
      title="Intercambiar Casilleros (Swap)"
      description="Operación administrativa atómica entre dos trabajadores activos."
      size="md"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Diagrama visual de intercambio */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: "var(--accent)",
            padding: "0.875rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border)",
          }}
        >
          {/* Casillero A */}
          <div style={{ textAlign: "center", padding: "0.5rem", backgroundColor: "var(--card)", borderRadius: "0.375rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600 }}>Casillero A</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--fg)" }}>#{sourceLocker.locker_number}</div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2563eb", marginTop: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {asgA?.worker_name || "Trabajador A"}
            </div>
          </div>

          <div style={{ fontSize: "1.25rem", color: "var(--muted)" }}>⇄</div>

          {/* Casillero B */}
          <div style={{ textAlign: "center", padding: "0.5rem", backgroundColor: "var(--card)", borderRadius: "0.375rem" }}>
            <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 600 }}>Casillero B</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: targetLocker ? "var(--fg)" : "var(--muted)" }}>
              {targetLocker ? `#${targetLocker.locker_number}` : "—"}
            </div>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#16a34a", marginTop: "0.15rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {targetLocker?.worker_name || "Seleccionar..."}
            </div>
          </div>
        </div>

        {/* Selección del Casillero B */}
        <div>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.35rem" }}>
            Selecciona el segundo casillero con el que se intercambiará:
          </label>
          {loadingList ? (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Cargando casilleros asignados...</div>
          ) : assignedLockers.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "#dc2626" }}>No hay otros casilleros asignados disponibles para intercambiar.</div>
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
              <option value="">-- Seleccionar casillero a intercambiar --</option>
              {assignedLockers.map((l) => (
                <option key={l.id} value={l.id}>
                  Locker #{l.locker_number} ({l.worker_name})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Motivo */}
        <div>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.35rem" }}>
            Motivo del intercambio:
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Acuerdo mutuo entre trabajadores por cercanía a servicio"
          />
        </div>

        {error && (
          <div style={{ color: "#dc2626", fontSize: "0.8125rem" }} role="alert">
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSwap}
            loading={submitting}
            disabled={submitting || !selectedTargetId}
          >
            Confirmar intercambio atómico
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
