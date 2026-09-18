"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Warning } from "@phosphor-icons/react";
import { Card } from "@/shared/components/ui/Card";
import type { UnionDashboardSummary } from "../lib/dashboard-format";
import { UnionControlHero } from "./dashboard/UnionControlHero";
import { UnionMetricsBar } from "./dashboard/UnionMetricsBar";
import { UnionActionCenter } from "./dashboard/UnionActionCenter";
import { UnionAttentionList } from "./dashboard/UnionAttentionList";
import { UnionRecentActivity } from "./dashboard/UnionRecentActivity";

export interface DashboardClientProps {
  initialData?: UnionDashboardSummary | null;
  isAdmin?: boolean;
}

export function DashboardClient({
  initialData = null,
  isAdmin = false,
}: DashboardClientProps): React.JSX.Element {
  const [data, setData] = useState<UnionDashboardSummary | null>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/union/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo actualizar el tablero");
      const json = (await res.json()) as UnionDashboardSummary;
      setData(json);
    } catch {
      setError("No se pudo actualizar la información más reciente.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Si no se proporcionó initialData, cargar en cliente
  useEffect(() => {
    if (!initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
      void refreshDashboard();
    }
  }, [initialData, refreshDashboard]);

  // Si hay error severo y no hay datos previos
  if (error && !data) {
    return (
      <Card padding="1.5rem">
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <Warning size={32} weight="bold" style={{ color: "var(--primary, #2563eb)", marginBottom: "0.5rem" }} />
          <p role="alert" style={{ margin: "0 0 1rem", fontSize: "0.9375rem", color: "var(--fg, #0f172a)" }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => void refreshDashboard()}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--primary, #2563eb)",
              color: "var(--primary-fg, #fff)",
              border: "none",
              borderRadius: "var(--radius, 0.375rem)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </Card>
    );
  }

  // Si sigue cargando y no hay datos
  if (!data) {
    return (
      <div style={{ padding: "1.5rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ height: "96px", background: "var(--accent, #f1f5f9)", borderRadius: "var(--radius-lg, 0.75rem)", animation: "pulse 1.5s infinite" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{ height: "88px", background: "var(--accent, #f1f5f9)", borderRadius: "var(--radius-lg, 0.75rem)", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "0.875rem" }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: "130px", background: "var(--accent, #f1f5f9)", borderRadius: "var(--radius-lg, 0.75rem)", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  const { metrics, attentionItems, recentActivity, delegation } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 1. HERO INSTITUCIONAL + BUSCADOR INTEGRADO */}
      <UnionControlHero delegation={delegation} />

      {/* 2. FRANJA UNIFICADA DE CONTROL ("SITUACIÓN ACTUAL") */}
      <UnionMetricsBar
        metrics={metrics}
        refreshing={refreshing}
        onRefresh={() => void refreshDashboard()}
      />

      {/* 3. CENTRO OPERATIVO: "¿QUÉ QUIERES HACER?" */}
      <UnionActionCenter metrics={metrics} isAdmin={isAdmin} />

      {/* 4. TAREAS PENDIENTES ("REQUIERE TU ATENCIÓN") */}
      <UnionAttentionList
        attentionItems={attentionItems}
        attentionCount={metrics.attentionCount}
      />

      {/* 5. TIMELINE ("ACTIVIDAD RECIENTE") */}
      <UnionRecentActivity recentActivity={recentActivity} />
    </div>
  );
}
