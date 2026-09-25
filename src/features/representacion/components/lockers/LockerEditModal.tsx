"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input, Select, Textarea } from "@/shared/components/ui/Input";
import { ResponsiveDialog } from "@/shared/components/ui";
import type { LockerZone, LockerBank } from "@/features/representacion/lib/lockers";

export interface LockerEditableData {
  id: string;
  locker_number: string;
  physical_code?: string | null;
  zone_id?: string | null;
  bank_id?: string | null;
  row_position?: number | null;
  column_position?: number | null;
  position_label?: string | null;
  condition?: string | null;
  maintenance_reason?: string | null;
  notes?: string | null;
}

interface LockerEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedNumber: string) => void;
  locker: LockerEditableData | null;
  zones: LockerZone[];
  banks: LockerBank[];
}

export function LockerEditModal({
  isOpen,
  onClose,
  onSuccess,
  locker,
  zones,
  banks,
}: LockerEditModalProps): React.JSX.Element | null {
  const [lockerNumber, setLockerNumber] = useState("");
  const [renumberReason, setRenumberReason] = useState("");
  const [physicalCode, setPhysicalCode] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [bankId, setBankId] = useState("");
  const [rowPosition, setRowPosition] = useState<string>("");
  const [colPosition, setColPosition] = useState<string>("");
  const [positionLabel, setPositionLabel] = useState("");
  const [condition, setCondition] = useState<"ok" | "maintenance" | "blocked">("ok");
  const [maintenanceReason, setMaintenanceReason] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && locker) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state on modal open
      setLockerNumber(locker.locker_number || "");
      setRenumberReason("");
      setPhysicalCode(locker.physical_code || "");
      setZoneId(locker.zone_id || "");
      setBankId(locker.bank_id || "");
      setRowPosition(locker.row_position ? String(locker.row_position) : "");
      setColPosition(locker.column_position ? String(locker.column_position) : "");
      setPositionLabel(locker.position_label || "");
      setCondition((locker.condition as "ok" | "maintenance" | "blocked") || "ok");
      setMaintenanceReason(locker.maintenance_reason || "");
      setNotes(locker.notes || "");
      setError(null);
      setLoading(false);
    }
  }, [isOpen, locker]);

  if (!locker) return null;

  const isRenumbering = lockerNumber.trim().toUpperCase() !== locker.locker_number.trim().toUpperCase();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!locker) return;
    const cleanNumber = lockerNumber.trim();
    if (!cleanNumber) {
      setError("El número de casillero es obligatorio.");
      return;
    }

    if (isRenumbering && !renumberReason.trim()) {
      setError("Debe especificar un motivo de auditoría para renumerar el casillero.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        action: "update",
        locker_id: locker.id,
        locker_number: cleanNumber,
        renumber_reason: isRenumbering ? renumberReason.trim() : undefined,
        physical_code: physicalCode.trim() || undefined,
        zone_id: zoneId || undefined,
        bank_id: bankId || undefined,
        row_position: rowPosition ? parseInt(rowPosition, 10) : undefined,
        column_position: colPosition ? parseInt(colPosition, 10) : undefined,
        position_label: positionLabel.trim() || undefined,
        condition,
        maintenance_reason: condition !== "ok" ? maintenanceReason.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/union/lockers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo actualizar el casillero.");
      }

      onSuccess(cleanNumber);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado al editar casillero.");
    } finally {
      setLoading(false);
    }
  }

  const filteredBanks = zoneId
    ? banks.filter((b) => !b.zone_id || b.zone_id === zoneId)
    : banks;

  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={onClose}
      title={`Editar casillero ${locker.locker_number}`}
      description="Modifica la ubicación física, muebles, condición o renumera conservando el historial."
      size="md"
      sheetHeight="large"
    >
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
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Identificación y Renumeración */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Input
            label="Número de Locker *"
            value={lockerNumber}
            onChange={(e) => setLockerNumber(e.target.value)}
            disabled={loading}
            required
          />
          <Input
            label="Código físico / placa"
            placeholder="ej. C-247"
            value={physicalCode}
            onChange={(e) => setPhysicalCode(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Aviso y Motivo de Renumeración */}
        {isRenumbering ? (
          <div
            style={{
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              borderRadius: "0.375rem",
              padding: "0.75rem 1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#92400e" }}>
              ⚠️ RENUMERACIÓN DETECTADA: {locker.locker_number} → {lockerNumber.trim().toUpperCase()}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#b45309", lineHeight: 1.4 }}>
              Se conservará el ID único, todas las asignaciones pasadas y el historial. Debe registrar la justificación para auditoría:
            </div>
            <Input
              label="Motivo de renumeración *"
              placeholder="ej. Corrección física de placa, rotulación nueva…"
              value={renumberReason}
              onChange={(e) => setRenumberReason(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        ) : null}

        {/* Ubicación Física */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Select
            label="Zona"
            value={zoneId}
            onChange={(e) => {
              setZoneId((e.target as HTMLSelectElement).value);
              setBankId("");
            }}
            disabled={loading}
          >
            <option value="">Sin zona asignada</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} {z.floor ? `(Piso ${z.floor})` : ""}
              </option>
            ))}
          </Select>

          <Select
            label="Mueble / Banco"
            value={bankId}
            onChange={(e) => setBankId((e.target as HTMLSelectElement).value)}
            disabled={loading}
          >
            <option value="">Sin mueble asignado</option>
            {filteredBanks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Coordenadas en Mueble */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "0.75rem" }}>
          <Input
            type="number"
            min="1"
            max="50"
            label="Fila"
            value={rowPosition}
            onChange={(e) => setRowPosition(e.target.value)}
            disabled={loading}
          />
          <Input
            type="number"
            min="1"
            max="50"
            label="Columna"
            value={colPosition}
            onChange={(e) => setColPosition(e.target.value)}
            disabled={loading}
          />
          <Input
            label="Etiqueta posición"
            placeholder="ej. Fila 2, Col 3"
            value={positionLabel}
            onChange={(e) => setPositionLabel(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Condición Física */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Select
            label="Condición física"
            value={condition}
            onChange={(e) => setCondition((e.target as HTMLSelectElement).value as "ok" | "maintenance" | "blocked")}
            disabled={loading}
          >
            <option value="ok">Buen estado (OK)</option>
            <option value="maintenance">Requiere mantenimiento / Dañado</option>
            <option value="blocked">Bloqueado / Clausurado</option>
          </Select>

          {condition !== "ok" ? (
            <Input
              label="Motivo de condición física"
              placeholder="ej. Candado roto, bisagra vencida…"
              value={maintenanceReason}
              onChange={(e) => setMaintenanceReason(e.target.value)}
              disabled={loading}
            />
          ) : null}
        </div>

        {/* Observaciones */}
        <Textarea
          label="Notas / Observaciones del casillero"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
        />

        {/* Botones de acción */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            loading={loading}
            disabled={loading || !lockerNumber.trim() || (isRenumbering && !renumberReason.trim())}
          >
            Guardar cambios
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
