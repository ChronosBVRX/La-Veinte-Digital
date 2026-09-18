"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import {
  RepresentationSectionHeader,
  RepresentationSummaryMetrics,
  RepresentationMetricCard,
  RepresentationToolbar,
  RepresentationSearchInput,
  RepresentationStatusBadge,
  RepresentationSheet,
  RepresentationEmptyState,
  RepresentationLoadingSkeleton,
} from "./ui";
import { LicenseWizard } from "./LicenseWizard";
import type { LicenseCaseDetailResult } from "../services/license-management";

interface LicenseListItem {
  id: string;
  folio: string;
  status: string;
  currentStep: number;
  revisionNumber: number;
  documentRevision: number;
  isOutdated: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  worker: {
    id: string;
    employeeNumber: string;
    fullName: string;
    category: string;
  } | null;
  license: {
    withPay: boolean;
    startDate: string | null;
    endDate: string | null;
    totalDays: number;
    reason: string;
  } | null;
}

export function LicenseManager(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Estados derivados de la URL (?action=new | ?case=UUID&action=continue | ?case=UUID&action=edit)
  const caseParam = searchParams.get("case");
  const actionParam = searchParams.get("action");
  const isWizard = Boolean(caseParam || actionParam === "new");
  const activeCaseId = caseParam || null;
  const isEditMode = actionParam === "edit";

  // Estados del listado
  const [cases, setCases] = useState<LicenseListItem[]>([]);
  const [summary, setSummary] = useState({
    draftsCount: 0,
    completedCount: 0,
    deletedCount: 0,
    totalCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Estado del detalle en drawer/sheet
  const [detailCase, setDetailCase] = useState<LicenseCaseDetailResult | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  // Estados de modales de confirmación
  const [softDeleteTarget, setSoftDeleteTarget] = useState<LicenseListItem | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<LicenseListItem | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<LicenseListItem | null>(null);
  const [hardDeleteInput, setHardDeleteInput] = useState("");

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Descargas e impresiones
  const [printingCaseId, setPrintingCaseId] = useState<string | null>(null);
  const [autoPrintingCaseId, setAutoPrintingCaseId] = useState<string | null>(null);
  const [autoPrintSuccessId, setAutoPrintSuccessId] = useState<string | null>(null);
  const [downloadingKind, setDownloadingKind] = useState<{ id: string; kind: "word" | "excel" } | null>(null);

  // Carga de datos del listado
  const fetchList = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "all") q.set("status", statusFilter);
      if (search.trim()) q.set("search", search.trim());

      const res = await fetch(`/api/union/licenses?${q.toString()}`);
      if (!res.ok) throw new Error("Error al consultar trámites de licencias");
      const data = await res.json();

      setCases(data.cases ?? []);
      setSummary(
        data.summary ?? {
          draftsCount: 0,
          completedCount: 0,
          deletedCount: 0,
          totalCount: 0,
        },
      );
    } catch {
      // Manejo silencioso con estado vacío
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on filter/search change
    void fetchList();
  }, [fetchList]);

  // Abrir wizard para nuevo trámite
  function handleNewLicense() {
    startTransition(() => {
      router.push("/representacion/licencias?action=new");
    });
  }

  // Continuar borrador
  function handleContinueDraft(c: LicenseListItem) {
    startTransition(() => {
      router.push(`/representacion/licencias?case=${c.id}&action=continue`);
    });
  }

  // Editar trámite completado
  function handleEditCase(c: LicenseListItem) {
    startTransition(() => {
      router.push(`/representacion/licencias?case=${c.id}&action=edit`);
    });
  }

  // Ver detalle
  async function handleViewDetail(caseId: string) {
    setLoadingDetail(true);
    setShowDetailSheet(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/union/licenses?case_id=${caseId}&include_deleted=true`);
      if (!res.ok) throw new Error("No se pudo obtener el detalle del expediente.");
      const data = await res.json();
      setDetailCase(data.case ?? null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al cargar detalle");
    } finally {
      setLoadingDetail(false);
    }
  }

  // Ejecutar soft delete
  async function confirmSoftDelete() {
    if (!softDeleteTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/union/licenses", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: softDeleteTarget.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "No se pudo eliminar el expediente.");
      }
      setSoftDeleteTarget(null);
      await fetchList();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setActionBusy(false);
    }
  }

  // Ejecutar restore
  async function confirmRestore() {
    if (!restoreTarget) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/union/licenses/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: restoreTarget.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "No se pudo restaurar el expediente.");
      }
      setRestoreTarget(null);
      await fetchList();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error al restaurar");
    } finally {
      setActionBusy(false);
    }
  }

  // Ejecutar hard delete definitivo (admin)
  async function confirmHardDelete() {
    if (!hardDeleteTarget) return;
    if (hardDeleteInput.trim() !== "ELIMINAR") {
      setActionError("Debes escribir exactamente ELIMINAR para confirmar la destrucción.");
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/union/licenses/permanent", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: hardDeleteTarget.id,
          confirmation_text: hardDeleteInput.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "No se pudo eliminar definitivamente.");
      }
      setHardDeleteTarget(null);
      setHardDeleteInput("");
      await fetchList();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Error en eliminación definitiva");
    } finally {
      setActionBusy(false);
    }
  }

  // Imprimir paquete PDF conjunto directamente
  async function handlePrintPackage(cId: string, cFolio: string) {
    setPrintingCaseId(cId);
    try {
      const res = await fetch("/api/union/licenses/print-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: cId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "No se pudo generar el paquete.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, "_blank", "noopener,noreferrer");
      if (!newTab) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `expediente-licencia-${cFolio}.pdf`;
        a.click();
      }
      await fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al imprimir paquete");
    } finally {
      setPrintingCaseId(null);
    }
  }

  // Mandar a imprimir a la oficina sindical de forma automática y silenciosa
  async function handleAutoPrint(cId: string) {
    setAutoPrintingCaseId(cId);
    try {
      const res = await fetch("/api/union/print/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: cId, copies: 1 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo enviar a la impresora.");
      setAutoPrintSuccessId(cId);
      setTimeout(() => setAutoPrintSuccessId(null), 4000);
      await fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al enviar a impresora.");
    } finally {
      setAutoPrintingCaseId(null);
    }
  }

  // Descargar Word o Excel individual
  async function handleDownloadDoc(cId: string, cFolio: string, kind: "word" | "excel") {
    setDownloadingKind({ id: cId, kind });
    try {
      const res = await fetch(`/api/union/licenses/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: cId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error al generar ${kind}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "excel" ? `licencia-${cFolio}.xlsm` : `oficio-licencia-${cFolio}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      await fetchList();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : `Error al descargar ${kind}`);
    } finally {
      setDownloadingKind(null);
    }
  }

  // Vista del Wizard
  if (isWizard) {
    return (
      <LicenseWizard
        initialCaseId={activeCaseId}
        isEditMode={isEditMode}
        onBack={() => {
          startTransition(() => {
            router.push("/representacion/licencias");
          });
          void fetchList();
        }}
        onSuccess={() => {
          void fetchList();
        }}
      />
    );
  }

  // Separar borradores y trámites completados
  const draftCases = cases.filter((c) => c.status === "draft" && !c.deletedAt);
  const completedCases = cases.filter((c) => c.status !== "draft" && !c.deletedAt);
  const deletedCases = cases.filter((c) => Boolean(c.deletedAt));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* 1. Header centralizado de la sección */}
      <RepresentationSectionHeader
        title="Licencias"
        subtitle="Gestión de expedientes de licencias sindicales con y sin goce de sueldo · Delegación XXI"
        primaryAction={
          <Button onClick={handleNewLicense}>
            + Nueva licencia
          </Button>
        }
      />

      {/* 2. Tarjetas de métricas de resumen */}
      <RepresentationSummaryMetrics>
        <RepresentationMetricCard
          label="Borradores"
          value={summary.draftsCount}
          subtext="En captura progresiva"
          accentColor={summary.draftsCount > 0 ? "#d97706" : undefined}
          onClick={() => setStatusFilter("draft")}
        />
        <RepresentationMetricCard
          label="Completados"
          value={summary.completedCount}
          subtext="Documentos emitibles"
          accentColor="#059669"
          onClick={() => setStatusFilter("completed")}
        />
        <RepresentationMetricCard
          label="Total trámites"
          value={summary.totalCount}
          subtext="Expedientes en padrón"
          onClick={() => setStatusFilter("all")}
        />
        {summary.deletedCount > 0 && (
          <RepresentationMetricCard
            label="En papelera"
            value={summary.deletedCount}
            subtext="Borrados lógicamente"
            accentColor="#6b7280"
            onClick={() => setStatusFilter("deleted")}
          />
        )}
      </RepresentationSummaryMetrics>

      {/* 3. Toolbar con buscador y filtros de estado */}
      <RepresentationToolbar
        search={
          <RepresentationSearchInput
            placeholder="Buscar por folio, trabajador o matrícula…"
            value={search}
            onChange={(val) => setSearch(val)}
          />
        }
        filters={
          <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
            <Button
              size="sm"
              variant={statusFilter === "all" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("all")}
            >
              Todos
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "draft" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("draft")}
            >
              Borradores ({summary.draftsCount})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === "completed" ? "primary" : "secondary"}
              onClick={() => setStatusFilter("completed")}
            >
              Completados ({summary.completedCount})
            </Button>
            {summary.deletedCount > 0 && (
              <Button
                size="sm"
                variant={statusFilter === "deleted" ? "primary" : "secondary"}
                onClick={() => setStatusFilter("deleted")}
              >
                Papelera ({summary.deletedCount})
              </Button>
            )}
          </div>
        }
      />

      {/* Estado de carga */}
      {loading ? (
        <RepresentationLoadingSkeleton />
      ) : statusFilter === "deleted" ? (
        /* ========================================================================= */
        /* VISTA DE PAPELERA (ELIMINADOS)                                            */
        /* ========================================================================= */
        <Card>
          <div style={{ padding: "0.5rem 0 1rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1.125rem", color: "var(--fg)" }}>Papelera de trámites de licencias</h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Expedientes eliminados lógicamente. Los administradores pueden restaurarlos o eliminarlos de manera definitiva.
            </p>
          </div>

          {deletedCases.length === 0 ? (
            <RepresentationEmptyState
              title="La papelera está vacía"
              description="No hay trámites eliminados en esta delegación."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {deletedCases.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--accent)",
                    flexWrap: "wrap",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9375rem" }}>
                        {c.folio}
                      </span>
                      <RepresentationStatusBadge status="cancelled" label="ELIMINADO" />
                    </div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--fg)", marginTop: "0.2rem" }}>
                      {c.worker?.fullName ?? "Sin trabajador"} · Mat. {c.worker?.employeeNumber ?? "—"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                      Eliminado el {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString("es-MX") : "—"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <Button size="sm" variant="secondary" onClick={() => setRestoreTarget(c)}>
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ color: "#b91c1c" }}
                      onClick={() => {
                        setHardDeleteTarget(c);
                        setHardDeleteInput("");
                      }}
                    >
                      Eliminar definitivamente
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        /* ========================================================================= */
        /* VISTA PRINCIPAL: BORRADORES + HISTORIAL                                   */
        /* ========================================================================= */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* SECCIÓN 1: BORRADORES PENDIENTES */}
          {(statusFilter === "all" || statusFilter === "draft") && draftCases.length > 0 && (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--fg)" }}>
                  Borradores en curso ({draftCases.length})
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  Trámites guardados progresivamente
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                {draftCases.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "0.875rem",
                      borderRadius: "8px",
                      border: "1px solid #fde68a",
                      backgroundColor: "#fffbeb",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.875rem", color: "#92400e" }}>
                          {c.folio}
                        </span>
                        <span style={{ fontSize: "0.6875rem", fontWeight: 700, backgroundColor: "#fef3c7", color: "#b45309", padding: "0.15rem 0.45rem", borderRadius: "999px" }}>
                          BORRADOR · PASO {c.currentStep}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)", marginTop: "0.35rem" }}>
                        {c.worker?.fullName || "Sin trabajador asignado"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        {c.worker?.category || "Categoría pendiente"} · Mat. {c.worker?.employeeNumber || "—"}
                      </div>
                      {c.license?.startDate && c.license?.endDate && (
                        <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "0.25rem" }}>
                          {c.license.withPay ? "Con goce" : "Sin goce"} · {c.license.totalDays} días
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem", paddingTop: "0.5rem", borderTop: "1px solid #fef3c7" }}>
                      <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                        {new Date(c.updatedAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <Button size="sm" variant="primary" onClick={() => handleContinueDraft(c)}>
                          Continuar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setSoftDeleteTarget(c)}>
                          🗑️
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* SECCIÓN 2: HISTORIAL DE TRÁMITES COMPLETADOS */}
          {(statusFilter === "all" || statusFilter === "completed") && (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--fg)" }}>
                  Historial de expedientes ({completedCases.length})
                </h3>
              </div>

              {completedCases.length === 0 ? (
                <RepresentationEmptyState
                  title="No hay trámites completados"
                  description="Los expedientes completados aparecerán aquí para impresión y consulta."
                  actionLabel="+ Nueva licencia"
                  onAction={handleNewLicense}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {completedCases.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.875rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--card)",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                      }}
                    >
                      {/* Columna Izquierda: Folio + Trabajador + Periodo */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.9375rem" }}>
                            {c.folio}
                          </span>
                          <RepresentationStatusBadge status="completed" label="COMPLETADO" />
                          <span style={{ fontSize: "0.6875rem", backgroundColor: "var(--accent)", color: "var(--muted)", padding: "0.1rem 0.4rem", borderRadius: "4px" }}>
                            Rev. {c.revisionNumber}
                          </span>
                          {c.isOutdated && (
                            <span style={{ fontSize: "0.6875rem", backgroundColor: "#fef3c7", color: "#b45309", padding: "0.1rem 0.4rem", borderRadius: "4px", fontWeight: 600 }}>
                              Desactualizado
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                          {c.worker?.fullName} · <span style={{ color: "var(--muted)", fontWeight: 400 }}>Mat. {c.worker?.employeeNumber}</span>
                        </div>

                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {c.worker?.category} · <strong>{c.license?.withPay ? "Con goce" : "Sin goce"}</strong> ({c.license?.totalDays} días) · {c.license?.startDate} al {c.license?.endDate}
                        </div>
                      </div>

                      {/* Columna Derecha: Acciones */}
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        <Button size="sm" variant="ghost" onClick={() => handleViewDetail(c.id)}>
                          Ver
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleEditCase(c)}>
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={autoPrintingCaseId === c.id}
                          onClick={() => handleAutoPrint(c.id)}
                          title="Mandar a la impresora de la oficina sindical sin diálogos"
                        >
                          {autoPrintSuccessId === c.id ? "✓ Enviado" : "🖨️ Mandar a imprimir"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={printingCaseId === c.id}
                          onClick={() => handlePrintPackage(c.id, c.folio)}
                          title="Ver ambos en el navegador"
                        >
                          👁️ Ver ambos
                        </Button>

                        {/* Menú de acciones secundarias */}
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Descargar Oficio Word"
                            loading={downloadingKind?.id === c.id && downloadingKind.kind === "word"}
                            onClick={() => handleDownloadDoc(c.id, c.folio, "word")}
                          >
                            📄 Word
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Descargar Formato XLSM"
                            loading={downloadingKind?.id === c.id && downloadingKind.kind === "excel"}
                            onClick={() => handleDownloadDoc(c.id, c.folio, "excel")}
                          >
                            📊 XLSM
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Eliminar trámite"
                            style={{ color: "#b91c1c" }}
                            onClick={() => setSoftDeleteTarget(c)}
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER GLOBAL: DETALLE DEL TRÁMITE CON HISTORIAL Y REVISIONES              */}
      {/* ========================================================================= */}
      <RepresentationSheet
        open={showDetailSheet}
        onClose={() => setShowDetailSheet(false)}
        title={detailCase ? `Expediente ${detailCase.folio}` : "Detalle del expediente"}
      >
        {loadingDetail ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
            Cargando detalle completo...
          </div>
        ) : detailCase ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Encabezado del caso */}
            <div style={{ padding: "0.75rem", backgroundColor: "var(--accent)", borderRadius: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "1rem" }}>
                  {detailCase.folio}
                </span>
                <RepresentationStatusBadge
                  status={detailCase.status === "completed" ? "completed" : detailCase.status === "draft" ? "draft" : "active"}
                  label={detailCase.status.toUpperCase()}
                />
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                Revisión actual: <strong>Rev. {detailCase.revisionNumber}</strong> · Documentos generados: <strong>Rev. {detailCase.documentRevision}</strong>
              </div>
              {detailCase.isOutdated && (
                <div style={{ fontSize: "0.75rem", color: "#b45309", fontWeight: 600, marginTop: "0.25rem" }}>
                  ⚠️ Los datos fueron modificados. Se requiere regenerar documentos.
                </div>
              )}
            </div>

            {/* Datos del Trabajador */}
            <div>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "var(--muted)", textTransform: "uppercase" }}>
                Trabajador
              </h4>
              <div style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                <div><strong>Nombre:</strong> {detailCase.worker ? `${detailCase.worker.paternal_surname} ${detailCase.worker.maternal_surname} ${detailCase.worker.first_name}` : "—"}</div>
                <div><strong>Matrícula:</strong> {detailCase.worker?.employee_number || "—"}</div>
                <div><strong>Categoría:</strong> {detailCase.worker?.category || "—"}</div>
                <div><strong>Adscripción:</strong> {detailCase.worker?.assignment || "—"}</div>
                <div><strong>Turno / Horario:</strong> {detailCase.worker?.turn || "—"} ({detailCase.worker?.schedule || "—"})</div>
                <div><strong>Descansos:</strong> {detailCase.worker?.rest_days || "—"}</div>
              </div>
            </div>

            {/* Datos de la Licencia */}
            {detailCase.license && (
              <div>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "var(--muted)", textTransform: "uppercase" }}>
                  Detalle de la Licencia
                </h4>
                <div style={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
                  <div><strong>Régimen:</strong> {detailCase.license.withPay ? "Con goce de sueldo" : "Sin goce de sueldo"}</div>
                  <div><strong>Periodo:</strong> {detailCase.license.startDate} al {detailCase.license.endDate} ({detailCase.license.totalDays} días)</div>
                  <div><strong>Motivo:</strong> {detailCase.license.reason}</div>
                  <div><strong>Comprobante:</strong> {detailCase.license.proofDescription || "Ninguno"}</div>
                  <div><strong>Prórroga:</strong> {detailCase.license.isExtension ? `Sí (Licencia previa: ${detailCase.license.previousStartDate} al ${detailCase.license.previousEndDate})` : "No"}</div>
                  {detailCase.license.notes && <div><strong>Observaciones:</strong> {detailCase.license.notes}</div>}
                </div>
              </div>
            )}

            {/* Acciones del Trámite */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
              <Button
                variant="primary"
                fullWidth
                loading={autoPrintingCaseId === detailCase.id}
                onClick={() => handleAutoPrint(detailCase.id)}
              >
                {autoPrintSuccessId === detailCase.id ? "✓ Enviado a impresora de oficina" : "🖨️ Mandar a imprimir (Oficina Sindical)"}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                loading={printingCaseId === detailCase.id}
                onClick={() => handlePrintPackage(detailCase.id, detailCase.folio)}
              >
                👁️ Ver e imprimir en navegador (Ambos)
              </Button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={downloadingKind?.id === detailCase.id && downloadingKind.kind === "word"}
                  onClick={() => handleDownloadDoc(detailCase.id, detailCase.folio, "word")}
                >
                  📄 Descargar Word
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={downloadingKind?.id === detailCase.id && downloadingKind.kind === "excel"}
                  onClick={() => handleDownloadDoc(detailCase.id, detailCase.folio, "excel")}
                >
                  📊 Descargar XLSM
                </Button>
              </div>
            </div>

            {/* Historial de Revisiones */}
            {detailCase.revisions && detailCase.revisions.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "var(--muted)", textTransform: "uppercase" }}>
                  Historial de Revisiones ({detailCase.revisions.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {detailCase.revisions.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "var(--accent)",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                        <span>Revisión {rev.revisionNumber}</span>
                        <span style={{ color: "var(--muted)" }}>{new Date(rev.createdAt).toLocaleDateString("es-MX")}</span>
                      </div>
                      <div style={{ color: "var(--fg)", marginTop: "0.15rem" }}>{rev.changeSummary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historial Cronológico de Eventos */}
            {detailCase.events && detailCase.events.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "var(--muted)", textTransform: "uppercase" }}>
                  Bitácora de Eventos
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {detailCase.events.map((evt) => (
                    <div
                      key={evt.id}
                      style={{
                        padding: "0.4rem 0.5rem",
                        borderLeft: "2px solid var(--primary)",
                        backgroundColor: "var(--accent)",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "var(--fg)" }}>{evt.title}</div>
                      <div style={{ color: "var(--muted)" }}>{evt.detail}</div>
                      <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.1rem" }}>
                        {new Date(evt.createdAt).toLocaleString("es-MX")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </RepresentationSheet>

      {/* ========================================================================= */}
      {/* MODAL GLOBAL: CONFIRMACIÓN DE SOFT DELETE                                 */}
      {/* ========================================================================= */}
      {softDeleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "8px",
              padding: "1.5rem",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}>Eliminar trámite</h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--muted)" }}>
              ¿Deseas eliminar el trámite <strong>{softDeleteTarget.folio}</strong> ({softDeleteTarget.worker?.fullName})? Esta acción lo quitará del historial activo y lo enviará a la papelera.
            </p>
            {actionError && (
              <p role="alert" style={{ color: "#b91c1c", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                {actionError}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="secondary" onClick={() => setSoftDeleteTarget(null)} disabled={actionBusy}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => void confirmSoftDelete()} loading={actionBusy}>
                Eliminar trámite
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL GLOBAL: CONFIRMACIÓN DE RESTORE                                     */}
      {/* ========================================================================= */}
      {restoreTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "8px",
              padding: "1.5rem",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}>Restaurar trámite</h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--muted)" }}>
              ¿Deseas restaurar el trámite <strong>{restoreTarget.folio}</strong> al historial activo?
            </p>
            {actionError && (
              <p role="alert" style={{ color: "#b91c1c", fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
                {actionError}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="secondary" onClick={() => setRestoreTarget(null)} disabled={actionBusy}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={() => void confirmRestore()} loading={actionBusy}>
                Restaurar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL GLOBAL: CONFIRMACIÓN DE HARD DELETE DEFINITIVO (ADMIN)              */}
      {/* ========================================================================= */}
      {hardDeleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card)",
              borderRadius: "8px",
              padding: "1.5rem",
              maxWidth: "440px",
              width: "100%",
              border: "1px solid #fca5a5",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", color: "#b91c1c" }}>
              Eliminar definitivamente
            </h3>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "var(--fg)" }}>
              Esta acción destruirá de forma permanente el expediente <strong>{hardDeleteTarget.folio}</strong> y todo su historial de revisiones y eventos.
            </p>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Para confirmar, escribe exactamente <strong>ELIMINAR</strong> en el siguiente campo:
            </p>

            <Input
              value={hardDeleteInput}
              onChange={(e) => setHardDeleteInput(e.target.value)}
              placeholder="Escribe ELIMINAR"
            />

            {actionError && (
              <p role="alert" style={{ color: "#b91c1c", fontSize: "0.8125rem", marginTop: "0.5rem" }}>
                {actionError}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <Button variant="secondary" onClick={() => setHardDeleteTarget(null)} disabled={actionBusy}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                style={{ backgroundColor: "#b91c1c", borderColor: "#b91c1c" }}
                disabled={hardDeleteInput.trim() !== "ELIMINAR" || actionBusy}
                loading={actionBusy}
                onClick={() => void confirmHardDelete()}
              >
                Eliminar definitivamente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
