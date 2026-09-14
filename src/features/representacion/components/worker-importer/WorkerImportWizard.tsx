"use client";

import { useState } from "react";
import { Card } from "@/shared/components/ui/Card";
import { Button } from "@/shared/components/ui/Button";
import { ImportDropzone } from "./ImportDropzone";
import { ImportPreviewDashboard } from "./ImportPreviewDashboard";
import { ImportDiffTable } from "./ImportDiffTable";
import { ImportConfirmationModal } from "./ImportConfirmationModal";
import { ImportHistoryList } from "./ImportHistoryList";
import type { ImportPreviewResult, ImportConfirmResult } from "../../services/worker-importer/types";

export function WorkerImportWizard(): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ImportConfirmResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"import" | "history">("import");

  async function handleFileSelected(file: File): Promise<void> {
    setLoading(true);
    setError(null);
    setPreviewResult(null);
    setConfirmResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/union/workers/import/preview", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as ImportPreviewResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Ocurrió un error al procesar la plantilla Excel.");
      }

      setPreviewResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado al subir el archivo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmImport(): Promise<void> {
    if (!previewResult) return;
    setConfirming(true);
    setError(null);

    try {
      const res = await fetch("/api/union/workers/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: previewResult.batchId }),
      });

      const data = (await res.json()) as ImportConfirmResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Ocurrió un error al confirmar la importación.");
      }

      setConfirmResult(data);
      setIsModalOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al confirmar la importación.");
    } finally {
      setConfirming(false);
    }
  }

  function handleReset(): void {
    setPreviewResult(null);
    setConfirmResult(null);
    setError(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Header Tabs */}
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
          Nueva importación
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
          Historial de importaciones
        </button>
      </div>

      {activeTab === "history" ? (
        <Card padding="1rem">
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.9375rem" }}>Historial de lotes importados</h3>
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
                <h3 style={{ margin: 0, fontSize: "1.125rem" }}>¡Importación confirmada con éxito!</h3>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
                  Se aplicaron correctamente los cambios al padrón sindical oficial.
                </p>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "1.5rem",
                    margin: "1rem 0",
                    fontSize: "0.875rem",
                  }}
                >
                  <span>
                    Trabajadores aplicados: <strong>{confirmResult.appliedCount}</strong>
                  </span>
                  <span>
                    Sin cambios: <strong>{confirmResult.unchangedCount}</strong>
                  </span>
                  <span>
                    Ausentes marcados: <strong>{confirmResult.missingMarkedCount}</strong>
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem" }}>
                  <Button variant="primary" size="sm" onClick={handleReset}>
                    Importar otro archivo
                  </Button>
                </div>
              </div>
            </Card>
          ) : previewResult ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Card padding="1rem">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1rem" }}>Resumen previo a la importación</h3>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button variant="ghost" size="sm" onClick={handleReset} disabled={confirming}>
                      Descartar y volver
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsModalOpen(true)}
                      disabled={confirming}
                    >
                      Confirmar importación al padrón
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
                  Detalle fila por fila y diferencias detectadas
                </h3>
                <ImportDiffTable rows={previewResult.rows} />
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
                Importar plantilla de personal IMSS (.xlsx)
              </h3>
              <p style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
                Carga la plantilla periódica generada por los sistemas institucionales (SIAP) en formato Excel canónico.
                El sistema comparará automáticamente la plantilla contra el padrón actual, identificará trabajadores nuevos,
                actualizará adscripciones y plazas, y conservará intactos los expedientes, casilleros y notas sindicales.
              </p>
              <ImportDropzone onFileSelected={handleFileSelected} isLoading={loading} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
