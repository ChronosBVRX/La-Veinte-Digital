"use client";

import { useMemo } from "react";
import {
  getLockerZoneDisplayName,
  getLockerZoneGroup,
  groupLockerZones,
  type LockerZone,
  type LockerZoneGenderGroup,
} from "@/features/representacion/lib/lockers";

interface LockerZoneNavigatorProps {
  zones: LockerZone[];
  selectedZoneId: string;
  unlocatedCount: number;
  totalLockersCount: number;
  onSelectZone: (zoneId: string) => void;
  isAdmin?: boolean;
  onConfigureZones?: () => void;
}

function sumZoneStats(list: LockerZone[]): {
  total: number;
  occupied: number;
  free: number;
  attention: number;
} {
  let total = 0;
  let occupied = 0;
  let free = 0;
  let attention = 0;
  for (const z of list) {
    total += z.total_lockers ?? 0;
    occupied += z.assigned_lockers ?? 0;
    free += z.available_lockers ?? 0;
    attention += z.attention_lockers ?? 0;
  }
  return { total, occupied, free, attention };
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
  const grouped = useMemo(() => groupLockerZones(zones), [zones]);
  const womenStats = useMemo(() => sumZoneStats(grouped.women), [grouped.women]);
  const menStats = useMemo(() => sumZoneStats(grouped.men), [grouped.men]);
  const generalStats = useMemo(() => sumZoneStats(grouped.general), [grouped.general]);

  // Si selectedZoneId es "all" (default inicial), enfocar automáticamente la primera zona disponible (Mujeres #1)
  const effectiveZoneId = useMemo(() => {
    if (selectedZoneId === "all" && zones.length > 0) {
      return (grouped.women[0] ?? zones[0]).id;
    }
    return selectedZoneId;
  }, [selectedZoneId, zones, grouped.women]);

  const selectedZoneObj = useMemo(
    () => zones.find((z) => z.id === effectiveZoneId) ?? null,
    [zones, effectiveZoneId],
  );

  const activeGroup: LockerZoneGenderGroup | "all_zones" | "unlocated" = useMemo(() => {
    if (effectiveZoneId === "unlocated") return "unlocated";
    if (effectiveZoneId === "all_zones") return "all_zones";
    if (selectedZoneObj) {
      return getLockerZoneGroup(selectedZoneObj.name);
    }
    if (grouped.women.length > 0) return "women";
    if (grouped.men.length > 0) return "men";
    return "general";
  }, [effectiveZoneId, selectedZoneObj, grouped.women.length, grouped.men.length]);

  const currentGroupZones = useMemo(() => {
    if (!grouped.hasGenderSplit) return zones;
    if (activeGroup === "women") return grouped.women;
    if (activeGroup === "men") return grouped.men;
    if (activeGroup === "general") return grouped.general;
    return [];
  }, [grouped, activeGroup, zones]);

  const currentIndexInGroup = useMemo(() => {
    if (!selectedZoneObj) return -1;
    return currentGroupZones.findIndex((z) => z.id === selectedZoneObj.id);
  }, [currentGroupZones, selectedZoneObj]);

  const prevZone = currentIndexInGroup > 0 ? currentGroupZones[currentIndexInGroup - 1] : null;
  const nextZone =
    currentIndexInGroup >= 0 && currentIndexInGroup < currentGroupZones.length - 1
      ? currentGroupZones[currentIndexInGroup + 1]
      : null;

  return (
    <div
      style={{
        marginBottom: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.875rem",
      }}
    >
      {/* Encabezado y botón de configuración */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
            Zonas Físicas de Casilleros
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.1rem" }}>
            1. Elige <strong>Mujeres</strong> u <strong>Hombres</strong> · 2. Explora cada zona de una en una
          </div>
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
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              cursor: "pointer",
              padding: "0.375rem 0.75rem",
              borderRadius: "0.375rem",
            }}
          >
            <span>⚙</span>
            <span>Configurar Zonas y Muebles</span>
          </button>
        )}
      </div>

      {/* NIVEL 1: Selector principal Mujeres / Hombres / Sin ubicar / Todas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.625rem",
        }}
        role="tablist"
        aria-label="Secciones principales de casilleros"
      >
        {/* 1. Vestidores Mujeres */}
        {grouped.women.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "women"}
            onClick={() => {
              const target =
                activeGroup === "women" && selectedZoneObj
                  ? selectedZoneObj
                  : grouped.women[0];
              if (target) onSelectZone(target.id);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "0.75rem 1rem",
              borderRadius: "0.625rem",
              border: activeGroup === "women" ? "2px solid #db2777" : "1px solid var(--border)",
              backgroundColor: activeGroup === "women" ? "#fdf2f8" : "var(--card)",
              boxShadow: activeGroup === "women" ? "0 2px 8px rgba(219, 39, 119, 0.12)" : "none",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 800,
                  color: activeGroup === "women" ? "#9d174d" : "var(--fg)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span aria-hidden="true">👩</span>
                <span>Vestidores Mujeres</span>
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  backgroundColor: activeGroup === "women" ? "#fbcfe8" : "var(--accent)",
                  color: activeGroup === "women" ? "#831843" : "var(--muted)",
                }}
              >
                {grouped.women.length} zonas
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: activeGroup === "women" ? "#9d174d" : "var(--muted)", marginTop: "0.3rem" }}>
              <strong>{womenStats.total}</strong> casilleros · {womenStats.occupied} ocupados · <strong>{womenStats.free} libres</strong>
            </div>
          </button>
        )}

        {/* 2. Vestidores Hombres */}
        {grouped.men.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "men"}
            onClick={() => {
              const target =
                activeGroup === "men" && selectedZoneObj
                  ? selectedZoneObj
                  : grouped.men[0];
              if (target) onSelectZone(target.id);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "0.75rem 1rem",
              borderRadius: "0.625rem",
              border: activeGroup === "men" ? "2px solid var(--primary)" : "1px solid var(--border)",
              backgroundColor: activeGroup === "men" ? "#eff6ff" : "var(--card)",
              boxShadow: activeGroup === "men" ? "0 2px 8px rgba(37, 99, 235, 0.12)" : "none",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "0.5rem" }}>
              <span
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 800,
                  color: activeGroup === "men" ? "#1e40af" : "var(--fg)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span aria-hidden="true">👨</span>
                <span>Vestidores Hombres</span>
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  backgroundColor: activeGroup === "men" ? "#bfdbfe" : "var(--accent)",
                  color: activeGroup === "men" ? "#1e3a8a" : "var(--muted)",
                }}
              >
                {grouped.men.length} zonas
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: activeGroup === "men" ? "#1e40af" : "var(--muted)", marginTop: "0.3rem" }}>
              <strong>{menStats.total}</strong> casilleros · {menStats.occupied} ocupados · <strong>{menStats.free} libres</strong>
            </div>
          </button>
        )}

        {/* 2b. Zonas generales (si existieran zonas sin sufijo Mujeres/Hombres) */}
        {grouped.hasGenderSplit && grouped.general.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={activeGroup === "general"}
            onClick={() => {
              const firstGenZone = grouped.general[0];
              if (firstGenZone) onSelectZone(firstGenZone.id);
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              padding: "0.75rem 1rem",
              borderRadius: "0.625rem",
              border: activeGroup === "general" ? "2px solid #0f766e" : "1px solid var(--border)",
              backgroundColor: activeGroup === "general" ? "#f0fdfa" : "var(--card)",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.9375rem", fontWeight: 800, color: activeGroup === "general" ? "#115e59" : "var(--fg)" }}>
                🏢 Otras Zonas
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  backgroundColor: "var(--accent)",
                  color: "var(--muted)",
                }}
              >
                {grouped.general.length} zonas
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.3rem" }}>
              <strong>{generalStats.total}</strong> casilleros · {generalStats.free} libres
            </div>
          </button>
        )}

        {/* 3. Sin ubicar */}
        <button
          type="button"
          role="tab"
          aria-selected={effectiveZoneId === "unlocated"}
          onClick={() => onSelectZone("unlocated")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "0.75rem 1rem",
            borderRadius: "0.625rem",
            border:
              effectiveZoneId === "unlocated"
                ? "2px solid #ea580c"
                : unlocatedCount > 0
                  ? "1px dashed #fdba74"
                  : "1px solid var(--border)",
            backgroundColor: effectiveZoneId === "unlocated" ? "#fff7ed" : "var(--card)",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.9375rem",
                fontWeight: 800,
                color: unlocatedCount > 0 ? "#c2410c" : "var(--fg)",
              }}
            >
              {unlocatedCount > 0 ? "⚠ Sin ubicar" : "✓ Sin ubicar"}
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                backgroundColor: unlocatedCount > 0 ? "#ea580c" : "var(--accent)",
                color: unlocatedCount > 0 ? "#ffffff" : "var(--muted)",
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                fontWeight: 700,
              }}
            >
              {unlocatedCount}
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: unlocatedCount > 0 ? "#c2410c" : "var(--muted)", marginTop: "0.3rem" }}>
            {unlocatedCount > 0 ? "Pendientes de asignar zona física" : "Todos los casilleros ubicados"}
          </div>
        </button>

        {/* 4. Vista global: Todas las zonas */}
        <button
          type="button"
          role="tab"
          aria-selected={effectiveZoneId === "all_zones"}
          onClick={() => onSelectZone("all_zones")}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "0.75rem 1rem",
            borderRadius: "0.625rem",
            border: effectiveZoneId === "all_zones" ? "2px solid #475569" : "1px solid var(--border)",
            backgroundColor: effectiveZoneId === "all_zones" ? "#f1f5f9" : "var(--card)",
            cursor: "pointer",
            textAlign: "left",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.9375rem",
                fontWeight: 700,
                color: effectiveZoneId === "all_zones" ? "#0f172a" : "var(--fg)",
              }}
            >
              🗺 Todas las zonas
            </span>
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "0.15rem 0.5rem",
                borderRadius: "9999px",
                backgroundColor: "var(--accent)",
                color: "var(--muted)",
              }}
            >
              {zones.length} zonas
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.3rem" }}>
            Vista completa ({totalLockersCount} casilleros)
          </div>
        </button>
      </div>

      {/* NIVEL 2: Zonas individuales de la sección seleccionada (una por una) */}
      {currentGroupZones.length > 0 && (
        <div
          style={{
            backgroundColor: activeGroup === "women" ? "#fdf2f8" : activeGroup === "men" ? "#f0f7ff" : "var(--accent)",
            border:
              activeGroup === "women"
                ? "1px solid #fbcfe8"
                : activeGroup === "men"
                  ? "1px solid #bfdbfe"
                  : "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "0.875rem 1rem",
          }}
        >
          {/* Barra superior de Nivel 2: indicador "Zona X de N" + botones Anterior / Siguiente */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "0.2rem 0.55rem",
                  borderRadius: "0.375rem",
                  backgroundColor: activeGroup === "women" ? "#db2777" : activeGroup === "men" ? "#2563eb" : "#0f766e",
                  color: "#ffffff",
                }}
              >
                {activeGroup === "women"
                  ? "👩 Zonas de Mujeres"
                  : activeGroup === "men"
                    ? "👨 Zonas de Hombres"
                    : "🏢 Zonas"}
              </span>
              {selectedZoneObj && currentIndexInGroup >= 0 && (
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>
                  Zona {currentIndexInGroup + 1} de {currentGroupZones.length}:{" "}
                  <span style={{ color: activeGroup === "women" ? "#9d174d" : "#1e40af" }}>
                    {getLockerZoneDisplayName(selectedZoneObj.name)}
                  </span>
                </span>
              )}
            </div>

            {/* Controles paso a paso: Zona anterior / Siguiente zona */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <button
                type="button"
                disabled={!prevZone}
                onClick={() => {
                  if (prevZone) onSelectZone(prevZone.id);
                }}
                style={{
                  padding: "0.3rem 0.65rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  backgroundColor: prevZone ? "var(--card)" : "transparent",
                  color: prevZone ? "var(--fg)" : "var(--muted)",
                  opacity: prevZone ? 1 : 0.45,
                  cursor: prevZone ? "pointer" : "not-allowed",
                }}
                title={prevZone ? `Ir a ${getLockerZoneDisplayName(prevZone.name)}` : "Primera zona de esta sección"}
              >
                ‹ Zona anterior
              </button>
              <button
                type="button"
                disabled={!nextZone}
                onClick={() => {
                  if (nextZone) onSelectZone(nextZone.id);
                }}
                style={{
                  padding: "0.3rem 0.65rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  borderRadius: "0.375rem",
                  border: "1px solid var(--border)",
                  backgroundColor: nextZone ? "var(--card)" : "transparent",
                  color: nextZone ? "var(--fg)" : "var(--muted)",
                  opacity: nextZone ? 1 : 0.45,
                  cursor: nextZone ? "pointer" : "not-allowed",
                }}
                title={nextZone ? `Ir a ${getLockerZoneDisplayName(nextZone.name)}` : "Última zona de esta sección"}
              >
                Siguiente zona ›
              </button>
            </div>
          </div>

          {/* Grilla de tarjetas de cada zona individual dentro de la sección activa */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(185px, 1fr))",
              gap: "0.5rem",
            }}
            role="tablist"
            aria-label="Zonas individuales de la sección activa"
          >
            {currentGroupZones.map((zone, idx) => {
              const isSelected = effectiveZoneId === zone.id;
              const total = zone.total_lockers ?? 0;
              const occupied = zone.assigned_lockers ?? 0;
              const free = zone.available_lockers ?? 0;
              const attention = zone.attention_lockers ?? 0;
              const shortName = getLockerZoneDisplayName(zone.name);
              const accentColor = activeGroup === "women" ? "#db2777" : "#2563eb";
              const accentText = activeGroup === "women" ? "#9d174d" : "#1e40af";

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
                    justifyContent: "space-between",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: isSelected ? `2px solid ${accentColor}` : "1px solid var(--border)",
                    backgroundColor: isSelected ? "#ffffff" : "rgba(255, 255, 255, 0.78)",
                    boxShadow: isSelected ? "0 2px 6px rgba(15, 23, 42, 0.08)" : "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      width: "100%",
                      gap: "0.375rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 800,
                          minWidth: "20px",
                          height: "20px",
                          borderRadius: "9999px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: isSelected ? accentColor : "#e2e8f0",
                          color: isSelected ? "#ffffff" : "#475569",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span
                        style={{
                          fontSize: "0.8125rem",
                          fontWeight: isSelected ? 800 : 600,
                          color: isSelected ? accentText : "var(--fg)",
                          lineHeight: 1.25,
                        }}
                      >
                        {shortName}
                      </span>
                    </div>

                    {attention > 0 && (
                      <span
                        style={{
                          fontSize: "0.625rem",
                          backgroundColor: "#fed7aa",
                          color: "#c2410c",
                          padding: "0.05rem 0.35rem",
                          borderRadius: "9999px",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                        title={`${attention} por revisar en esta zona`}
                      >
                        !{attention}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      fontSize: "0.7rem",
                      color: "var(--muted)",
                      marginTop: "0.4rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 700, color: "var(--fg)" }}>{total} lockers</span>
                    <span>·</span>
                    <span>{occupied} ocup.</span>
                    <span>·</span>
                    <span style={{ fontWeight: 600, color: free > 0 ? "#166534" : "var(--muted)" }}>
                      {free} lib.
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
