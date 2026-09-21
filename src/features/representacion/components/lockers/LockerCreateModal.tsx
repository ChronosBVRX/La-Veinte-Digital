"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input, Select, Textarea } from "@/shared/components/ui/Input";
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape" && isOpen && !loading) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

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
      aria-labelledby="create-locker-modal-title"
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
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
          <h2 id="create-locker-modal-title" style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", fontWeight: 700 }}>
            + Agregar casillero al inventario
          </h2>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
            Registra una nueva entidad física. Se dará de alta disponible y sin trabajador asignado.
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Identificación Física */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <Input
              label="Número de Locker *"
              placeholder="ej. 247 ó 247-B"
              value={lockerNumber}
              onChange={(e) => setLockerNumber(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
            <Input
              label="Código físico / placa"
              placeholder="ej. C-247"
              value={physicalCode}
              onChange={(e) => setPhysicalCode(e.target.value)}
              disabled={loading}
            />
          </div>

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
              placeholder="1"
              value={rowPosition}
              onChange={(e) => setRowPosition(e.target.value)}
              disabled={loading}
            />
            <Input
              type="number"
              min="1"
              max="50"
              label="Columna"
              placeholder="1"
              value={colPosition}
              onChange={(e) => setColPosition(e.target.value)}
              disabled={loading}
            />
            <Input
              label="Etiqueta posición"
              placeholder="ej. Superior der."
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
      </div>
    </div>
  );
}
