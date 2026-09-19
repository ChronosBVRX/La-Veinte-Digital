"use client";

import { memo } from "react";
import type { LockerMapItem } from "@/features/representacion/lib/lockers";

interface LockerDoorProps {
  locker: LockerMapItem;
  isHighlighted?: boolean;
  onClick: (locker: LockerMapItem) => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>, locker: LockerMapItem) => void;
  onMouseLeave?: () => void;
}

export const LockerDoor = memo(function LockerDoor({
  locker,
  isHighlighted,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: LockerDoorProps): React.JSX.Element {
  const eff = locker.effective_state;
  const badge = eff.badge;
  const asg = locker.active_assignment;
  const workerName = asg?.worker_name || "";
  const employeeNumber = asg?.employee_number || "";

  // Accesibilidad: descripción para lectores de pantalla
  const ariaDescription = `Casillero número ${locker.locker_number}, estado ${eff.label}${
    asg ? `, asignado a ${workerName} con matrícula ${employeeNumber}` : ""
  }${eff.hasDiscrepancy ? `, con incidencia: ${eff.discrepancyMessage || "por revisar"}` : ""}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaDescription}
      onClick={() => onClick(locker)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(locker);
        }
      }}
      onMouseEnter={(e) => onMouseEnter?.(e, locker)}
      onMouseLeave={onMouseLeave}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "108px",
        minWidth: "92px",
        padding: "0.5rem 0.45rem",
        borderRadius: "0.375rem",
        backgroundColor: eff.isAvailable ? "#f8fafc" : badge.bg,
        border: `1.5px solid ${isHighlighted ? "#2563eb" : badge.border}`,
        boxShadow: isHighlighted
          ? "0 0 0 3px rgba(37, 99, 235, 0.35), 0 4px 6px -1px rgba(0, 0, 0, 0.1)"
          : "0 1px 2px rgba(0, 0, 0, 0.04)",
        cursor: "pointer",
        userSelect: "none",
        transition: "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease",
        transform: isHighlighted ? "scale(1.04)" : "scale(1)",
        zIndex: isHighlighted ? 10 : 1,
        outline: "none",
      }}
    >
      {/* Detalle visual metálico: ranura superior de ventilación / identificador */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          paddingBottom: "0.25rem",
          borderBottom: "1px dashed rgba(0, 0, 0, 0.08)",
        }}
      >
        {/* Número de Locker muy visible */}
        <span
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
            color: "var(--fg)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {locker.locker_number}
        </span>

        {/* Pequeño punto/muesca de cerradura */}
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: badge.dotColor,
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
          }}
          title={eff.label}
        />
      </div>

      {/* Cuerpo central: ocupante o estado disponible */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0.25rem 0",
          overflow: "hidden",
        }}
      >
        {asg ? (
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: badge.color,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
              title={workerName}
            >
              {workerName}
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                color: "var(--muted)",
                fontVariantNumeric: "tabular-nums",
                marginTop: "0.1rem",
              }}
            >
              Mat. {employeeNumber}
            </div>
          </div>
        ) : eff.kind === "pending_review" ? (
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: badge.color, display: "flex", alignItems: "center", gap: "0.2rem" }}>
              <span>⚠</span>
              <span>Revisar</span>
            </div>
            {locker.pending_review?.source_worker_name && (
              <div
                style={{
                  fontSize: "0.625rem",
                  color: "var(--muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: "0.1rem",
                }}
              >
                {locker.pending_review.source_worker_name}
              </div>
            )}
          </div>
        ) : eff.kind === "maintenance" ? (
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: badge.color, display: "flex", alignItems: "center", gap: "0.2rem" }}>
              <span>🛠</span>
              <span>Reparación</span>
            </div>
            <div style={{ fontSize: "0.625rem", color: "var(--muted)", marginTop: "0.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {locker.maintenance_reason || "Reportado"}
            </div>
          </div>
        ) : eff.kind === "blocked" ? (
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: badge.color, display: "flex", alignItems: "center", gap: "0.2rem" }}>
              <span>🔒</span>
              <span>Bloqueado</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: badge.color }}>
              Libre
            </div>
          </div>
        )}
      </div>

      {/* Pie de puerta: insignia accesible (icono + texto corto) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.625rem",
          fontWeight: 600,
          color: badge.color,
          paddingTop: "0.2rem",
          borderTop: "1px dashed rgba(0, 0, 0, 0.06)",
        }}
      >
        <span style={{ fontSize: "0.7rem" }}>
          {eff.kind === "available"
            ? "✓"
            : eff.kind === "assigned"
              ? "●"
              : eff.kind === "maintenance"
                ? "🛠"
                : eff.kind === "blocked"
                  ? "🔒"
                  : eff.kind === "reserved"
                    ? "🏷"
                    : "⚠"}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {eff.kind === "available"
            ? "Disponible"
            : eff.kind === "assigned"
              ? "Asignado"
              : eff.label}
        </span>
      </div>
    </div>
  );
});
