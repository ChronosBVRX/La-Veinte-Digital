"use client";

import { useMemo } from "react";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { LockerBankGrid } from "./LockerBankGrid";
import { LockerDoor } from "./LockerDoor";
import {
  getLockerZoneDisplayName,
  getLockerZoneGroup,
  groupLockerZones,
  type LockerZone,
  type LockerBank,
  type LockerMapItem,
} from "@/features/representacion/lib/lockers";

interface LockerZoneMapProps {
  zones: LockerZone[];
  banks: LockerBank[];
  lockers: LockerMapItem[];
  selectedZoneId: string;
  highlightedLockerId?: string | null;
  onLockerClick: (locker: LockerMapItem) => void;
  onLockerHover?: (e: React.MouseEvent<HTMLDivElement>, locker: LockerMapItem) => void;
  onLockerLeave?: () => void;
  onSelectZone?: (zoneId: string) => void;
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
  onSelectZone,
  isAdmin,
  onConfigureMap,
  onEditBank,
}: LockerZoneMapProps): React.JSX.Element {
  const grouped = useMemo(() => groupLockerZones(zones), [zones]);

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

  // 3. Resolver zona activa: cuando selectedZoneId es "all" (default inicial), mostrar la primera zona de una en una;
  //    cuando es "all_zones", mostrar todas las zonas.
  const effectiveZoneId =
    selectedZoneId === "all" ? (grouped.women[0] ?? zones[0]).id : selectedZoneId;
  const activeZone = zones.find((z) => z.id === effectiveZoneId);
  const activeZones = activeZone ? [activeZone] : zones;
  const isShowingAllZones = effectiveZoneId === "all_zones" || !activeZone;

  return (
    <div>
      {activeZones.map((zone) => {
        const zoneBanks = banks.filter((b) => b.zone_id === zone.id);
        const zoneLockers = lockers.filter((l) => l.zone_id === zone.id);
        const zoneGroup = getLockerZoneGroup(zone.name);
        const groupList =
          zoneGroup === "women"
            ? grouped.women
            : zoneGroup === "men"
              ? grouped.men
              : grouped.general;
        const idxInGroup = groupList.findIndex((z) => z.id === zone.id);
        const prevZone = idxInGroup > 0 ? groupList[idxInGroup - 1] : null;
        const nextZone =
          idxInGroup >= 0 && idxInGroup < groupList.length - 1
            ? groupList[idxInGroup + 1]
            : null;

        return (
          <div key={zone.id} style={{ marginBottom: "2.5rem" }}>
            {/* Encabezado contextual de la zona */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                flexWrap: "wrap",
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.625rem",
                backgroundColor: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
                {zoneGroup !== "general" && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      padding: "0.2rem 0.55rem",
                      borderRadius: "9999px",
                      backgroundColor: zoneGroup === "women" ? "#fdf2f8" : "#eff6ff",
                      color: zoneGroup === "women" ? "#9d174d" : "#1e40af",
                      border: zoneGroup === "women" ? "1px solid #fbcfe8" : "1px solid #bfdbfe",
                    }}
                  >
                    {zoneGroup === "women" ? "👩 MUJERES" : "👨 HOMBRES"}
                    {idxInGroup >= 0 ? ` · Zona ${idxInGroup + 1} de ${groupList.length}` : ""}
                  </span>
                )}
                <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--fg)" }}>
                  {getLockerZoneDisplayName(zone.name)}
                </span>
                {zone.building && (
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                    {zone.building} {zone.floor ? `· ${zone.floor}` : ""}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "var(--muted)",
                    backgroundColor: "var(--accent)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "9999px",
                  }}
                >
                  {zoneLockers.length} casilleros · {zone.assigned_lockers ?? 0} ocupados ·{" "}
                  <strong style={{ color: "#166534" }}>{zone.available_lockers ?? 0} disponibles</strong>
                </span>

                {!isShowingAllZones && onSelectZone && groupList.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <button
                      type="button"
                      disabled={!prevZone}
                      onClick={() => {
                        if (prevZone) onSelectZone(prevZone.id);
                      }}
                      style={{
                        padding: "0.25rem 0.55rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: "0.375rem",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--bg)",
                        color: prevZone ? "var(--fg)" : "var(--muted)",
                        opacity: prevZone ? 1 : 0.4,
                        cursor: prevZone ? "pointer" : "not-allowed",
                      }}
                      title={prevZone ? `Ir a ${getLockerZoneDisplayName(prevZone.name)}` : undefined}
                    >
                      ‹ Anterior
                    </button>
                    <button
                      type="button"
                      disabled={!nextZone}
                      onClick={() => {
                        if (nextZone) onSelectZone(nextZone.id);
                      }}
                      style={{
                        padding: "0.25rem 0.55rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: "0.375rem",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--bg)",
                        color: nextZone ? "var(--fg)" : "var(--muted)",
                        opacity: nextZone ? 1 : 0.4,
                        cursor: nextZone ? "pointer" : "not-allowed",
                      }}
                      title={nextZone ? `Ir a ${getLockerZoneDisplayName(nextZone.name)}` : undefined}
                    >
                      Siguiente ›
                    </button>
                  </div>
                )}
              </div>
            </div>

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
