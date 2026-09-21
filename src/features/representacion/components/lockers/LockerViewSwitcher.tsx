"use client";

export type LockerViewMode = "map" | "table" | "pending" | "waitlist" | "audit";

interface LockerViewSwitcherProps {
  currentView: LockerViewMode;
  onViewChange: (view: LockerViewMode) => void;
  pendingCount?: number;
  waitlistCount?: number;
}

export function LockerViewSwitcher({
  currentView,
  onViewChange,
  pendingCount = 0,
  waitlistCount = 0,
}: LockerViewSwitcherProps): React.JSX.Element {
  const views: Array<{
    id: LockerViewMode;
    label: string;
    icon: string;
    badge?: number;
    badgeColor?: string;
  }> = [
    { id: "map", label: "Mapa Físico", icon: "🗺" },
    { id: "table", label: "Inventario", icon: "📋" },
    {
      id: "pending",
      label: "Pendientes",
      icon: "⚠",
      badge: pendingCount,
      badgeColor: "#ea580c",
    },
    {
      id: "waitlist",
      label: "Lista de Espera",
      icon: "⏳",
      badge: waitlistCount > 0 ? waitlistCount : undefined,
      badgeColor: "#9333ea",
    },
    { id: "audit", label: "Recorrido Físico", icon: "🚶" },
  ];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: "var(--accent)",
        padding: "0.25rem",
        borderRadius: "0.5rem",
        gap: "0.25rem",
        border: "1px solid var(--border)",
        maxWidth: "100%",
        overflowX: "auto",
      }}
      role="tablist"
      aria-label="Vistas de casilleros"
    >
      {views.map((v) => {
        const isActive = currentView === v.id;
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onViewChange(v.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: isActive ? 600 : 500,
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: isActive ? "var(--card)" : "transparent",
              color: isActive ? "var(--fg)" : "var(--muted)",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            <span>{v.icon}</span>
            <span>{v.label}</span>
            {v.badge !== undefined && v.badge > 0 && (
              <span
                style={{
                  fontSize: "0.6875rem",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "9999px",
                  backgroundColor: v.badgeColor || "var(--primary)",
                  color: "#ffffff",
                  fontWeight: 600,
                }}
              >
                {v.badge > 999 ? "999+" : v.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
