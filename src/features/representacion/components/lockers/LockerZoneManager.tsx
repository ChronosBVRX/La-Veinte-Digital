"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { ResponsiveDialog } from "@/shared/components/ui";
import { LockerBankEditor } from "./LockerBankEditor";
import type { LockerZone, LockerBank } from "@/features/representacion/lib/lockers";

interface LockerZoneManagerProps {
  isOpen: boolean;
  onClose: () => void;
  zones: LockerZone[];
  banks: LockerBank[];
  onSuccess: () => void;
}

export function LockerZoneManager({
  isOpen,
  onClose,
  zones,
  banks,
  onSuccess,
}: LockerZoneManagerProps): React.JSX.Element | null {
  const [selectedZone, setSelectedZone] = useState<LockerZone | null>(zones[0] || null);
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneBuilding, setZoneBuilding] = useState("");
  const [zoneFloor, setZoneFloor] = useState("");
  const [zoneDescription, setZoneDescription] = useState("");

  const [isBankEditorOpen, setIsBankEditorOpen] = useState(false);
  const [bankToEdit, setBankToEdit] = useState<LockerBank | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleCreateZone(): Promise<void> {
    if (!zoneName.trim()) {
      setError("El nombre de la zona es obligatorio (ej. Vestidores Planta Baja).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/union/lockers/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: zoneName.trim(),
          building: zoneBuilding.trim(),
          floor: zoneFloor.trim(),
          description: zoneDescription.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al crear zona");

      setIsCreatingZone(false);
      setZoneName("");
      setZoneBuilding("");
      setZoneFloor("");
      setZoneDescription("");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fallo al crear zona");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteZone(zoneId: string): Promise<void> {
    if (!confirm("¿Seguro que deseas eliminar esta zona? Los casilleros pasarán a estado 'Sin ubicar'.")) return;

    try {
      const res = await fetch(`/api/union/lockers/zones?id=${zoneId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar zona");
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar la zona");
    }
  }

  async function handleDeleteBank(bankId: string): Promise<void> {
    if (!confirm("¿Seguro que deseas eliminar este bloque? Los casilleros desvincularán su posición física.")) return;

    try {
      const res = await fetch(`/api/union/lockers/banks?id=${bankId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar bloque");
      onSuccess();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar el bloque");
    }
  }

  const currentZoneBanks = selectedZone ? banks.filter((b) => b.zone_id === selectedZone.id) : [];

  return (
    <>
      <ResponsiveDialog
        open={isOpen}
        onClose={onClose}
        title="Configurar Zonas y Bloques Físicos"
        description="Administración del mapa digital de casilleros de la oficina y hospital."
        size="lg"
        sheetHeight="large"
      >

        {/* Formulario para Crear Zona */}
        {isCreatingZone ? (
          <div
            style={{
              backgroundColor: "var(--accent)",
              borderRadius: "0.5rem",
              padding: "1rem",
              marginBottom: "1.5rem",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.75rem" }}>
              Nueva Zona Física
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Input
                label="Nombre de la zona"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                placeholder="Ej. Vestidores Planta Baja"
              />
              <Input
                label="Edificio / Área"
                value={zoneBuilding}
                onChange={(e) => setZoneBuilding(e.target.value)}
                placeholder="Ej. Hospital General, Ala Norte"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <Input
                label="Piso / Nivel"
                value={zoneFloor}
                onChange={(e) => setZoneFloor(e.target.value)}
                placeholder="Ej. PB, Nivel 1"
              />
              <Input
                label="Descripción (opcional)"
                value={zoneDescription}
                onChange={(e) => setZoneDescription(e.target.value)}
                placeholder="Observaciones o referencia de acceso"
              />
            </div>
            {error && <div style={{ color: "#dc2626", fontSize: "0.75rem", marginBottom: "0.5rem" }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="ghost" size="sm" onClick={() => setIsCreatingZone(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" onClick={handleCreateZone} loading={submitting}>
                Guardar zona
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
            <Button variant="secondary" size="sm" onClick={() => setIsCreatingZone(true)}>
              + Crear nueva zona
            </Button>
          </div>
        )}

        {/* Selector de Zonas existentes */}
        <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "1.25rem" }}>
          {zones.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setSelectedZone(z)}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "0.375rem",
                border: selectedZone?.id === z.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: selectedZone?.id === z.id ? "#eff6ff" : "var(--card)",
                color: selectedZone?.id === z.id ? "#1e40af" : "var(--fg)",
                fontWeight: 600,
                fontSize: "0.8125rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {z.name}
            </button>
          ))}
        </div>

        {/* Detalle de la Zona Seleccionada y sus Bloques */}
        {selectedZone ? (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
                  Bloques en {selectedZone.name}
                </span>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {currentZoneBanks.length} bloques configurados
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ color: "#dc2626" }}
                  onClick={() => handleDeleteZone(selectedZone.id)}
                >
                  Eliminar zona
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setBankToEdit(null);
                    setIsBankEditorOpen(true);
                  }}
                >
                  + Agregar bloque
                </Button>
              </div>
            </div>

            {/* Lista de bloques de esta zona */}
            {currentZoneBanks.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem", backgroundColor: "var(--accent)", borderRadius: "0.5rem" }}>
                No hay bloques creados en esta zona. Haz clic en <strong>+ Agregar bloque</strong> para definir un mueble físico.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {currentZoneBanks.map((bank) => (
                  <div
                    key={bank.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.75rem 1rem",
                      borderRadius: "0.375rem",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "0.875rem", color: "var(--fg)" }}>
                        {bank.name}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.5rem" }}>
                        ({bank.rows} filas × {bank.columns} columnas · {bank.rows * bank.columns} posiciones)
                      </span>
                      {bank.description && (
                        <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{bank.description}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setBankToEdit(bank);
                          setIsBankEditorOpen(true);
                        }}
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          borderRadius: "0.25rem",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBank(bank.id)}
                        style={{
                          background: "none",
                          border: "1px solid #fecaca",
                          color: "#dc2626",
                          borderRadius: "0.25rem",
                          padding: "0.25rem 0.5rem",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
            Crea tu primera zona para empezar a organizar los casilleros.
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </ResponsiveDialog>

      {/* Editor de Bloque */}
      {isBankEditorOpen && selectedZone && (
        <LockerBankEditor
          isOpen={isBankEditorOpen}
          onClose={() => setIsBankEditorOpen(false)}
          zone={selectedZone}
          bankToEdit={bankToEdit}
          onSuccess={onSuccess}
        />
      )}
    </>
  );
}
