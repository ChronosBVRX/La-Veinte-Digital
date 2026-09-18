"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  Folder,
  Lockers,
  FileText,
  ArrowsClockwise,
  Warning,
  CheckCircle,
  Printer,
} from "@phosphor-icons/react";
import type { UnionDashboardSummary } from "../../lib/dashboard-format";

export interface UnionMetricsBarProps {
  metrics: UnionDashboardSummary["metrics"];
  refreshing: boolean;
  onRefresh: () => void;
}

export function UnionMetricsBar({
  metrics,
  refreshing,
  onRefresh,
}: UnionMetricsBarProps): React.JSX.Element {
  const printInfo = metrics.print;
  const printTotalQueue = (printInfo?.queuedCount ?? 0) + (printInfo?.printingCount ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {/* Barra superior de estado y acciones */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          padding: "0 0.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 800,
              color: "var(--fg, #0f172a)",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
            }}
          >
            Situación actual
          </h2>

          {/* Estado de Impresión integrado como monitor operativo */}
          <Link
            href="/representacion/impresion"
            title="Ver cola y estación de impresión"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              textDecoration: "none",
              fontSize: "0.75rem",
              fontWeight: 600,
              padding: "0.2rem 0.625rem",
              borderRadius: "999px",
              border: "1px solid",
              transition: "background 0.15s ease, border-color 0.15s ease",
              ...(printInfo?.hasStation
                ? printInfo.isOnline
                  ? printTotalQueue > 0
                    ? {
                        background: "#eff6ff",
                        borderColor: "#93c5fd",
                        color: "#1d4ed8",
                      }
                    : {
                        background: "#f0fdf4",
                        borderColor: "#bbf7d0",
                        color: "#15803d",
                      }
                  : {
                      background: "#fffbeb",
                      borderColor: "#fde68a",
                      color: "#b45309",
                    }
                : {
                    background: "var(--accent, #f1f5f9)",
                    borderColor: "var(--border, #e2e8f0)",
                    color: "var(--muted, #64748b)",
                  }),
            }}
          >
            <Printer size={13} weight="bold" />
            <span>
              {printInfo?.hasStation
                ? printInfo.isOnline
                  ? printTotalQueue > 0
                    ? `● ${printTotalQueue} en cola de impresión`
                    : "● Impresora de oficina conectada"
                  : "⚠ Estación desconectada"
                : "Impresión de oficina"}
            </span>
          </Link>
        </div>

        <button
          type="button"
          aria-label="Actualizar métricas"
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            background: "transparent",
            border: "1px solid var(--border, #e2e8f0)",
            color: "var(--muted, #64748b)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: refreshing ? "default" : "pointer",
            padding: "0.25rem 0.625rem",
            borderRadius: "var(--radius, 0.375rem)",
            transition: "background 0.15s ease, color 0.15s ease",
          }}
        >
          <ArrowsClockwise
            size={13}
            weight="bold"
            className={refreshing ? "animate-spin" : undefined}
          />
          <span>{refreshing ? "Actualizando…" : "Actualizar"}</span>
        </button>
      </div>

      {/* Franja unificada de control (2 columnas en móvil, 5 en desktop) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.625rem",
        }}
      >
        {/* KPI 1: Trabajadores */}
        <Link
          href="/representacion/trabajadores"
          style={{ textDecoration: "none", color: "inherit", display: "flex" }}
        >
          <div
            style={{
              flex: 1,
              background: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius-lg, 0.75rem)",
              padding: "0.875rem 1rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted, #64748b)" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Trabajadores
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-sm, 0.375rem)",
                  background: "rgba(37, 99, 235, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary, #2563eb)",
                }}
              >
                <Users size={16} weight="bold" />
              </div>
            </div>

            <div style={{ margin: "0.375rem 0 0.25rem" }}>
              <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--fg, #0f172a)", lineHeight: 1 }}>
                {metrics.workers.error ? "No disponible" : (metrics.workers.total ?? 0)}
              </div>
            </div>

            <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
              {!metrics.workers.error && metrics.workers.active !== null ? (
                <>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a", flexShrink: 0 }} />
                  <span>{metrics.workers.active} activos</span>
                </>
              ) : (
                <span>Registrados en padrón</span>
              )}
            </div>
          </div>
        </Link>

        {/* KPI 2: Expedientes */}
        <Link
          href="/representacion/expedientes"
          style={{ textDecoration: "none", color: "inherit", display: "flex" }}
        >
          <div
            style={{
              flex: 1,
              background: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius-lg, 0.75rem)",
              padding: "0.875rem 1rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted, #64748b)" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Expedientes
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-sm, 0.375rem)",
                  background: "rgba(37, 99, 235, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary, #2563eb)",
                }}
              >
                <Folder size={16} weight="bold" />
              </div>
            </div>

            <div style={{ margin: "0.375rem 0 0.25rem" }}>
              <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--fg, #0f172a)", lineHeight: 1 }}>
                {metrics.cases.error ? "No disponible" : (metrics.cases.total ?? 0)}
              </div>
            </div>

            <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)" }}>
              Historial institucional
            </div>
          </div>
        </Link>

        {/* KPI 3: Lockers */}
        <Link
          href="/representacion/lockers"
          style={{ textDecoration: "none", color: "inherit", display: "flex" }}
        >
          <div
            style={{
              flex: 1,
              background: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius-lg, 0.75rem)",
              padding: "0.875rem 1rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted, #64748b)" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Lockers
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-sm, 0.375rem)",
                  background: "rgba(37, 99, 235, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary, #2563eb)",
                }}
              >
                <Lockers size={16} weight="bold" />
              </div>
            </div>

            <div style={{ margin: "0.375rem 0 0.25rem" }}>
              <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--fg, #0f172a)", lineHeight: 1.1 }}>
                {metrics.lockers.error
                  ? "No disponible"
                  : `${metrics.lockers.assigned ?? 0} de ${metrics.lockers.total ?? 0} asignados`}
              </div>

              {/* Barra de ocupación fina */}
              {!metrics.lockers.error && metrics.lockers.occupancyPercentage !== null ? (
                <div
                  style={{
                    width: "100%",
                    height: "4px",
                    background: "var(--accent, #e2e8f0)",
                    borderRadius: "999px",
                    marginTop: "0.375rem",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, metrics.lockers.occupancyPercentage)}%`,
                      height: "100%",
                      background: metrics.lockers.occupancyPercentage > 90 ? "#eab308" : "var(--primary, #2563eb)",
                      borderRadius: "999px",
                    }}
                  />
                </div>
              ) : null}
            </div>

            <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", display: "flex", justifyContent: "space-between" }}>
              <span>{metrics.lockers.available ?? 0} disponibles</span>
              {metrics.lockers.occupancyPercentage !== null ? (
                <span style={{ fontWeight: 600 }}>{metrics.lockers.occupancyPercentage}%</span>
              ) : null}
            </div>
          </div>
        </Link>

        {/* KPI 4: Trámites en proceso */}
        <Link
          href="/representacion/expedientes"
          style={{ textDecoration: "none", color: "inherit", display: "flex" }}
        >
          <div
            style={{
              flex: 1,
              background: "var(--card, #ffffff)",
              border: "1px solid var(--border, #e2e8f0)",
              borderRadius: "var(--radius-lg, 0.75rem)",
              padding: "0.875rem 1rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted, #64748b)" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Trámites en proceso
              </span>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "var(--radius-sm, 0.375rem)",
                  background: "rgba(37, 99, 235, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary, #2563eb)",
                }}
              >
                <FileText size={16} weight="bold" />
              </div>
            </div>

            <div style={{ margin: "0.375rem 0 0.25rem" }}>
              <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--fg, #0f172a)", lineHeight: 1 }}>
                {metrics.procedures.error ? "No disponible" : (metrics.procedures.inProgress ?? 0)}
              </div>
            </div>

            <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)" }}>
              {metrics.procedures.drafts ?? 0} borradores · {metrics.procedures.underReview ?? 0} en revisión
            </div>
          </div>
        </Link>

        {/* KPI 5: Requieren atención */}
        <div
          style={{
            flex: 1,
            background: metrics.attentionCount > 0 ? "rgba(245, 158, 11, 0.04)" : "var(--card, #ffffff)",
            border: metrics.attentionCount > 0 ? "1px solid #fde68a" : "1px solid var(--border, #e2e8f0)",
            borderLeft: metrics.attentionCount > 0 ? "4px solid #b45309" : "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius-lg, 0.75rem)",
            padding: "0.875rem 1rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted, #64748b)" }}>
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: metrics.attentionCount > 0 ? "#b45309" : "var(--muted, #64748b)",
              }}
            >
              Pendientes
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-sm, 0.375rem)",
                background: metrics.attentionCount > 0 ? "#fef3c7" : "#dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: metrics.attentionCount > 0 ? "#b45309" : "#16a34a",
              }}
            >
              {metrics.attentionCount > 0 ? (
                <Warning size={16} weight="bold" />
              ) : (
                <CheckCircle size={16} weight="bold" />
              )}
            </div>
          </div>

          <div style={{ margin: "0.375rem 0 0.25rem" }}>
            <div
              style={{
                fontSize: "1.625rem",
                fontWeight: 800,
                color: metrics.attentionCount > 0 ? "#b45309" : "#16a34a",
                lineHeight: 1,
              }}
            >
              {metrics.attentionCount}
            </div>
          </div>

          <div style={{ fontSize: "0.75rem", color: metrics.attentionCount > 0 ? "#92400e" : "#15803d", fontWeight: 500 }}>
            {metrics.attentionCount > 0 ? "Requieren atención" : "Al día sin pendientes"}
          </div>
        </div>
      </div>
    </div>
  );
}
