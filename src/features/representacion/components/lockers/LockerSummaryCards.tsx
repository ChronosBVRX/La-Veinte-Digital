"use client";

import Link from "next/link";
import { Card } from "@/shared/components/ui/Card";

export interface LockerSummaryCounts {
  total: number;
  available: number;
  assigned: number;
  reserved: number;
  maintenance: number;
  blocked: number;
  pending: number;
}

export function LockerSummaryCards({
  counts,
  onFilterPending,
}: {
  counts: LockerSummaryCounts | null;
  onFilterPending?: () => void;
}): React.JSX.Element {
  const total = counts?.total ?? 0;
  const assigned = counts?.assigned ?? 0;
  const available = counts?.available ?? 0;
  const pending = counts?.pending ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* 4 Indicadores principales compactos con datos reales */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <Card padding="0.875rem 1rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}>
              Total de lockers
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--fg)" }}>
                {counts ? total.toLocaleString("es-MX") : "—"}
              </span>
              <span style={{ fontSize: "0.875rem" }} aria-hidden="true">🗄️</span>
            </div>
          </div>
        </Card>

        <Card padding="0.875rem 1rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1e40af" }}>
              Asignados
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#1e40af" }}>
                {counts ? assigned.toLocaleString("es-MX") : "—"}
              </span>
              <span style={{ fontSize: "0.875rem" }} aria-hidden="true">👤</span>
            </div>
          </div>
        </Card>

        <Card padding="0.875rem 1rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#166534" }}>
              Disponibles
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
              <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#166534" }}>
                {counts ? available.toLocaleString("es-MX") : "—"}
              </span>
              <span style={{ fontSize: "0.875rem" }} aria-hidden="true">🔓</span>
            </div>
          </div>
        </Card>

        <Card padding="0.875rem 1rem">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: pending > 0 ? "#c2410c" : "var(--muted)" }}>
              Por revisar
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  color: pending > 0 ? "#c2410c" : "var(--fg)",
                }}
              >
                {counts ? pending.toLocaleString("es-MX") : "—"}
              </span>
              <span style={{ fontSize: "0.875rem" }} aria-hidden="true">📋</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tarjeta de pendientes integrada (Ámbar suave, no agresivo) */}
      {counts !== null ? (
        pending > 0 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
              padding: "0.875rem 1.125rem",
              backgroundColor: "#fffbeb",
              border: "1px solid #fed7aa",
              borderRadius: "var(--radius)",
            }}
          >
            <div style={{ minWidth: "220px", flex: "1 1 280px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1rem" }} aria-hidden="true">📋</span>
                <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "#9a3412" }}>
                  Información por revisar: <strong>{pending.toLocaleString("es-MX")} pendientes</strong>
                </h3>
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "#78350f" }}>
                Hay datos de la última actualización que puedes corregir poco a poco.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              {onFilterPending ? (
                <button
                  type="button"
                  onClick={onFilterPending}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0.45rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #fdba74",
                    backgroundColor: "#ffffff",
                    color: "#9a3412",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    minHeight: 38,
                  }}
                >
                  Ver en lista
                </button>
              ) : null}
              <Link
                href="/representacion/lockers/pendientes"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.45rem 0.875rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#ea580c",
                  color: "#ffffff",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  minHeight: 38,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                Revisar pendientes →
              </Link>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 1rem",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "var(--radius)",
              fontSize: "0.8125rem",
              color: "#166534",
            }}
          >
            <span aria-hidden="true" style={{ fontWeight: 700 }}>✓</span>
            <strong>Información al día</strong>
            <span style={{ color: "#15803d" }}>— No tienes pendientes por revisar.</span>
          </div>
        )
      ) : null}
    </div>
  );
}
