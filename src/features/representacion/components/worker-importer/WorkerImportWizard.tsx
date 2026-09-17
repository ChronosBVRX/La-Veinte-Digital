"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner";
import { createClient } from "@/lib/supabase/client";
import { ImportDropzone } from "./ImportDropzone";
import { ImportPreviewDashboard } from "./ImportPreviewDashboard";
import { ImportDiffTable } from "./ImportDiffTable";
import { ImportConfirmationModal } from "./ImportConfirmationModal";
import { ImportHistoryList } from "./ImportHistoryList";
import type { ImportPreviewResult, ImportConfirmResult } from "../../services/worker-importer/types";

export interface WorkerImportWizardProps {
  format?: "MASTER" | "SIAP";
}

async function readApiResponse<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((data.error as string) ?? `Error HTTP ${res.status}`);
    }
    return data as T;
  }

  const text = await res.text();

  if (res.status === 413) {
    throw new Error(
      "No se pudo procesar el archivo porque es demasiado grande para el método de carga actual."
    );
  }

  throw new Error(text || `Error HTTP ${res.status}`);
}

export function WorkerImportWizard({ format = "MASTER" }: WorkerImportWizardProps): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ImportConfirmResult | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, Record<string, string>>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"import" | "history">("import");

  const previewEndpoint =
    format === "MASTER"
      ? "/api/union/workers/import/master/preview"
      : "/api/union/workers/import/preview";

  const applyEndpoint =
    format === "MASTER"
      ? "/api/union/workers/import/master/apply"
      : "/api/union/workers/import/confirm";

  async function handleFileSelected(file: File): Promise<void> {
    setLoading(true);
    setLoadingStage(null);
    setError(null);
    setPreviewResult(null);
    setConfirmResult(null);
    setResolutions({});

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

      if (format === "MASTER") {
        // 1. Solicitar URL firmada de subida (el archivo nunca atraviesa el payload de Vercel)
        setLoadingStage("Solicitando autorización de carga segura...");
        const uploadUrlRes = await fetch("/api/union/workers/import/master/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
          }),
        });

        const uploadInfo = await readApiResponse<{
          objectPath: string;
          signedUrl: string;
          token: string;
        }>(uploadUrlRes);

        // 2. Subida DIRECTA desde el navegador a Supabase Storage
        setLoadingStage("Subiendo archivo a almacenamiento seguro...");
        const supabase = createClient();
        if (supabase.storage?.from) {
          const { error: uploadError } = await supabase.storage
            .from("union-private")
            .uploadToSignedUrl(uploadInfo.objectPath, uploadInfo.token, file);

          if (uploadError) {
            throw new Error(`Error al subir archivo a almacenamiento seguro: ${uploadError.message}`);
          }
        } else {
          // Fallback para entornos de prueba o clientes directos
          const form = new FormData();
          form.append("cacheControl", "3600");
          form.append("", file);
          const putRes = await fetch(uploadInfo.signedUrl, {
            method: "POST",
            body: form,
          });
          if (!putRes.ok) {
            throw new Error(`Error al subir archivo a almacenamiento (HTTP ${putRes.status})`);
          }
        }

        // 3. Solicitar análisis y preview enviando solo metadata y objectPath
        setLoadingStage("Analizando base sindical y comparando casilleros...");
        const previewRes = await fetch(previewEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objectPath: uploadInfo.objectPath,
            fileName: file.name,
            fileSize: file.size,
          }),
        });

        const data = await readApiResponse<ImportPreviewResult>(previewRes);
        setPreviewResult(data);
      } else {
        // Formato SIAP: Carga directa estándar preservada
        setLoadingStage("Analizando plantilla SIAP...");
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(previewEndpoint, {
          method: "POST",
          body: formData,
        });

        const data = await readApiResponse<ImportPreviewResult>(res);
        setPreviewResult(data);
      }
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

  // Verificar si existen conflictos bloqueantes no resueltos
  const unresolvedConflicts = (previewResult?.rows ?? []).filter((r) => {
    if (r.status !== "conflict") return false;
    const res = resolutions[r.rowNumber];
    if (!res || (res.action !== "skip" && res.action !== "resolve")) {
      return true;
    }
    return false;
  });

  const hasBlockingConflicts = unresolvedConflicts.length > 0;

  async function handleConfirmImport(): Promise<void> {
    if (!previewResult) return;
    setConfirming(true);
    setError(null);

    try {
      const payload =
        format === "MASTER"
          ? {
              batch_id: previewResult.batchId,
              resolutions,
            }
          : {
              batch_id: previewResult.batchId,
            };

      const res = await fetch(applyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readApiResponse<ImportConfirmResult>(res);

      setConfirmResult(data);
      setIsModalOpen(false);

      // Refresco de datos del enrutador sin recarga manual (sin F5)
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al aplicar la importación.");
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
          Actualizar base sindical
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
          Historial de actualizaciones
        </button>
      </div>

      {activeTab === "history" ? (
        <Card padding="1rem">
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9375rem" }}>Historial de bases importadas</h3>
          <ImportHistoryList />
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
                <h3 style={{ margin: 0, fontSize: "1.125rem" }}>¡Actualización aplicada con éxito!</h3>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                  La base sindical y casilleros fueron conciliados de forma atómica y segura.
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
                  <span>
                    Trabajadores nuevos: <strong>{confirmResult.appliedCount}</strong>
                  </span>
                  <span>
                    Trabajadores actualizados: <strong>{confirmResult.updatedCount ?? 0}</strong>
                  </span>
                  <span>
                    Sin cambios: <strong>{confirmResult.unchangedCount}</strong>
                  </span>
                  <span>
                    Nuevos casilleros: <strong>{confirmResult.newLockersCount ?? 0}</strong>
                  </span>
                  <span>
                    Cambios de casillero: <strong>{confirmResult.lockerChangesCount ?? 0}</strong>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                  <Button variant="primary" size="sm" onClick={handleReset}>
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
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>Fase 1: Resumen de conciliación</h3>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)" }}>
                      Revisa los cambios detectados antes de escribir en la base de datos oficial.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <Button variant="ghost" size="sm" onClick={handleReset} disabled={confirming}>
                      Descartar y volver
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsModalOpen(true)}
                      disabled={confirming || hasBlockingConflicts}
                    >
                      {hasBlockingConflicts
                        ? `Resolver ${unresolvedConflicts.length} conflicto(s) pendientes`
                        : "Confirmar actualización"}
                    </Button>
                  </div>
                </div>

                <ImportPreviewDashboard
                  summary={previewResult.summary}
                  fileName={previewResult.fileName}
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
                />
              </Card>

              <ImportConfirmationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleConfirmImport}
                isLoading={confirming}
                summary={previewResult.summary}
              />
            </div>
          ) : (
            <Card padding="1.25rem">
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>
                Actualizar base sindical (Excel .xlsx)
              </h3>
              <p style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
                Carga el archivo Excel con la plantilla administrativa más reciente. El sistema analizará las filas,
                identificará trabajadores nuevos, conciliará casilleros y cambios de asignación, y te mostrará un desglose
                completo para resolver cualquier discrepancia antes de confirmar.
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
