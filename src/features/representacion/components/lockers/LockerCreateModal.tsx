"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input, Select, Textarea } from "@/shared/components/ui/Input";
import { ResponsiveDialog } from "@/shared/components/ui/ResponsiveDialog";
import type { LockerZone, LockerBank } from "@/features/representacion/lib/lockers";

interface LockerCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdNumber: string) => void;
  zones: LockerZone[];
  banks: LockerBank[];
}

export function LockerCreateModal({
  isOpen,
  onClose,
  onSuccess,
  zones,
  banks,
}: LockerCreateModalProps): React.JSX.Element | null {
  const [lockerNumber, setLockerNumber] = useState("");
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
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state on modal open
      setLockerNumber("");
      setPhysicalCode("");
      setZoneId("");
      setBankId("");
      setRowPosition("");
      setColPosition("");
      setPositionLabel("");
      setCondition("ok");
      setMaintenanceReason("");
      setNotes("");
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const cleanNumber = lockerNumber.trim();
    if (!cleanNumber) {
      setError("El número de casillero es obligatorio.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        action: "create",
        locker_number: cleanNumber,
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
        throw new Error(data.error || "No se pudo crear el casillero.");
      }

      onSuccess(cleanNumber);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado al crear casillero.");
    } finally {
      setLoading(false);
    }
  }

  // Filtrar muebles pertenecientes a la zona seleccionada (si aplica)
  const filteredBanks = zoneId
    ? banks.filter((b) => !b.zone_id || b.zone_id === zoneId)
    : banks;

  return (
    <ResponsiveDialog
      open={isOpen}
      onClose={onClose}
      title="Nuevo casillero"
      description="Registra un nuevo casillero en el inventario físico de la delegación."
      size="md"
      sheetHeight="large"
      closeOnOverlay={!loading}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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

        {/* Identificadores */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Input
            label="Número visible *"
            placeholder="ej. 101, B-12…"
            value={lockerNumber}
            onChange={(e) => setLockerNumber(e.target.value)}
            disabled={loading}
            required
            autoFocus
          />
          <Input
            label="Código físico / Placa"
            placeholder="ej. SERIE-883"
            value={physicalCode}
            onChange={(e) => setPhysicalCode(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Zona y Mueble */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Select
            label="Zona / Área"
            value={zoneId}
            onChange={(e) => {
              setZoneId(e.target.value);
              setBankId("");
            }}
            disabled={loading}
          >
            <option value="">(Sin asignar)</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>

          <Select
            label="Mueble / Batería"
            value={bankId}
            onChange={(e) => setBankId(e.target.value)}
            disabled={loading}
          >
            <option value="">(Sin asignar)</option>
            {filteredBanks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Posición en el mueble */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: "0.75rem" }}>
          <Input
            label="Fila (1..n)"
            type="number"
            min="1"
            placeholder="ej. 1"
            value={rowPosition}
            onChange={(e) => setRowPosition(e.target.value)}
            disabled={loading}
          />
          <Input
            label="Columna (1..n)"
            type="number"
            min="1"
            placeholder="ej. 2"
            value={colPosition}
            onChange={(e) => setColPosition(e.target.value)}
            disabled={loading}
          />
          <Input
            label="Etiqueta posicional"
            placeholder="ej. Superior der."
            value={positionLabel}
            onChange={(e) => setPositionLabel(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Condición física */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Select
            label="Estado físico"
            value={condition}
            onChange={(e) => setCondition(e.target.value as "ok" | "maintenance" | "blocked")}
            disabled={loading}
          >
            <option value="ok">Buen estado (OK)</option>
            <option value="maintenance">Requiere mantenimiento / Dañado</option>
            <option value="blocked">Bloqueado / Clausurado</option>
          </Select>

          {condition !== "ok" ? (
            <Input
              label="Motivo de condición física"
              placeholder="ej. Chapa rota, sin puerta, bisagra dañada…"
              value={maintenanceReason}
              onChange={(e) => setMaintenanceReason(e.target.value)}
              disabled={loading}
            />
          ) : null}
        </div>

        {/* Observaciones */}
        <Textarea
          label="Notas / Observaciones del casillero"
          placeholder="Detalles sobre características físicas o ubicación exacta…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
        />

        {/* Botones de acción */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" loading={loading} disabled={loading || !lockerNumber.trim()}>
            Crear casillero
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
