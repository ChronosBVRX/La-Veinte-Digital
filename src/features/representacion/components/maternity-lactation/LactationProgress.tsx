"use client";

import { Calendar, CheckCircle, Warning, Hourglass } from "@phosphor-icons/react";
import type { LactationResult } from "../../lib/lactation";
import { formatMexicanDate, getLactationHumanStatus } from "../../lib/maternity-lactation-ui";

export interface LactationProgressProps {
  result: LactationResult;
}

export function LactationProgress({ result }: LactationProgressProps): React.JSX.Element {
  const percent = Math.min(100, Math.max(0, Math.round((result.elapsedDays / 365) * 100)));
  const humanStatus = getLactationHumanStatus(result);

  const statusBadgeColors = {
    success: {
      bg: "rgba(22, 163, 74, 0.08)",
      color: "#15803d",
      border: "1px solid rgba(22, 163, 74, 0.25)",
      icon: CheckCircle,
    },
    warning: {
      bg: "rgba(217, 119, 6, 0.08)",
      color: "#b45309",
      border: "1px solid rgba(217, 119, 6, 0.25)",
      icon: Warning,
    },
    neutral: {
      bg: "rgba(100, 116, 139, 0.08)",
      color: "#475569",
      border: "1px solid rgba(100, 116, 139, 0.25)",
      icon: Hourglass,
    },
  }[humanStatus.badgeVariant];

  const StatusIcon = statusBadgeColors.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Encabezado y Estado Humano */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Periodo contractual
          </div>
          <h2
            style={{
              margin: "0.125rem 0 0",
              fontSize: "1.0625rem",
              fontWeight: 800,
              color: "var(--fg, #0f172a)",
              letterSpacing: "-0.01em",
            }}
          >
            365 días naturales (Cl. 77)
          </h2>
        </div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 700,
            background: statusBadgeColors.bg,
            color: statusBadgeColors.color,
            border: statusBadgeColors.border,
            padding: "0.25rem 0.625rem",
            borderRadius: "999px",
          }}
        >
          <StatusIcon size={14} weight="bold" aria-hidden="true" />
          <span>{humanStatus.label}</span>
        </span>
      </div>

      {/* Rango de fechas */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "var(--accent, #f8fafc)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius, 0.5rem)",
          padding: "0.625rem 0.875rem",
          fontSize: "0.875rem",
          color: "var(--fg, #0f172a)",
        }}
      >
        <Calendar size={18} weight="duotone" style={{ color: "#0284c7", flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <strong>{formatMexicanDate(result.periodStart, { format: "short" })}</strong>
          {" → "}
          <strong>{formatMexicanDate(result.periodEnd, { format: "short" })}</strong>
          <span style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", marginLeft: "0.5rem" }}>
            ({result.totalDays} días naturales)
          </span>
        </div>
      </div>

      {/* Barra de progreso accesible */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem" }}>
          <span style={{ color: "var(--muted, #64748b)", fontWeight: 600 }}>
            Progreso del periodo
          </span>
          <span style={{ fontWeight: 800, color: "#0284c7" }}>
            {percent}% ({result.elapsedDays} / 365 días)
          </span>
        </div>

        {/* Contenedor del progressbar */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={365}
          aria-valuenow={result.elapsedDays}
          aria-label={`Progreso de lactancia: ${result.elapsedDays} de 365 días transcurridos`}
          style={{
            width: "100%",
            height: "12px",
            background: "var(--accent, #e2e8f0)",
            borderRadius: "999px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)",
              borderRadius: "999px",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Métricas destacadas en grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.625rem",
        }}
      >
        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius, 0.5rem)",
            padding: "0.625rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.125rem",
          }}
        >
          <span style={{ fontSize: "0.6875rem", color: "var(--muted, #64748b)", fontWeight: 600, textTransform: "uppercase" }}>
            Día actual
          </span>
          <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--fg, #0f172a)" }}>
            {result.dayNumber > 0 && result.dayNumber <= 365 ? `${result.dayNumber} / 365` : result.dayNumber > 365 ? "365 / 365" : "—"}
          </span>
        </div>

        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius, 0.5rem)",
            padding: "0.625rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.125rem",
          }}
        >
          <span style={{ fontSize: "0.6875rem", color: "var(--muted, #64748b)", fontWeight: 600, textTransform: "uppercase" }}>
            Transcurridos
          </span>
          <span style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0284c7" }}>
            {result.elapsedDays} días
          </span>
        </div>

        <div
          style={{
            background: "var(--card, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "var(--radius, 0.5rem)",
            padding: "0.625rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.125rem",
          }}
        >
          <span style={{ fontSize: "0.6875rem", color: "var(--muted, #64748b)", fontWeight: 600, textTransform: "uppercase" }}>
            Restantes
          </span>
          <span
            style={{
              fontSize: "1.125rem",
              fontWeight: 800,
              color: result.remainingDays <= 30 && result.remainingDays > 0 ? "#b45309" : "var(--fg, #0f172a)",
            }}
          >
            {result.remainingDays} días
          </span>
        </div>
      </div>

      <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)" }}>
        {humanStatus.description}
      </div>
    </div>
  );
}
