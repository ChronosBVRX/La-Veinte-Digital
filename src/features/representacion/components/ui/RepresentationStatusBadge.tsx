"use client";

export type RepresentationStatusType =
  | "available"
  | "disponible"
  | "assigned"
  | "asignado"
  | "reserved"
  | "reservado"
  | "maintenance"
  | "mantenimiento"
  | "blocked"
  | "bloqueado"
  | "pending"
  | "pendiente"
  | "review"
  | "revision"
  | "active"
  | "activo"
  | "inactive"
  | "inactivo";

interface StatusBadgeConfig {
  label: string;
  bg: string;
  fg: string;
  border: string;
  dot: string;
}

const STATUS_DICTIONARY: Record<string, StatusBadgeConfig> = {
  // Disponibles / Activos (Verde institucional)
  available: { label: "Disponible", bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  disponible: { label: "Disponible", bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  active: { label: "Activo", bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0", dot: "#22c55e" },
  activo: { label: "Activo", bg: "#f0fdf4", fg: "#15803d", border: "#bbf7d0", dot: "#22c55e" },

  // Asignados (Azul institucional)
  assigned: { label: "Asignado", bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },
  asignado: { label: "Asignado", bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" },

  // Reservados (Púrpura sobrio)
  reserved: { label: "Reservado", bg: "#faf5ff", fg: "#6b21a8", border: "#e9d5ff", dot: "#a855f7" },
  reservado: { label: "Reservado", bg: "#faf5ff", fg: "#6b21a8", border: "#e9d5ff", dot: "#a855f7" },

  // En mantenimiento (Ámbar / Naranja)
  maintenance: { label: "Mantenimiento", bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa", dot: "#f97316" },
  mantenimiento: { label: "Mantenimiento", bg: "#fff7ed", fg: "#c2410c", border: "#fed7aa", dot: "#f97316" },

  // Bloqueados (Rojo suave)
  blocked: { label: "Bloqueado", bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca", dot: "#ef4444" },
  bloqueado: { label: "Bloqueado", bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca", dot: "#ef4444" },

  // Inactivos (Gris atenuado)
  inactive: { label: "Inactivo", bg: "var(--accent)", fg: "var(--muted)", border: "var(--border)", dot: "var(--muted)" },
  inactivo: { label: "Inactivo", bg: "var(--accent)", fg: "var(--muted)", border: "var(--border)", dot: "var(--muted)" },

  // Pendientes / Por revisar (Ámbar cálido)
  pending: { label: "Por revisar", bg: "#fffbeb", fg: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  pendiente: { label: "Por revisar", bg: "#fffbeb", fg: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  review: { label: "Necesita revisión", bg: "#fffbeb", fg: "#b45309", border: "#fde68a", dot: "#f59e0b" },
  revision: { label: "Necesita revisión", bg: "#fffbeb", fg: "#b45309", border: "#fde68a", dot: "#f59e0b" },
};

const DEFAULT_CONFIG: StatusBadgeConfig = {
  label: "Desconocido",
  bg: "var(--accent)",
  fg: "var(--muted)",
  border: "var(--border)",
  dot: "var(--muted)",
};

export interface RepresentationStatusBadgeProps {
  status: string;
  label?: string;
  hasPendingReview?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

export function RepresentationStatusBadge({
  status,
  label,
  hasPendingReview = false,
  size = "md",
  style,
}: RepresentationStatusBadgeProps): React.JSX.Element {
  const normalizedKey = (status || "").trim().toLowerCase();
  const config = STATUS_DICTIONARY[normalizedKey] ?? { ...DEFAULT_CONFIG, label: status || DEFAULT_CONFIG.label };
  const displayLabel = label ?? config.label;

  const isSmall = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        padding: isSmall ? "0.125rem 0.375rem" : "0.1875rem 0.5rem",
        borderRadius: "999px",
        fontSize: isSmall ? "0.6875rem" : "0.75rem",
        fontWeight: 600,
        backgroundColor: config.bg,
        color: config.fg,
        border: `1px solid ${config.border}`,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: isSmall ? 5 : 6,
          height: isSmall ? 5 : 6,
          borderRadius: "50%",
          backgroundColor: config.dot,
          flexShrink: 0,
        }}
      />
      <span>{displayLabel}</span>

      {hasPendingReview ? (
        <span
          style={{
            marginLeft: "0.25rem",
            padding: "0.0625rem 0.25rem",
            borderRadius: "4px",
            backgroundColor: "#fffbeb",
            color: "#9a3412",
            border: "1px solid #fed7aa",
            fontSize: "0.625rem",
            fontWeight: 700,
          }}
        >
          Revisión
        </span>
      ) : null}
    </span>
  );
}
