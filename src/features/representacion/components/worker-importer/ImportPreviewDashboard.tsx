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
    { label: "Filas detectadas", value: summary.totalRows, color: "var(--fg)" },
    { label: "Trabajadores válidos", value: summary.validWorkers ?? (summary.totalRows - (summary.missingMatricula ?? 0)), color: "#0284c7" },
    { label: "Trabajadores nuevos", value: summary.newWorkers ?? summary.newCount ?? 0, color: "#16a34a" },
    { label: "Con cambios", value: summary.updatedWorkers ?? summary.updatedCount ?? 0, color: "var(--primary)" },
    { label: "Sin cambios", value: summary.unchangedWorkers ?? summary.unchangedCount ?? 0, color: "var(--muted)" },
    { label: "Matrículas duplicadas", value: summary.duplicateMatriculas ?? 0, color: "#ea580c" },
    { label: "Sin matrícula", value: summary.missingMatricula ?? summary.invalidCount ?? 0, color: "#dc2626" },
    { label: "Lockers detectados", value: summary.lockersDetected ?? 0, color: "#0891b2" },
    { label: "Lockers nuevos", value: summary.newLockers ?? 0, color: "#059669" },
    { label: "Cambios asignación", value: summary.lockerChanges ?? 0, color: "#2563eb" },
    { label: "Lockers duplicados", value: summary.duplicateLockers ?? 0, color: "#b91c1c" },
    { label: "Conflictos", value: summary.conflicts ?? summary.conflictsCount ?? 0, color: "#9333ea" },
    { label: "Filas ignoradas", value: summary.ignoredRows ?? 0, color: "var(--muted)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Archivo analizado: <strong>{fileName}</strong>
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              padding: "0.625rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
              {c.label}
            </span>
            <span style={{ fontSize: "1.25rem", fontWeight: 700, color: c.color }}>
              {(c.value ?? 0).toLocaleString("es-MX")}
            </span>
          </div>
        ))}
      </div>

      {summary.hasSupplementarySheet ? (
        <div
          role="status"
          style={{
            padding: "0.75rem",
            borderRadius: "0.375rem",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            color: "#1e40af",
            fontSize: "0.8125rem",
          }}
        >
          📄 <strong>Hoja complementaria encontrada (Hoja3):</strong> Se detectaron aproximadamente{" "}
          <strong>{summary.supplementarySheetRows}</strong> registros adicionales. En esta versión no se sobreescribirá la información de Hoja1.
        </div>
      ) : null}

      {(summary.conflicts ?? summary.conflictsCount ?? 0) > 0 ? (
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
          <strong>⚠️ Conflictos detectados:</strong> Hay{" "}
          <strong>{summary.conflicts ?? summary.conflictsCount}</strong> conflicto(s) que requieren revisión o resolución antes de aplicar los cambios. Los conflictos no resueltos pueden ser omitidos voluntariamente.
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
          ℹ️ <strong>{summary.missingInFileCount}</strong> trabajadores registrados previamente no figuran en esta nueva base. Sus expedientes y casilleros <strong>se conservan activos e intactos</strong>; no se han borrado ni inactivado automáticamente.
        </div>
      ) : null}
    </div>
  );
}
