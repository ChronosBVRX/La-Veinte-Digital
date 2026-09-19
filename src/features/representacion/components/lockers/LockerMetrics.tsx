"use client";

import { Card } from "@/shared/components/ui/Card";

export interface LockerMetricsData {
  total: number;
  assigned: number;
  available: number;
  attention: number;
  maintenance: number;
  unlocated: number;
  waitlistCount: number;
  affectedLockers?: number;
  issueCount?: number;
}

interface LockerMetricsProps {
  metrics: LockerMetricsData;
  activeFilter?: string;
  onFilterClick?: (filter: string) => void;
}

export function LockerMetrics({
  metrics,
  activeFilter,
  onFilterClick,
}: LockerMetricsProps): React.JSX.Element {
  const cards = [
    {
      id: "all",
      label: "Total de Casilleros",
      value: metrics.total,
      subtext: metrics.unlocated > 0 ? `${metrics.unlocated} sin ubicar en mapa` : "Inventario completo",
      bg: "var(--card)",
      border: "var(--border)",
      color: "var(--fg)",
      accent: "#2563eb",
    },
    {
      id: "assigned",
      label: "Asignados",
      value: metrics.assigned,
      subtext: `${metrics.total > 0 ? Math.round((metrics.assigned / metrics.total) * 100) : 0}% ocupación física`,
      bg: "#eff6ff",
      border: "#bfdbfe",
      color: "#1e40af",
      accent: "#2563eb",
    },
    {
      id: "available",
      label: "Disponibles",
      value: metrics.available,
      subtext: "Libres para asignación inmediata",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      color: "#166534",
      accent: "#16a34a",
    },
    {
      id: "attention",
      label: "Requieren Atención",
      value: metrics.attention,
      subtext: metrics.issueCount && metrics.issueCount !== metrics.attention
        ? `${metrics.issueCount} situaciones detectadas`
        : metrics.attention > 0
          ? `${metrics.attention} casilleros con incidencia`
          : "Inventario al día",
      bg: metrics.attention > 0 ? "#fff7ed" : "var(--card)",
      border: metrics.attention > 0 ? "#fed7aa" : "var(--border)",
      color: metrics.attention > 0 ? "#c2410c" : "var(--muted)",
      accent: "#ea580c",
    },
    {
      id: "maintenance",
      label: "En Mantenimiento",
      value: metrics.maintenance,
      subtext: "Con daño o chapa averiada",
      bg: metrics.maintenance > 0 ? "#fffbeb" : "var(--card)",
      border: metrics.maintenance > 0 ? "#fde68a" : "var(--border)",
      color: metrics.maintenance > 0 ? "#b45309" : "var(--muted)",
      accent: "#d97706",
    },
    {
      id: "waitlist",
      label: "Lista de Espera",
      value: metrics.waitlistCount,
      subtext: "Solicitudes de casillero",
      bg: "var(--card)",
      border: "var(--border)",
      color: "var(--fg)",
      accent: "#9333ea",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.25rem",
      }}
    >
      {cards.map((c) => {
        const isSelected = activeFilter === c.id;
        return (
          <div
            key={c.id}
            onClick={() => onFilterClick?.(c.id)}
            style={{ cursor: onFilterClick ? "pointer" : "default" }}
            role={onFilterClick ? "button" : undefined}
            tabIndex={onFilterClick ? 0 : undefined}
          >
            <Card
              padding="0.875rem 1rem"
              style={{
                backgroundColor: isSelected ? c.bg : "var(--card)",
                borderColor: isSelected ? c.accent : c.border,
                borderWidth: isSelected ? "2px" : "1px",
                boxShadow: isSelected ? "0 4px 6px -1px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>
                {c.label}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: c.color, lineHeight: 1.1 }}>
                {c.value}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                {c.subtext}
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
