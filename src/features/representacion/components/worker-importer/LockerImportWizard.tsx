"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { ImportDropzone } from "./ImportDropzone";
import { ImportPreviewDashboard } from "./ImportPreviewDashboard";
import { ImportDiffTable } from "./ImportDiffTable";
import { ImportConfirmationModal } from "./ImportConfirmationModal";
import { ImportHistoryList } from "./ImportHistoryList";
import { secureUnionExcelUpload, readApiResponse } from "../../services/worker-importer/client-upload";
import type { ImportPreviewResult, ImportConfirmResult } from "../../services/worker-importer/types";

export function LockerImportWizard(): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ImportConfirmResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, Record<string, string>>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoResolveModalOpen, setIsAutoResolveModalOpen] = useState(false);
  const [isSkipWorkerNotFoundModalOpen, setIsSkipWorkerNotFoundModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"import" | "history">("import");

  const uploadUrlEndpoint = "/api/union/lockers/import/upload-url";
  const previewEndpoint = "/api/union/lockers/import/preview";
  const applyEndpoint = "/api/union/lockers/import/apply";

  async function handleFileSelected(file: File): Promise<void> {
    setLoading(true);
    setLoadingStage(null);
    setError(null);
    setPreviewResult(null);
    setConfirmResult(null);
    setResolutions({});
    setIsAutoResolveModalOpen(false);
    setIsSkipWorkerNotFoundModalOpen(false);

    try {
      const MAX_FILE_SIZE = 15 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `El archivo es demasiado grande (${(file.size / (1024 * 1024)).toFixed(2)} MB). El límite máximo es de 15 MB.`
        );
      }

      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        throw new Error("Solo se admiten archivos en formato Excel estándar (.xlsx).");
      }

      // 1 y 2: Carga directa firmada a Supabase Storage
      const uploadResult = await secureUnionExcelUpload({
        file,
        uploadUrlEndpoint,
        onStageChange: (stage) => setLoadingStage(stage),
      });

      // 3. Solicitar análisis y previsualización de casilleros
      setLoadingStage("Analizando casilleros y conciliando asignaciones...");
      const previewRes = await fetch(previewEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objectPath: uploadResult.objectPath,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
        }),
      });

      const data = await readApiResponse<ImportPreviewResult>(previewRes);
      setPreviewResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado al subir el archivo.");
    } finally {
      setLoading(false);
      setLoadingStage(null);
    }
  }

  const handleResolveField = useCallback((rowNumber: number, field: string, choice: "keep" | "excel") => {
    setResolutions((prev) => ({
      ...prev,
      [rowNumber]: {
        ...(prev[rowNumber] || {}),
        [field]: choice,
      },
    }));
  }, []);

  const handleResolveAction = useCallback((rowNumber: number, action: "resolve" | "skip") => {
    setResolutions((prev) => ({
      ...prev,
      [rowNumber]: {
        ...(prev[rowNumber] || {}),
        action,
      },
    }));
  }, []);

  const rows = previewResult?.rows ?? [];

  // Filas duplicadas del mismo trabajador/locker que pueden resolverse de forma segura
  const autoResolvableRows = rows.filter(
    (r) =>
      (r.autoResolvable ||
        r.conflictReasonCode === "DUPLICATE_IDENTICAL_ROW" ||
        r.conflictReasonCode === "DUPLICATE_LOCKER_SAME_WORKER") &&
      !resolutions[r.rowNumber]
  );

  // Filas con trabajador no encontrado en padrón pendientes de omisión
  const workerNotFoundRows = rows.filter(
    (r) =>
      (r.conflictReasonCode === "WORKER_NOT_FOUND" ||
        (r.status === "conflict" &&
          r.issues.some((i) => i.code === "WORKER_NOT_FOUND" || i.code === "WORKER_NOT_FOUND_IN_ROSTER"))) &&
      !resolutions[r.rowNumber]
  );

  // Conflictos reales que requieren decisión humana
  const realHumanConflicts = rows.filter((r) => {
    if (r.status !== "conflict") return false;
    if (resolutions[r.rowNumber]) return false;
    const isNotFound =
      r.conflictReasonCode === "WORKER_NOT_FOUND" ||
      r.issues.some((i) => i.code === "WORKER_NOT_FOUND" || i.code === "WORKER_NOT_FOUND_IN_ROSTER");
    const isAuto =
      r.autoResolvable ||
      r.conflictReasonCode === "DUPLICATE_IDENTICAL_ROW" ||
      r.conflictReasonCode === "DUPLICATE_LOCKER_SAME_WORKER";
    return !isNotFound && !isAuto;
  });

  function handleAutoResolve(): void {
    setResolutions((prev) => {
      const next = { ...prev };
      for (const r of autoResolvableRows) {
        next[r.rowNumber] = {
          action: "skip",
          reason:
            r.conflictReasonCode === "DUPLICATE_IDENTICAL_ROW"
              ? "IGNORED_DUPLICATE"
              : "IGNORED_DUPLICATE_SAME_WORKER",
        };
      }
      return next;
    });
    setIsAutoResolveModalOpen(false);
  }

  function handleSkipWorkerNotFound(): void {
    setResolutions((prev) => {
      const next = { ...prev };
      for (const r of workerNotFoundRows) {
        next[r.rowNumber] = {
          action: "skip",
          reason: "SKIPPED_WORKER_NOT_FOUND",
        };
      }
      return next;
    });
    setIsSkipWorkerNotFoundModalOpen(false);
  }

  async function handleConfirmImport(): Promise<void> {
    if (!previewResult) return;
    setConfirming(true);
    setError(null);

    try {
      const payload = {
        batch_id: previewResult.batchId,
        resolutions,
      };

      const res = await fetch(applyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readApiResponse<ImportConfirmResult>(res);

      setConfirmResult(data);
      setIsModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al aplicar la actualización de casilleros.");
    } finally {
      setConfirming(false);
    }
  }

  function handleReset(): void {
    setPreviewResult(null);
    setConfirmResult(null);
    setResolutions({});
    setError(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Pestañas de Navegación */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveTab("import")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "import" ? "2px solid var(--primary)" : "2px solid transparent",
            color: activeTab === "import" ? "var(--primary)" : "var(--muted)",
            fontWeight: 600,
            fontSize: "0.875rem",
            padding: "0.25rem 0.5rem",
            cursor: "pointer",
          }}
        >
          Actualizar base de lockers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          style={{
            background: "none",
            border: "none",
            borderBottom: activeTab === "history" ? "2px solid var(--primary)" : "2px solid transparent",
            color: activeTab === "history" ? "var(--primary)" : "var(--muted)",
            fontWeight: 600,
            fontSize: "0.875rem",
            padding: "0.25rem 0.5rem",
            cursor: "pointer",
          }}
        >
          Historial de actualización de lockers
        </button>
      </div>

      {activeTab === "history" ? (
        <Card padding="1rem">
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9375rem" }}>Historial de bases de casilleros</h3>
          <ImportHistoryList domain="LOCKER" />
        </Card>
      ) : (
        <>
          {error ? (
            <div
              role="alert"
              style={{
                padding: "0.75rem",
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

          {confirmResult ? (
            <Card padding="1.5rem">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.5rem" }}>✅</div>
                <h3 style={{ margin: 0, fontSize: "1.125rem" }}>¡Base de casilleros importada con éxito!</h3>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                  Los casilleros e inventario fueron guardados de forma segura.
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    flexWrap: "wrap",
                    gap: "1.25rem",
                    margin: "1rem 0",
                    fontSize: "0.875rem",
                  }}
                >
                  {(confirmResult.lockersInventoriedCount ?? 0) > 0 && (
                    <span>
                      Lockers físicos inventariados: <strong>{confirmResult.lockersInventoriedCount}</strong>
                    </span>
                  )}
                  <span>
                    Asignaciones vinculadas: <strong>{(confirmResult.newLockersCount ?? 0) + (confirmResult.lockerChangesCount ?? 0)}</strong>
                  </span>
                  {(confirmResult.workersCreatedCount ?? 0) > 0 && (
                    <span>
                      Trabajadores dados de alta: <strong>{confirmResult.workersCreatedCount}</strong>
                    </span>
                  )}
                  {confirmResult.pendingReviewCount ? (
                    <span style={{ color: "#c2410c", fontWeight: 600 }}>
                      Pendientes de revisión: <strong>{confirmResult.pendingReviewCount}</strong>
                    </span>
                  ) : null}
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <Button variant="primary" size="sm" onClick={() => router.push("/representacion/lockers/pendientes")}>
                    Ver pendientes de revisión
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => router.push("/representacion/lockers")}>
                    Ir al panel de lockers
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Actualizar con otra base
                  </Button>
                </div>
              </div>
            </Card>
          ) : previewResult ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Card padding="1rem">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>Resumen de importación de casilleros</h3>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                      Revisa los casilleros detectados. Los registros pendientes se conservarán para su revisión posterior.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <Button variant="ghost" size="sm" onClick={handleReset} disabled={confirming}>
                      Descartar y volver
                    </Button>

                    {autoResolvableRows.length > 0 ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsAutoResolveModalOpen(true)}
                        disabled={confirming}
                      >
                        Corregir automáticamente ({autoResolvableRows.length})
                      </Button>
                    ) : null}

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsModalOpen(true)}
                      disabled={confirming}
                    >
                      Importar base de lockers
                    </Button>
                  </div>
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                  No necesitas resolver todo ahora. Podrás hacerlo después desde Lockers.
                </div>

                <ImportPreviewDashboard
                  summary={previewResult.summary}
                  fileName={previewResult.fileName}
                  domain="LOCKER"
                />
              </Card>

              <Card padding="1rem">
                <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9375rem" }}>
                  Detalle fila por fila, casilleros y discrepancias
                </h3>
                <ImportDiffTable
                  rows={previewResult.rows}
                  resolutions={resolutions}
                  onResolveField={handleResolveField}
                  onResolveAction={handleResolveAction}
                  domain="LOCKER"
                />
              </Card>

              <ImportConfirmationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmImport}
                isLoading={confirming}
                summary={previewResult.summary}
                domain="LOCKER"
              />

              {/* Modal de Resolución Automática */}
              {isAutoResolveModalOpen ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 50,
                    padding: "1rem",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "var(--card)",
                      borderRadius: "0.5rem",
                      padding: "1.5rem",
                      maxWidth: "520px",
                      width: "100%",
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "1.125rem" }}>Resolución automática segura</h3>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                      El sistema resolverá de forma determinista únicamente los casos seguros sin adivinar:
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
                      <div
                        style={{
                          padding: "0.75rem",
                          borderRadius: "0.375rem",
                          backgroundColor: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          color: "#166534",
                        }}
                      >
                        <strong>Podemos resolver de forma segura:</strong>
                        <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1.25rem" }}>
                          <li>
                            {autoResolvableRows.length} fila(s) duplicadas del mismo trabajador y casillero (se mantendrá una sola operación efectiva).
                          </li>
                        </ul>
                      </div>

                      {workerNotFoundRows.length > 0 || realHumanConflicts.length > 0 ? (
                        <div
                          style={{
                            padding: "0.75rem",
                            borderRadius: "0.375rem",
                            backgroundColor: "#fff7ed",
                            border: "1px solid #fed7aa",
                            color: "#9a3412",
                          }}
                        >
                          <strong>No se pueden resolver automáticamente:</strong>
                          <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1.25rem" }}>
                            {workerNotFoundRows.length > 0 ? (
                              <li>
                                {workerNotFoundRows.length} trabajadores no encontrados en el padrón (requieren actualización del padrón u omisión temporal).
                              </li>
                            ) : null}
                            {realHumanConflicts.length > 0 ? (
                              <li>
                                {realHumanConflicts.length} conflicto(s) que requieren tu decisión manual (ej. casillero reclamado por distintos trabajadores).
                              </li>
                            ) : null}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <Button variant="ghost" size="sm" onClick={() => setIsAutoResolveModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button variant="primary" size="sm" onClick={handleAutoResolve}>
                        Resolver {autoResolvableRows.length} automáticamente
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Modal de Omisión Masiva de Trabajadores No Encontrados */}
              {isSkipWorkerNotFoundModalOpen ? (
                <div
                  role="dialog"
                  aria-modal="true"
                  style={{
                    position: "fixed",
                    inset: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 50,
                    padding: "1rem",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "var(--card)",
                      borderRadius: "0.5rem",
                      padding: "1.5rem",
                      maxWidth: "520px",
                      width: "100%",
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "1.125rem" }}>
                      Omitir temporalmente trabajadores no encontrados
                    </h3>

                    <div style={{ fontSize: "0.875rem", color: "var(--fg)", lineHeight: 1.5 }}>
                      <p style={{ margin: "0 0 0.75rem" }}>
                        <strong>{workerNotFoundRows.length} filas</strong> corresponden a matrículas que no existen actualmente en el padrón de trabajadores.
                      </p>
                      <p style={{ margin: "0 0 0.75rem", color: "var(--muted)" }}>
                        Estas filas pueden omitirse sin modificar sus lockers. Después de actualizar el padrón de trabajadores podrás volver a importar este archivo para conciliarlas.
                      </p>
                      <div
                        style={{
                          padding: "0.625rem 0.75rem",
                          borderRadius: "0.375rem",
                          backgroundColor: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1e40af",
                          fontSize: "0.8125rem",
                        }}
                      >
                        🛡️ <strong>Garantía de seguridad:</strong> Omitir estas filas <strong>NO creará trabajadores</strong>, <strong>NO asignará lockers</strong>, <strong>NO eliminará lockers</strong> ni liberará asignaciones existentes. Es estrictamente un NO-OP.
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <Button variant="ghost" size="sm" onClick={() => setIsSkipWorkerNotFoundModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSkipWorkerNotFound}
                        style={{ backgroundColor: "#d97706" }}
                      >
                        Omitir {workerNotFoundRows.length} temporalmente
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <Card padding="1.25rem">
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>
                Actualizar base de lockers (Excel .xlsx)
              </h3>
              <p style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
                Carga el archivo Excel con la relación de casilleros y asignaciones (Hoja1). El sistema inventariará todos los casilleros físicos, dará de alta trabajadores no registrados previamente con origen Excel (sin tocar datos SIAP si ya existen), resolverá antecedentes históricos y enviará únicamente las ambigüedades reales a revisión.
              </p>
              {loading && loadingStage ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.875rem 1rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "var(--accent)",
                    border: "1px solid var(--border)",
                    fontSize: "0.875rem",
                    color: "var(--fg)",
                    marginBottom: "1rem",
                  }}
                >
                  <LoadingSpinner text={loadingStage} />
                </div>
              ) : null}
              <ImportDropzone onFileSelected={handleFileSelected} isLoading={loading} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
