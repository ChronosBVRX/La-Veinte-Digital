"use client";

import { useMemo } from "react";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { LockerBankGrid } from "./LockerBankGrid";
import { LockerDoor } from "./LockerDoor";
import type { LockerZone, LockerBank, LockerMapItem } from "@/features/representacion/lib/lockers";

interface LockerZoneMapProps {
  zones: LockerZone[];
  banks: LockerBank[];
  lockers: LockerMapItem[];
  selectedZoneId: string;
  highlightedLockerId?: string | null;
  onLockerClick: (locker: LockerMapItem) => void;
  onLockerHover?: (e: React.MouseEvent<HTMLDivElement>, locker: LockerMapItem) => void;
  onLockerLeave?: () => void;
  isAdmin?: boolean;
  onConfigureMap?: () => void;
  onEditBank?: (bank: LockerBank) => void;
}

export function LockerZoneMap({
  zones,
  banks,
  lockers,
  selectedZoneId,
  highlightedLockerId,
  onLockerClick,
  onLockerHover,
  onLockerLeave,
  isAdmin,
  onConfigureMap,
  onEditBank,
}: LockerZoneMapProps): React.JSX.Element {
  // 1. Vista de Sin Ubicar
  const unlocatedLockers = useMemo(() => {
    return lockers.filter((l) => !l.zone_id || !l.bank_id);
  }, [lockers]);

  if (selectedZoneId === "unlocated") {
    return (
      <div>
        <Card
          padding="1.25rem 1.5rem"
          style={{
            backgroundColor: "#fff7ed",
            borderColor: "#fed7aa",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>⚠</span>
                <span style={{ fontSize: "1rem", fontWeight: 700, color: "#9a3412" }}>
                  {unlocatedLockers.length} casilleros todavía no tienen ubicación física configurada
                </span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "#c2410c", marginTop: "0.25rem", marginBottom: 0 }}>
                Estos casilleros existen formalmente en el inventario sindical, pero no se encuentran ubicados en ninguna zona ni mueble del mapa.
              </p>
            </div>
            {isAdmin && onConfigureMap && (
              <Button variant="primary" size="sm" onClick={onConfigureMap}>
                Organizar casilleros en zonas
              </Button>
            )}
          </div>
        </Card>

        {unlocatedLockers.length === 0 ? (
          <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
            ¡Excelente! Todos los casilleros de la delegación tienen una ubicación física configurada.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
              gap: "0.5rem",
            }}
          >
            {unlocatedLockers.map((locker) => (
              <LockerDoor
                key={locker.id}
                locker={locker}
                isHighlighted={highlightedLockerId === locker.id}
                onClick={onLockerClick}
                onMouseEnter={onLockerHover}
                onMouseLeave={onLockerLeave}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 2. Si no hay zonas configuradas en la delegación
  if (zones.length === 0) {
    return (
      <Card padding="3rem 1.5rem" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🗺</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.5rem" }}>
          Mapa físico aún no configurado
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", maxWidth: "480px", margin: "0 auto 1.5rem" }}>
          Los <strong>{lockers.length}</strong> casilleros de esta delegación se encuentran registrados pero aún no se han organizado en zonas (ej. Vestidores Planta Baja, Piso 1) y bloques.
        </p>
        {isAdmin && onConfigureMap ? (
          <Button variant="primary" size="md" onClick={onConfigureMap}>
            Crear primera zona y organizar casilleros
          </Button>
        ) : (
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            Consulta con un administrador sindical para configurar el mapa físico.
          </div>
        )}
      </Card>
    );
  }

  // 3. Vista de una zona específica
  const activeZone = zones.find((z) => z.id === selectedZoneId);
  const activeZones = activeZone ? [activeZone] : zones;

  return (
    <div>
      {activeZones.map((zone) => {
        const zoneBanks = banks.filter((b) => b.zone_id === zone.id);
        const zoneLockers = lockers.filter((l) => l.zone_id === zone.id);

        return (
          <div key={zone.id} style={{ marginBottom: "2.5rem" }}>
            {/* Título de la zona si se muestran todas */}
            {selectedZoneId === "all" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                  paddingBottom: "0.5rem",
                  borderBottom: "2px solid var(--border)",
                }}
              >
                <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--fg)" }}>
                  {zone.name}
                </span>
                {zone.building && (
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    Edificio: {zone.building} {zone.floor ? `· ${zone.floor}` : ""}
                  </span>
                )}
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "auto" }}>
                  {zoneLockers.length} casilleros
                </span>
              </div>
            )}

            {zoneBanks.length === 0 ? (
              <Card padding="2rem" style={{ textAlign: "center", backgroundColor: "var(--accent)" }}>
                <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                  Esta zona no tiene bloques o muebles configurados.
                </div>
                {isAdmin && onConfigureMap && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <Button variant="secondary" size="sm" onClick={onConfigureMap}>
                      Agregar bloque a {zone.name}
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              zoneBanks.map((bank) => {
                const bankLockers = zoneLockers.filter((l) => l.bank_id === bank.id);
                return (
                  <LockerBankGrid
                    key={bank.id}
                    bank={bank}
                    lockers={bankLockers}
                    highlightedLockerId={highlightedLockerId}
                    onLockerClick={onLockerClick}
                    onLockerHover={onLockerHover}
                    onLockerLeave={onLockerLeave}
                    isAdmin={isAdmin}
                    onEditBank={onEditBank}
                  />
                );
              })
            )}

            {/* Casilleros en esta zona sin bloque asignado */}
            {zoneLockers.filter((l) => !l.bank_id).length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.5rem" }}>
                  Casilleros en {zone.name} sin bloque específico:
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
                    gap: "0.5rem",
                  }}
                >
                  {zoneLockers
                    .filter((l) => !l.bank_id)
                    .map((locker) => (
                      <LockerDoor
                        key={locker.id}
                        locker={locker}
                        isHighlighted={highlightedLockerId === locker.id}
                        onClick={onLockerClick}
                        onMouseEnter={onLockerHover}
                        onMouseLeave={onLockerLeave}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
