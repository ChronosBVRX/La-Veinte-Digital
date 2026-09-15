"use client";

import type { ImportSummary } from "../../services/worker-importer/types";

interface ImportPreviewDashboardProps {
  summary: ImportSummary;
  fileName: string;
}

export function ImportPreviewDashboard({
  summary,
  fileName,
}: ImportPreviewDashboardProps): React.JSX.Element {
  const cards = [
    { label: "Total leídos", value: summary.totalRows, color: "var(--fg)" },
    { label: "Nuevos registros", value: summary.newCount, color: "#16a34a" },
    { label: "Actualizados", value: summary.updatedCount, color: "var(--primary)" },
    { label: "Sin modificaciones", value: summary.unchangedCount, color: "var(--muted)" },
    { label: "Con advertencias", value: summary.warningsCount, color: "#ca8a04" },
    { label: "Inválidos", value: summary.invalidCount, color: "#dc2626" },
    { label: "Conflictos de identidad", value: summary.conflictsCount, color: "#9333ea" },
    { label: "Ausentes en archivo", value: summary.missingInFileCount, color: "#ea580c" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Archivo analizado: <strong>{fileName}</strong>
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              padding: "0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase" }}>
              {c.label}
            </span>
            <span style={{ fontSize: "1.375rem", fontWeight: 700, color: c.color }}>
              {c.value.toLocaleString("es-MX")}
            </span>
          </div>
        ))}
      </div>

      {summary.conflictsCount > 0 ? (
        <div
          role="alert"
          style={{
            padding: "0.75rem",
            borderRadius: "0.375rem",
            backgroundColor: "#faf5ff",
            border: "1px solid #d8b4fe",
            color: "#6b21a8",
            fontSize: "0.8125rem",
          }}
        >
          <strong>⚠️ Atención:</strong> Se detectaron <strong>{summary.conflictsCount}</strong> conflicto(s) crítico(s) de identidad (matrícula coincide pero difieren RFC, CURP o NSS). Estas filas quedan retenidas por seguridad y <strong>no se aplicarán</strong> al padrón hasta su aclaración manual.
        </div>
      ) : null}

      {summary.missingInFileCount > 0 ? (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.375rem",
            backgroundColor: "#fff7ed",
            border: "1px solid #fdba74",
            color: "#9a3412",
            fontSize: "0.8125rem",
          }}
        >
          ℹ️ <strong>{summary.missingInFileCount}</strong> trabajadores registrados previamente en el padrón no aparecen en esta plantilla. Sus expedientes y casilleros <strong>se conservan intactos</strong> y se marcarán con estatus de ausencia temporal para seguimiento.
        </div>
      ) : null}
    </div>
  );
}
