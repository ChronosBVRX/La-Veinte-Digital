"use client";

import Link from "next/link";
import type { ImportSummary } from "../../services/worker-importer/types";

export interface ImportPreviewDashboardProps {
  summary: ImportSummary;
  fileName: string;
  domain?: "WORKER" | "LOCKER";
}

export function ImportPreviewDashboard({
  summary,
  fileName,
  domain = "WORKER",
}: ImportPreviewDashboardProps): React.JSX.Element {
  const isLocker = domain === "LOCKER";

  const cards = isLocker
    ? [
        { label: "Filas detectadas", value: summary.totalRows, color: "var(--fg)" },
        { label: "Lockers detectados", value: summary.lockersDetected ?? 0, color: "#0891b2" },
        { label: "Lockers nuevos", value: summary.newLockers ?? 0, color: "#059669" },
        { label: "Nuevas asignaciones", value: summary.newCount ?? 0, color: "#16a34a" },
        { label: "Cambios asignación", value: summary.lockerChanges ?? summary.updatedCount ?? 0, color: "#2563eb" },
        { label: "Sin cambios", value: summary.unchangedCount ?? 0, color: "var(--muted)" },
        { label: "Lockers duplicados", value: summary.duplicateLockers ?? 0, color: "#b91c1c" },
        { label: "No en padrón", value: summary.missingMatricula ?? summary.invalidCount ?? 0, color: "#ea580c" },
        { label: "Conflictos", value: summary.conflicts ?? summary.conflictsCount ?? 0, color: "#9333ea" },
        { label: "Filas ignoradas", value: summary.ignoredRows ?? 0, color: "var(--muted)" },
      ]
    : [
        { label: "Filas detectadas", value: summary.totalRows, color: "var(--fg)" },
        { label: "Trabajadores válidos", value: summary.validWorkers ?? (summary.totalRows - (summary.missingMatricula ?? 0)), color: "#0284c7" },
        { label: "Trabajadores nuevos", value: summary.newWorkers ?? summary.newCount ?? 0, color: "#16a34a" },
        { label: "Con cambios", value: summary.updatedWorkers ?? summary.updatedCount ?? 0, color: "var(--primary)" },
        { label: "Sin cambios", value: summary.unchangedWorkers ?? summary.unchangedCount ?? 0, color: "var(--muted)" },
        { label: "Matrículas duplicadas", value: summary.duplicateMatriculas ?? 0, color: "#ea580c" },
        { label: "Sin matrícula", value: summary.missingMatricula ?? summary.invalidCount ?? 0, color: "#dc2626" },
        { label: "Conflictos", value: summary.conflicts ?? summary.conflictsCount ?? 0, color: "#9333ea" },
        { label: "Filas ignoradas", value: summary.ignoredRows ?? 0, color: "var(--muted)" },
      ];

  const breakdown = summary.conflictBreakdown;
  const workerNotFoundCount = breakdown?.WORKER_NOT_FOUND ?? (summary.missingMatricula ?? 0);
  const autoResolvableCount = summary.autoResolvableCount ?? 0;
  const realConflictsCount = summary.realConflictsCount ?? 0;

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

      {/* Banner de recomendación si hay matrículas no encontradas en el padrón */}
      {isLocker && workerNotFoundCount > 0 ? (
        <div
          role="status"
          style={{
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            color: "#92400e",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            fontSize: "0.875rem",
          }}
        >
          <div>
            <strong>⚠️ {workerNotFoundCount.toLocaleString("es-MX")} matrículas no existen en el padrón actual.</strong>
            <div style={{ fontSize: "0.8125rem", marginTop: "0.25rem", color: "#b45309" }}>
              Te recomendamos actualizar primero la base de trabajadores. Después vuelve a analizar este archivo de lockers.
            </div>
          </div>
          <Link
            href="/representacion/trabajadores/importar"
            style={{
              display: "inline-block",
              padding: "0.375rem 0.75rem",
              backgroundColor: "#d97706",
              color: "#ffffff",
              borderRadius: "0.375rem",
              fontWeight: 600,
              fontSize: "0.75rem",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Ir a actualizar trabajadores
          </Link>
        </div>
      ) : null}

      {/* Desglose estructurado de incidencias para lockers */}
      {isLocker && (summary.conflicts ?? summary.conflictsCount ?? 0) > 0 ? (
        <div
          role="region"
          aria-label="Desglose de incidencias"
          style={{
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#faf5ff",
            border: "1px solid #d8b4fe",
            color: "#581c87",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            fontSize: "0.8125rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <strong>
              ⚠️ {(summary.conflicts ?? summary.conflictsCount ?? 0).toLocaleString("es-MX")} incidencias detectadas
            </strong>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.5rem",
              marginTop: "0.25rem",
            }}
          >
            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#166534",
              }}
            >
              ✓ <strong>{autoResolvableCount.toLocaleString("es-MX")}</strong> pueden resolverse automáticamente
              {breakdown?.DUPLICATE_IDENTICAL_ROW ? (
                <div style={{ fontSize: "0.6875rem", color: "#15803d", marginTop: "0.125rem" }}>
                  • {breakdown.DUPLICATE_IDENTICAL_ROW} filas duplicadas idénticas
                </div>
              ) : null}
              {breakdown?.DUPLICATE_LOCKER_SAME_WORKER ? (
                <div style={{ fontSize: "0.6875rem", color: "#15803d", marginTop: "0.125rem" }}>
                  • {breakdown.DUPLICATE_LOCKER_SAME_WORKER} duplicados del mismo trabajador
                </div>
              ) : null}
            </div>

            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#9a3412",
              }}
            >
              ○ <strong>{workerNotFoundCount.toLocaleString("es-MX")}</strong> pueden omitirse temporalmente
              <div style={{ fontSize: "0.6875rem", color: "#c2410c", marginTop: "0.125rem" }}>
                Trabajadores no encontrados en padrón
              </div>
            </div>

            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
              }}
            >
              ! <strong>{realConflictsCount.toLocaleString("es-MX")}</strong> requieren tu decisión manual
              {breakdown?.DUPLICATE_LOCKER_DIFFERENT_WORKERS ? (
                <div style={{ fontSize: "0.6875rem", color: "#b91c1c", marginTop: "0.125rem" }}>
                  • {breakdown.DUPLICATE_LOCKER_DIFFERENT_WORKERS} locker reclamado por dos o más trabajadores
                </div>
              ) : null}
              {breakdown?.WORKER_MULTIPLE_LOCKERS ? (
                <div style={{ fontSize: "0.6875rem", color: "#b91c1c", marginTop: "0.125rem" }}>
                  • {breakdown.WORKER_MULTIPLE_LOCKERS} trabajador con dos o más lockers
                </div>
              ) : null}
              {breakdown?.LOCKER_ASSIGNED_TO_OTHER_WORKER ? (
                <div style={{ fontSize: "0.6875rem", color: "#b91c1c", marginTop: "0.125rem" }}>
                  • {breakdown.LOCKER_ASSIGNED_TO_OTHER_WORKER} locker asignado a otro en sistema
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!isLocker && (summary.conflicts ?? summary.conflictsCount ?? 0) > 0 ? (
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

      {summary.hasSupplementarySheet && !isLocker ? (
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

      {!isLocker && summary.missingInFileCount > 0 ? (
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
          ℹ️ <strong>{summary.missingInFileCount}</strong> trabajadores registrados previamente no figuran en esta nueva base. Sus expedientes y datos <strong>se conservan activos e intactos</strong>; no se han borrado ni inactivado automáticamente.
        </div>
      ) : null}
    </div>
  );
}
