"use client";

import type { LockerMapItem } from "@/features/representacion/lib/lockers";

interface LockerQuickTooltipProps {
  locker: LockerMapItem | null;
  position: { x: number; y: number } | null;
}

export function LockerQuickTooltip({
  locker,
  position,
}: LockerQuickTooltipProps): React.JSX.Element | null {
  if (!locker || !position) return null;

  const eff = locker.effective_state;
  const asg = locker.active_assignment;

  return (
    <div
      style={{
        position: "fixed",
        top: position.y + 12,
        left: Math.min(position.x + 12, typeof window !== "undefined" ? window.innerWidth - 260 : 500),
        zIndex: 9999,
        backgroundColor: "#1e293b",
        color: "#f8fafc",
        padding: "0.75rem 0.875rem",
        borderRadius: "0.5rem",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
        maxWidth: "280px",
        pointerEvents: "none",
        fontSize: "0.75rem",
        border: "1px solid #334155",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.35rem" }}>
        <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#ffffff" }}>
          Locker #{locker.locker_number}
        </span>
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            padding: "0.1rem 0.4rem",
            borderRadius: "9999px",
            backgroundColor: eff.badge.dotColor,
            color: "#ffffff",
          }}
        >
          {eff.label}
        </span>
      </div>

      {asg ? (
        <div>
          <div style={{ fontWeight: 600, color: "#93c5fd", fontSize: "0.8125rem" }}>
            {asg.worker_name}
          </div>
          <div style={{ color: "#cbd5e1", marginTop: "0.15rem" }}>
            Matrícula: <strong style={{ color: "#ffffff" }}>{asg.employee_number}</strong>
          </div>
          {asg.category && (
            <div style={{ color: "#94a3b8", fontSize: "0.7rem", marginTop: "0.1rem" }}>
              {asg.category} {asg.turn ? `· ${asg.turn}` : ""}
            </div>
          )}
          {asg.assigned_at && (
            <div style={{ color: "#64748b", fontSize: "0.65rem", marginTop: "0.25rem" }}>
              Asignado el {new Date(asg.assigned_at).toLocaleDateString("es-MX")}
            </div>
          )}
        </div>
      ) : eff.isAvailable ? (
        <div style={{ color: "#86efac" }}>
          ✓ Libre para asignación inmediata.
        </div>
      ) : (
        <div style={{ color: "#fca5a5" }}>
          {eff.description}
        </div>
      )}

      {(locker.row_position || locker.column_position) && (
        <div style={{ color: "#94a3b8", fontSize: "0.65rem", marginTop: "0.4rem", borderTop: "1px solid #334155", paddingTop: "0.3rem" }}>
          Fila {locker.row_position || "-"} · Columna {locker.column_position || "-"}
        </div>
      )}
    </div>
  );
}
