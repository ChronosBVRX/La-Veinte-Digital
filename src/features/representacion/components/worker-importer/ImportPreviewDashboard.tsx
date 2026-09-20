"use client";

import type { ImportSummary } from "../../services/worker-importer/types";

export interface ImportPreviewDashboardProps {
  summary: ImportSummary;
  fileName: string;
  domain?: "WORKER" | "LOCKER";
  alreadyConfirmedAt?: string | null;
  alreadyConfirmedBatchId?: string | null;
}

export function ImportPreviewDashboard({
  summary,
  fileName,
  domain = "WORKER",
  alreadyConfirmedAt,
  alreadyConfirmedBatchId,
}: ImportPreviewDashboardProps): React.JSX.Element {
  const isLocker = domain === "LOCKER";

  const breakdown = summary.conflictBreakdown;
  const realConflictsCount = summary.realConflictsCount ?? (summary.conflicts ?? summary.conflictsCount ?? 0);
  const readyAssignmentsCount =
    summary.safeAssignmentsCount ??
    (summary.newCount ?? 0) + (summary.lockerChanges ?? summary.updatedCount ?? 0) + (summary.unchangedCount ?? 0);

  const lockerCards = [
    { label: "Filas Hoja1", value: summary.totalRows, color: "var(--fg)" },
    { label: "Lockers físicos", value: summary.uniquePhysicalLockers ?? summary.lockersDetected ?? summary.totalRows, color: "#0891b2" },
    { label: "Asignaciones listas", value: readyAssignmentsCount, color: "#16a34a" },
    { label: "Sustituyen previas", value: summary.replacedPreviousCount ?? 0, color: "#0284c7" },
    { label: "Liberan vacíos", value: summary.clearedPreviousCount ?? 0, color: "#64748b" },
    { label: "Ausentes a liberar", value: summary.stalePreviousCount ?? 0, color: "#ea580c" },
    { label: "Manuales protegidas", value: summary.manualProtectedCount ?? 0, color: "#059669" },
    { label: "Total activas final", value: summary.expectedActiveAssignmentsAfterImport ?? readyAssignmentsCount, color: "#15803d" },
    { label: "Trabajadores en padrón", value: summary.workersMatchedInRoster ?? 0, color: "#0284c7" },
    { label: "Nuevos (Excel)", value: summary.newWorkersFromExcel ?? summary.newWorkers ?? 0, color: "#16a34a" },
    { label: "Lockers sin trabajador", value: summary.lockersWithoutWorkerCount ?? 0, color: "#64748b" },
    { label: "Históricos superados", value: summary.historicalSupersededCount ?? 0, color: "#8b5cf6" },
    { label: "Conflictos reales", value: realConflictsCount, color: "#dc2626" },
    { label: "Casilleros semánticos", value: summary.semanticLockersCount ?? 0, color: "#64748b" },
    { label: "Filas sin locker", value: summary.rowsWithoutLockerCount ?? 0, color: "#64748b" },
  ];

  const workerCards = [
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

  const cards = isLocker ? lockerCards : workerCards;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {alreadyConfirmedAt ? (
        <div
          style={{
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#fffbeb",
            border: "1px solid #fef3c7",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>⚠️</span>
          <div style={{ fontSize: "0.875rem", color: "#92400e" }}>
            <strong>Esta base ya fue importada previamente</strong> el{" "}
            {new Date(alreadyConfirmedAt).toLocaleDateString("es-MX", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {alreadyConfirmedBatchId ? ` (Lote: ${alreadyConfirmedBatchId.slice(0, 8)})` : ""}.
            Si confirmas esta operación, se re-conciliarán las asignaciones y se actualizarán los registros existentes.
          </div>
        </div>
      ) : null}

      {isLocker ? (
        <div
          style={{
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.125rem" }}>✨</span>
              <strong style={{ fontSize: "0.9375rem", color: "#166534" }}>
                Hoja1 analizada con reconciliación exacta
              </strong>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.25rem 0.625rem",
                borderRadius: "9999px",
                backgroundColor: "#dcfce7",
                color: "#166534",
                border: "1px solid #86efac",
              }}
            >
              100% de filas explicadas ({summary.totalRows} = {summary.totalRowsAccounted ?? summary.totalRows})
            </span>
          </div>

          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#166534" }}>
            Encontramos <strong>{(summary.uniquePhysicalLockers ?? summary.lockersDetected ?? summary.totalRows).toLocaleString("es-MX")}</strong> casilleros físicos en <strong>Hoja1</strong>.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", margin: "0.125rem 0", fontSize: "0.8125rem" }}>
            <span style={{ color: "#15803d", fontWeight: 600 }}>
              ✓ {readyAssignmentsCount.toLocaleString("es-MX")} asignaciones listas para aplicarse
            </span>
            {(summary.replacedPreviousCount ?? 0) > 0 ? (
              <span style={{ color: "#0284c7", fontWeight: 600 }}>
                ↻ {(summary.replacedPreviousCount ?? 0).toLocaleString("es-MX")} sustituyen importaciones previas
              </span>
            ) : null}
            {(summary.clearedPreviousCount ?? 0) > 0 ? (
              <span style={{ color: "#475569", fontWeight: 600 }}>
                🗑️ {(summary.clearedPreviousCount ?? 0).toLocaleString("es-MX")} liberarán casilleros vacíos
              </span>
            ) : null}
            {(summary.stalePreviousCount ?? 0) > 0 ? (
              <span style={{ color: "#ea580c", fontWeight: 600 }}>
                ⚠️ {(summary.stalePreviousCount ?? 0).toLocaleString("es-MX")} asignaciones anteriores ausentes se liberarán
              </span>
            ) : null}
            {(summary.manualProtectedCount ?? 0) > 0 ? (
              <span style={{ color: "#059669", fontWeight: 600 }}>
                🛡️ {(summary.manualProtectedCount ?? 0).toLocaleString("es-MX")} asignaciones manuales protegidas
              </span>
            ) : null}
            {(summary.workersMatchedInRoster ?? 0) > 0 ? (
              <span style={{ color: "#0369a1", fontWeight: 600 }}>
                • {(summary.workersMatchedInRoster ?? 0).toLocaleString("es-MX")} trabajadores ya en padrón (datos SIAP protegidos)
              </span>
            ) : null}
            {(summary.newWorkersFromExcel ?? 0) > 0 ? (
              <span style={{ color: "#15803d", fontWeight: 600 }}>
                + {(summary.newWorkersFromExcel ?? 0).toLocaleString("es-MX")} trabajadores se crearán desde esta base
              </span>
            ) : null}
            {(summary.lockersWithoutWorkerCount ?? 0) > 0 ? (
              <span style={{ color: "#475569", fontWeight: 600 }}>
                ○ {(summary.lockersWithoutWorkerCount ?? 0).toLocaleString("es-MX")} lockers sin trabajador (quedarán disponibles)
              </span>
            ) : null}
            {(summary.historicalSupersededCount ?? 0) > 0 ? (
              <span style={{ color: "#7c3aed", fontWeight: 600 }}>
                ⏱️ {(summary.historicalSupersededCount ?? 0).toLocaleString("es-MX")} registros históricos superados
              </span>
            ) : null}
            {realConflictsCount > 0 ? (
              <span style={{ color: "#b91c1c", fontWeight: 600 }}>
                ! {realConflictsCount.toLocaleString("es-MX")} casos requieren revisión
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Archivo analizado: <strong>{fileName}</strong> (Fuente exclusiva: <strong>Hoja1</strong>)
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

      {/* Desglose estructurado de incidencias para lockers */}
      {isLocker && realConflictsCount > 0 ? (
        <div
          role="region"
          aria-label="Desglose de incidencias"
          style={{
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            fontSize: "0.8125rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <strong>
              ⚠️ {realConflictsCount.toLocaleString("es-MX")} conflictos requieren decisión humana en la bandeja
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
            {breakdown?.DUPLICATE_LOCKER_DIFFERENT_WORKERS ? (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#ffffff",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                • <strong>{breakdown.DUPLICATE_LOCKER_DIFFERENT_WORKERS}</strong> casillero(s) reclamados por dos o más trabajadores sin temporalidad concluyente.
              </div>
            ) : null}
            {breakdown?.WORKER_MULTIPLE_LOCKERS ? (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#ffffff",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                • <strong>{breakdown.WORKER_MULTIPLE_LOCKERS}</strong> trabajador(es) con múltiples casilleros sin evidencia de cuál es el más reciente.
              </div>
            ) : null}
            {breakdown?.LOCKER_ASSIGNED_TO_OTHER_WORKER ? (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#ffffff",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                • <strong>{breakdown.LOCKER_ASSIGNED_TO_OTHER_WORKER}</strong> casillero(s) ya asignados a otra persona en el sistema.
              </div>
            ) : null}
            {breakdown?.CONFLICT_WITH_MANUAL_CHANGE ? (
              <div
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#ffffff",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                • <strong>{breakdown.CONFLICT_WITH_MANUAL_CHANGE}</strong> casillero(s) con asignación manual previa protegida (no se sobreescriben automáticamente).
              </div>
            ) : null}
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
          <strong>{summary.conflicts ?? summary.conflictsCount}</strong> conflicto(s) que requieren revisión o resolución antes de aplicar los cambios.
        </div>
      ) : null}
    </div>
  );
}
