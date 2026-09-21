"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Select, Input } from "@/shared/components/ui/Input";
import type { LockerZone, LockerBank } from "@/features/representacion/lib/lockers";

interface LockerBulkToolbarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onSuccess: (message: string) => void;
  zones: LockerZone[];
  banks: LockerBank[];
}

export function LockerBulkToolbar({
  selectedIds,
  onClearSelection,
  onSuccess,
  zones,
  banks,
}: LockerBulkToolbarProps): React.JSX.Element | null {
  const [activeAction, setActiveAction] = useState<"zone" | "bank" | "condition" | "archive" | null>(null);
  const [targetZoneId, setTargetZoneId] = useState("");
  const [targetBankId, setTargetBankId] = useState("");
  const [targetCondition, setTargetCondition] = useState<"ok" | "maintenance" | "blocked">("ok");
  const [conditionReason, setConditionReason] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  async function handleApply(): Promise<void> {
    if (!activeAction) return;

    setLoading(true);
    setError(null);

    try {
      let payload: Record<string, unknown> = {
        action: "bulk_update",
        locker_ids: selectedIds,
      };

      if (activeAction === "zone") {
        payload = { ...payload, zone_id: targetZoneId || null };
      } else if (activeAction === "bank") {
        payload = { ...payload, bank_id: targetBankId || null };
      } else if (activeAction === "condition") {
        payload = {
          ...payload,
          condition: targetCondition,
          maintenance_reason: targetCondition !== "ok" ? conditionReason.trim() || undefined : undefined,
        };
      } else if (activeAction === "archive") {
        if (!archiveReason.trim()) {
          setError("Debe proporcionar un motivo para el archivado masivo.");
          setLoading(false);
          return;
        }
        payload = { ...payload, archive: true, archive_reason: archiveReason.trim() };
      }

      const res = await fetch("/api/union/lockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo aplicar la acción masiva.");
      }

      onSuccess(`Acción masiva aplicada a ${data.updated_count ?? selectedIds.length} casilleros.`);
      setActiveAction(null);
      onClearSelection();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado en acción masiva.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 80,
        width: "calc(100% - 3rem)",
        maxWidth: "800px",
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        padding: "0.875rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              padding: "0.2rem 0.6rem",
              borderRadius: "999px",
              backgroundColor: "var(--primary)",
              color: "#ffffff",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            {selectedIds.length}
          </span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
            {selectedIds.length === 1 ? "casillero seleccionado" : "casilleros seleccionados"}
          </span>
        </div>

        {/* Acciones principales */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button
            variant={activeAction === "zone" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setActiveAction(activeAction === "zone" ? null : "zone")}
            disabled={loading}
          >
            Asignar Zona
          </Button>

          <Button
            variant={activeAction === "bank" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setActiveAction(activeAction === "bank" ? null : "bank")}
            disabled={loading}
          >
            Asignar Mueble
          </Button>

          <Button
            variant={activeAction === "condition" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setActiveAction(activeAction === "condition" ? null : "condition")}
            disabled={loading}
          >
            Condición Física
          </Button>

          <Button
            variant={activeAction === "archive" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setActiveAction(activeAction === "archive" ? null : "archive")}
            disabled={loading}
            style={activeAction === "archive" ? { backgroundColor: "#ea580c", borderColor: "#ea580c" } : {}}
          >
            Archivar vacíos
          </Button>

          <button
            type="button"
            onClick={onClearSelection}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: "0.8125rem",
              cursor: "pointer",
              marginLeft: "0.5rem",
              textDecoration: "underline",
            }}
          >
            Deseleccionar
          </button>
        </div>
      </div>

      {error ? (
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: "0.25rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            fontSize: "0.75rem",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* Subpanel de configuración de la acción seleccionada */}
      {activeAction ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem",
            backgroundColor: "var(--accent)",
            borderRadius: "0.375rem",
            border: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          {activeAction === "zone" ? (
            <div style={{ flex: 1, minWidth: "220px" }}>
              <Select
                value={targetZoneId}
                onChange={(e) => setTargetZoneId((e.target as HTMLSelectElement).value)}
                disabled={loading}
              >
                <option value="">Selecciona zona de destino (o desasignar)</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} {z.floor ? `(Piso ${z.floor})` : ""}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {activeAction === "bank" ? (
            <div style={{ flex: 1, minWidth: "220px" }}>
              <Select
                value={targetBankId}
                onChange={(e) => setTargetBankId((e.target as HTMLSelectElement).value)}
                disabled={loading}
              >
                <option value="">Selecciona mueble de destino (o desasignar)</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          {activeAction === "condition" ? (
            <div style={{ display: "flex", gap: "0.5rem", flex: 1, minWidth: "260px", flexWrap: "wrap" }}>
              <div style={{ minWidth: "150px" }}>
                <Select
                  value={targetCondition}
                  onChange={(e) => setTargetCondition((e.target as HTMLSelectElement).value as "ok" | "maintenance" | "blocked")}
                  disabled={loading}
                >
                  <option value="ok">Buen estado (OK)</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="blocked">Bloqueado</option>
                </Select>
              </div>
              {targetCondition !== "ok" ? (
                <div style={{ flex: 1, minWidth: "180px" }}>
                  <Input
                    placeholder="Motivo de condición…"
                    value={conditionReason}
                    onChange={(e) => setConditionReason(e.target.value)}
                    disabled={loading}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {activeAction === "archive" ? (
            <div style={{ flex: 1, minWidth: "260px" }}>
              <Input
                placeholder="Motivo del retiro masivo (ej. Mueble desmantelado) *"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                disabled={loading}
              />
            </div>
          ) : null}

          <div style={{ display: "flex", gap: "0.375rem" }}>
            <Button size="sm" variant="secondary" onClick={() => setActiveAction(null)} disabled={loading}>
              Cancelar
            </Button>
            <Button size="sm" variant="primary" onClick={handleApply} loading={loading} disabled={loading}>
              Aplicar a {selectedIds.length}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
