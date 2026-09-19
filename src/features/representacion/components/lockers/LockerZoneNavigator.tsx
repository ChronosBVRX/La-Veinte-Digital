"use client";

import type { LockerZone } from "@/features/representacion/lib/lockers";

interface LockerZoneNavigatorProps {
  zones: LockerZone[];
  selectedZoneId: string;
  unlocatedCount: number;
  totalLockersCount: number;
  onSelectZone: (zoneId: string) => void;
  isAdmin?: boolean;
  onConfigureZones?: () => void;
}

export function LockerZoneNavigator({
  zones,
  selectedZoneId,
  unlocatedCount,
  totalLockersCount,
  onSelectZone,
  isAdmin,
  onConfigureZones,
}: LockerZoneNavigatorProps): React.JSX.Element {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
          Zonas Físicas de Casilleros
        </div>
        {isAdmin && onConfigureZones && (
          <button
            type="button"
            onClick={onConfigureZones}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              color: "var(--primary)",
              fontWeight: 600,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
            }}
          >
            <span>⚙</span>
            <span>Configurar Zonas y Muebles</span>
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.375rem",
          scrollbarWidth: "thin",
        }}
        role="tablist"
        aria-label="Navegación de zonas de casilleros"
      >
        {/* Pestaña: Todas las zonas */}
        <button
          type="button"
          role="tab"
          aria-selected={selectedZoneId === "all"}
          onClick={() => onSelectZone("all")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "0.5rem 0.875rem",
            borderRadius: "0.5rem",
            border: selectedZoneId === "all" ? "2px solid var(--primary)" : "1px solid var(--border)",
            backgroundColor: selectedZoneId === "all" ? "#eff6ff" : "var(--card)",
            cursor: "pointer",
            textAlign: "left",
            minWidth: "120px",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
        >
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: selectedZoneId === "all" ? 700 : 600,
              color: selectedZoneId === "all" ? "#1e40af" : "var(--fg)",
            }}
          >
            Todas las zonas
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem" }}>
            {totalLockersCount} casilleros
          </div>
        </button>

        {/* Pestañas de zonas configuradas */}
        {zones.map((zone) => {
          const isSelected = selectedZoneId === zone.id;
          const total = zone.total_lockers ?? 0;
          const occupied = zone.assigned_lockers ?? 0;
          const free = zone.available_lockers ?? 0;
          const attention = zone.attention_lockers ?? 0;

          return (
            <button
              key={zone.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectZone(zone.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "0.5rem 0.875rem",
                borderRadius: "0.5rem",
                border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                backgroundColor: isSelected ? "#eff6ff" : "var(--card)",
                cursor: "pointer",
                textAlign: "left",
                minWidth: "140px",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "0.25rem" }}>
                <span
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: isSelected ? 700 : 600,
                    color: isSelected ? "#1e40af" : "var(--fg)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {zone.name}
                </span>
                {attention > 0 && (
                  <span
                    style={{
                      fontSize: "0.625rem",
                      backgroundColor: "#fed7aa",
                      color: "#c2410c",
                      padding: "0.05rem 0.3rem",
                      borderRadius: "9999px",
                      fontWeight: 700,
                    }}
                    title={`${attention} por revisar en esta zona`}
                  >
                    !{attention}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                {total} lockers · {occupied} ocup. · {free} lib.
              </div>
            </button>
          );
        })}

        {/* Pestaña: Sin ubicar */}
        <button
          type="button"
          role="tab"
          aria-selected={selectedZoneId === "unlocated"}
          onClick={() => onSelectZone("unlocated")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "0.5rem 0.875rem",
            borderRadius: "0.5rem",
            border: selectedZoneId === "unlocated" ? "2px solid #ea580c" : unlocatedCount > 0 ? "1px dashed #fed7aa" : "1px solid var(--border)",
            backgroundColor: selectedZoneId === "unlocated" ? "#fff7ed" : "var(--card)",
            cursor: "pointer",
            textAlign: "left",
            minWidth: "140px",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", width: "100%" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: selectedZoneId === "unlocated" ? 700 : 600, color: unlocatedCount > 0 ? "#c2410c" : "var(--fg)" }}>
              {unlocatedCount > 0 ? "⚠ Sin ubicar" : "Sin ubicar"}
            </span>
            {unlocatedCount > 0 && (
              <span
                style={{
                  fontSize: "0.625rem",
                  backgroundColor: "#ea580c",
                  color: "#ffffff",
                  padding: "0.05rem 0.35rem",
                  borderRadius: "9999px",
                  fontWeight: 700,
                  marginLeft: "auto",
                }}
              >
                {unlocatedCount}
              </span>
            )}
          </div>
          <div style={{ fontSize: "0.7rem", color: unlocatedCount > 0 ? "#c2410c" : "var(--muted)", marginTop: "0.15rem" }}>
            {unlocatedCount > 0 ? "Requieren asignar zona" : "Todos ubicados"}
          </div>
        </button>
      </div>
    </div>
  );
}
