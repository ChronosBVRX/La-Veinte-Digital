"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { WorkerPicker, getWorkerDisplayName, type UnionWorkerOption } from "./WorkerPicker";
import type {
  ReconciliationCase,
  ReconciliationCandidate,
  SafeMatchesSummary,
} from "../services/worker-importer/reconciliation-types";
import { ReconciliationCaseCard } from "./lockers/ReconciliationCaseCard";
import { SafeMatchesBanner } from "./lockers/SafeMatchesBanner";
import { ReconciliationConsequenceModal } from "./lockers/ReconciliationConsequenceModal";

type FilterTab = "all" | "worker_not_found" | "locker_multiple_workers" | "worker_multiple_lockers" | "other";

interface PendingApiResponse {
  cases?: ReconciliationCase[];
  totalCases?: number;
  totalReviewItems?: number;
  caseCounts?: {
    total: number;
    workerNotFound: number;
    multipleWorkers: number;
    multipleLockers: number;
    other: number;
  };
  itemCounts?: {
    total: number;
    workerNotFound: number;
    multipleWorkers: number;
    multipleLockers: number;
    other: number;
  };
  safeMatchesSummary?: SafeMatchesSummary;
  page?: number;
  pageSize?: number;
  error?: string;
}

export function LockerPendingReviewList(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("easy");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 25;

  const [cases, setCases] = useState<ReconciliationCase[]>([]);
  const [totalCases, setTotalCases] = useState<number>(0);
  const [totalReviewItems, setTotalReviewItems] = useState<number>(0);
  const [caseCounts, setCaseCounts] = useState({
    total: 0,
    workerNotFound: 0,
    multipleWorkers: 0,
    multipleLockers: 0,
    other: 0,
  });
  const [safeMatchesSummary, setSafeMatchesSummary] = useState<SafeMatchesSummary>({
    totalFound: 0,
    safeMatches: [],
    requiresLockerReview: 0,
    clashesWithManual: 0,
    blockedOrMaintenance: 0,
    alreadyHasLocker: 0,
  });

  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [batchLinking, setBatchLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado del modal de consecuencias
  const [confirmingCase, setConfirmingCase] = useState<{
    caseData: ReconciliationCase;
    candidate: ReconciliationCandidate;
  } | null>(null);

  // Estado del modal de vinculación manual de trabajador
  const [manualSearchCase, setManualSearchCase] = useState<ReconciliationCase | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<UnionWorkerOption | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const q = encodeURIComponent(searchQuery.trim());
      const res = await fetch(
        `/api/union/lockers/pendientes?filter=${activeTab}&search=${q}&sort=${sortOrder}&page=${currentPage}&pageSize=${pageSize}`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as PendingApiResponse;
      if (!res.ok) throw new Error(data.error ?? "Error al cargar el asistente de conciliación");

      setCases(data.cases ?? []);
      setTotalCases(data.totalCases ?? 0);
      setTotalReviewItems(data.totalReviewItems ?? 0);
      if (data.caseCounts) setCaseCounts(data.caseCounts);
      if (data.safeMatchesSummary) setSafeMatchesSummary(data.safeMatchesSummary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al consultar los registros de conciliación.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchQuery, sortOrder, currentPage, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on change
    void loadData();
  }, [loadData]);

  // Al cambiar filtros o búsqueda, volver a la página 1
  function handleTabChange(tab: FilterTab): void {
    setActiveTab(tab);
    setCurrentPage(1);
  }

  function handleSearchChange(val: string): void {
    setSearchQuery(val);
    setCurrentPage(1);
  }

  function handleSortChange(val: string): void {
    setSortOrder(val);
    setCurrentPage(1);
  }

  // Confirmar y aplicar resolución atómica vía RPC
  async function handleExecuteResolution(): Promise<void> {
    if (!confirmingCase) return;
    const { caseData, candidate } = confirmingCase;
    setSubmittingId(caseData.caseId);
    setError(null);

    let subAction: "select_locker_for_worker" | "select_worker_for_locker" | "link_worker_to_locker" = "select_locker_for_worker";
    if (caseData.type === "LOCKER_MULTIPLE_WORKERS") {
      subAction = "select_worker_for_locker";
    } else if (caseData.type === "WORKER_NOT_FOUND") {
      subAction = "link_worker_to_locker";
    }

    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_case",
          caseType: caseData.type,
          subAction,
          reviewItemIds: caseData.reviewItemIds,
          selectedLockerId: caseData.type === "WORKER_MULTIPLE_LOCKERS" ? candidate.candidateId : caseData.locker?.id,
          selectedWorkerId: caseData.type === "LOCKER_MULTIPLE_WORKERS" || caseData.type === "WORKER_NOT_FOUND" ? candidate.candidateId : caseData.worker?.id,
          selectedLockerNumber: caseData.type === "WORKER_MULTIPLE_LOCKERS" ? candidate.label.replace(/^Casillero\s*/i, "") : caseData.locker?.lockerNumber,
          selectedEmployeeNumber: caseData.type === "LOCKER_MULTIPLE_WORKERS" ? (candidate.sublabel.match(/\d+/)?.[0] ?? undefined) : caseData.worker?.employeeNumber,
          notes: `Conciliado en Asistente: opción ${candidate.label}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar la decisión de conciliación");

      setSuccessMessage(`✓ Caso resuelto correctamente: ${candidate.label} aplicado exitosamente.`);
      setConfirmingCase(null);
      void loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al aplicar la conciliación.");
    } finally {
      setSubmittingId(null);
    }
  }

  // Vincular trabajador manual desde el picker
  async function handleConfirmManualWorker(): Promise<void> {
    if (!manualSearchCase || !selectedWorker) return;
    setSubmittingId(manualSearchCase.caseId);
    setError(null);

    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_case",
          caseType: "WORKER_NOT_FOUND",
          subAction: "link_worker_to_locker",
          reviewItemIds: manualSearchCase.reviewItemIds,
          selectedWorkerId: selectedWorker.id,
          selectedLockerNumber: manualSearchCase.locker?.lockerNumber,
          notes: `Vinculado manualmente a ${getWorkerDisplayName(selectedWorker)} (Matrícula: ${selectedWorker.employee_number})`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al vincular trabajador");

      setSuccessMessage(`✓ Trabajador vinculado: Casillero ${manualSearchCase.locker?.lockerNumber} asignado.`);
      setManualSearchCase(null);
      setSelectedWorker(null);
      void loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo vincular el trabajador.");
    } finally {
      setSubmittingId(null);
    }
  }

  // Dejar pendiente (ignorar)
  async function handleIgnoreCase(c: ReconciliationCase): Promise<void> {
    setSubmittingId(c.caseId);
    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve_case",
          caseType: c.type,
          subAction: "ignore",
          reviewItemIds: c.reviewItemIds,
          notes: "Omitido por el administrador",
        }),
      });
      if (res.ok) {
        setSuccessMessage(`✓ Caso omitido de la lista de pendientes.`);
        void loadData();
      }
    } finally {
      setSubmittingId(null);
    }
  }

  // Aplicar coincidencias seguras en lote vía RPC
  async function handleApplySafeMatches(): Promise<void> {
    if (safeMatchesSummary.safeMatches.length === 0) return;
    setBatchLinking(true);
    setError(null);

    try {
      const res = await fetch("/api/union/lockers/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_resolve_safe_matches",
          matches: safeMatchesSummary.safeMatches.map((m) => ({
            reviewItemId: m.reviewItemId,
            workerId: m.workerId,
            lockerId: m.lockerId,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al aplicar coincidencias seguras");

      setSuccessMessage(
        `✓ Se aplicaron exitosamente ${data.linkedCount} coincidencias seguras sin conflictos.`
      );
      void loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al aplicar el lote seguro.");
    } finally {
      setBatchLinking(false);
    }
  }

  const totalPages = Math.ceil(totalCases / pageSize) || 1;
  const startItemNumber = totalCases === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItemNumber = Math.min(currentPage * pageSize, totalCases);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Navegación y Encabezado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <Link
            href="/representacion/lockers"
            style={{ fontSize: "0.8125rem", color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
          >
            ← Volver a lockers
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 700, color: "var(--fg)" }}>
              Asistente de Conciliación
            </h2>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                padding: "0.25rem 0.625rem",
                borderRadius: "999px",
                backgroundColor: "var(--accent)",
                color: "var(--fg)",
                border: "1px solid var(--border)",
              }}
            >
              {totalCases} casos por resolver · {totalReviewItems} registros implicados
            </span>
          </div>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
            Resuelve discrepancias del archivo de casilleros apoyado en evidencia temporal, estado actual en base y recomendaciones deterministas.
          </p>
        </div>

        <Link
          href="/representacion/lockers/importar"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.45rem 0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--fg)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Actualizar con otra base
        </Link>
      </div>

      {/* Mensajes de Estado */}
      {successMessage ? (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.375rem",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            fontSize: "0.8125rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            style={{ background: "none", border: "none", color: "#166534", cursor: "pointer", fontSize: "1rem" }}
          >
            ✕
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.375rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            fontSize: "0.8125rem",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {/* Banner de Coincidencias Seguras en Lote */}
      <SafeMatchesBanner
        summary={safeMatchesSummary}
        onApplySafeMatches={() => void handleApplySafeMatches()}
        isLoading={batchLinking}
      />

      {/* Pestañas de Filtro Humanas */}
      <div
        style={{
          display: "flex",
          gap: "0.375rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "0.5rem",
          overflowX: "auto",
        }}
      >
        <Button
          size="sm"
          variant={activeTab === "all" ? "primary" : "secondary"}
          onClick={() => handleTabChange("all")}
        >
          Todos ({caseCounts.total})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "worker_not_found" ? "primary" : "secondary"}
          onClick={() => handleTabChange("worker_not_found")}
        >
          Personas no encontradas ({caseCounts.workerNotFound})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "locker_multiple_workers" ? "primary" : "secondary"}
          onClick={() => handleTabChange("locker_multiple_workers")}
        >
          Lockers con más de una persona ({caseCounts.multipleWorkers})
        </Button>
        <Button
          size="sm"
          variant={activeTab === "worker_multiple_lockers" ? "primary" : "secondary"}
          onClick={() => handleTabChange("worker_multiple_lockers")}
        >
          Personas con más de un locker ({caseCounts.multipleLockers})
        </Button>
        {caseCounts.other > 0 ? (
          <Button
            size="sm"
            variant={activeTab === "other" ? "primary" : "secondary"}
            onClick={() => handleTabChange("other")}
          >
            Otros ({caseCounts.other})
          </Button>
        ) : null}
      </div>

      {/* Barra de Búsqueda y Ordenamiento */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "240px" }}>
          <Input
            placeholder="Buscar por casillero (ej. 547), matrícula o nombre…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Ordenar:</label>
          <select
            value={sortOrder}
            onChange={(e) => handleSortChange(e.target.value)}
            style={{
              padding: "0.45rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--fg)",
              fontSize: "0.8125rem",
            }}
          >
            <option value="easy">Más fáciles (Alta recomendación)</option>
            <option value="rec_med">Recomendación media</option>
            <option value="rec_none">Sin recomendación (manual)</option>
            <option value="locker_asc">Número de casillero</option>
            <option value="name">Nombre alfabético</option>
          </select>
        </div>
      </div>

      {/* Lista de Casos de Conciliación */}
      {loading ? (
        <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
          <LoadingSpinner text="Analizando y agrupando casos de conciliación..." />
        </div>
      ) : cases.length === 0 ? (
        <Card padding="2.5rem">
          <div style={{ textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>✓</div>
            <h3 style={{ margin: 0, fontSize: "1.125rem", color: "var(--fg)" }}>¡Todo revisado!</h3>
            <p style={{ margin: "0.25rem 0 1.25rem", fontSize: "0.875rem" }}>
              No hay casos pendientes que coincidan con los filtros y búsqueda seleccionados.
            </p>
            <Link
              href="/representacion/lockers"
              style={{
                display: "inline-block",
                padding: "0.45rem 0.875rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--primary)",
                color: "var(--primary-fg)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Ir al panel de lockers
            </Link>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {cases.map((c) => (
            <ReconciliationCaseCard
              key={c.caseId}
              caseData={c}
              onSelectOption={(caseData, candidate) => {
                setConfirmingCase({ caseData, candidate });
              }}
              onManualSearchWorker={(caseData) => {
                setManualSearchCase(caseData);
                setSelectedWorker(null);
              }}
              onIgnoreCase={(caseData) => void handleIgnoreCase(caseData)}
              isSubmitting={submittingId === c.caseId}
            />
          ))}

          {/* Barra de Paginación */}
          {totalPages > 1 ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 0",
                borderTop: "1px solid var(--border)",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                Mostrando casos {startItemNumber} a {endItemNumber} de {totalCases}
              </span>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                >
                  ← Anterior
                </Button>

                <span style={{ fontSize: "0.8125rem", color: "var(--fg)", fontWeight: 600 }}>
                  Página {currentPage} de {totalPages}
                </span>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || loading}
                >
                  Siguiente →
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Modal de Consecuencias */}
      {confirmingCase ? (
        <ReconciliationConsequenceModal
          isOpen={Boolean(confirmingCase)}
          onClose={() => setConfirmingCase(null)}
          onConfirm={() => void handleExecuteResolution()}
          title={confirmingCase.caseData.title}
          selectedOptionLabel={confirmingCase.candidate.label}
          consequences={confirmingCase.caseData.consequences}
          isSubmitting={submittingId === confirmingCase.caseData.caseId}
        />
      ) : null}

      {/* Modal de Búsqueda Manual de Trabajador */}
      {manualSearchCase ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div style={{ maxWidth: "540px", width: "100%" }}>
            <Card padding="1.5rem">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700 }}>
                      Buscar trabajador en el padrón
                    </h3>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
                      Vincular Casillero {manualSearchCase.locker?.lockerNumber} con un trabajador del padrón sindical.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setManualSearchCase(null)}
                    style={{ background: "none", border: "none", fontSize: "1.25rem", color: "var(--muted)", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ padding: "0.75rem", backgroundColor: "var(--accent)", borderRadius: "0.375rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Datos en el archivo:</div>
                  <strong style={{ fontSize: "0.875rem" }}>{manualSearchCase.title}</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{manualSearchCase.subtitle}</div>
                </div>

                <div>
                  <WorkerPicker
                    selected={selectedWorker}
                    onSelect={setSelectedWorker}
                    label="Seleccionar trabajador sindical"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <Button variant="secondary" size="sm" onClick={() => setManualSearchCase(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleConfirmManualWorker()}
                    disabled={!selectedWorker}
                    loading={submittingId === manualSearchCase.caseId}
                  >
                    Vincular y asignar
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
