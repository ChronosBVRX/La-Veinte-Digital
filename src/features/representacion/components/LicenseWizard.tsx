"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { WorkerPicker, type UnionWorkerOption } from "./WorkerPicker";
import { calculateLicense } from "../lib/licenses";
import { resolveUnionWorkerName } from "../services/worker-name-resolver";
import { Printer } from "@phosphor-icons/react";

export interface LicenseWizardProps {
  initialCaseId?: string | null;
  isEditMode?: boolean;
  onBack?: () => void;
  onSuccess?: (caseId: string, folio: string) => void;
}

export function LicenseWizard({
  initialCaseId,
  isEditMode = false,
  onBack,
  onSuccess,
}: LicenseWizardProps): React.JSX.Element {
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [withPay, setWithPay] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isExtension, setIsExtension] = useState(false);
  const [prevStart, setPrevStart] = useState("");
  const [prevEnd, setPrevEnd] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState("");
  const [notes, setNotes] = useState("");
  const [restDays, setRestDays] = useState("");
  const [phone, setPhone] = useState("");
  const [changeSummary, setChangeSummary] = useState("");

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [caseId, setCaseId] = useState<string | null>(initialCaseId ?? null);
  const [folio, setFolio] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [revisionNumber, setRevisionNumber] = useState<number>(1);
  const [documentRevision, setDocumentRevision] = useState<number>(0);
  const [isOutdated, setIsOutdated] = useState<boolean>(false);

  const [loadingInitial, setLoadingInitial] = useState(Boolean(initialCaseId));
  const [busy, setBusy] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);
  const [printingPackage, setPrintingPackage] = useState(false);

  // Estados de Impresión Automática en Oficina Sindical
  const [autoPrintStatus, setAutoPrintStatus] = useState<"idle" | "preparing" | "queued" | "printing" | "printed" | "failed">("idle");
  const [autoPrintStation, setAutoPrintStation] = useState<{ name: string; printer_name: string; is_online: boolean } | null>(null);
  const [autoPrintError, setAutoPrintError] = useState<string | null>(null);
  const [lastPrintedTime, setLastPrintedTime] = useState<string | null>(null);
  const [showReprintConfirm, setShowReprintConfirm] = useState(false);

  // Detección de cambios sin guardar en modo edición
  const [isDirty, setIsDirty] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const isInitialLoad = useRef(true);

  // Cargar datos iniciales si se proporcionó initialCaseId
  useEffect(() => {
    if (!initialCaseId) {
      isInitialLoad.current = false;
      return;
    }

    let isMounted = true;
    async function loadCase() {
      setLoadingInitial(true);
      setError(null);
      try {
        const res = await fetch(`/api/union/licenses?case_id=${initialCaseId}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "No se pudo cargar el expediente.");
        }
        const data = await res.json();
        const c = data.case;
        if (!isMounted || !c) return;

        setCaseId(c.id);
        setFolio(c.folio);
        setStatus(c.status);
        setRevisionNumber(c.revisionNumber ?? 1);
        setDocumentRevision(c.documentRevision ?? 0);
        setIsOutdated(Boolean(c.isOutdated));

        if (c.worker) {
          const rawWorker = c.worker as Record<string, unknown>;
          setWorker({
            id: c.worker.id,
            employee_number: String(rawWorker.employee_number ?? rawWorker.employeeNumber ?? ""),
            first_name: String(rawWorker.first_name ?? rawWorker.firstName ?? ""),
            paternal_surname: String(rawWorker.paternal_surname ?? rawWorker.paternalSurname ?? ""),
            maternal_surname: String(rawWorker.maternal_surname ?? rawWorker.maternalSurname ?? ""),
            siap_full_name: typeof rawWorker.siap_full_name === "string" ? rawWorker.siap_full_name : typeof rawWorker.siapFullName === "string" ? rawWorker.siapFullName : undefined,
            category: String(rawWorker.category ?? ""),
            assignment: String(rawWorker.assignment ?? ""),
            turn: String(rawWorker.turn ?? ""),
            schedule: typeof rawWorker.schedule === "string" ? rawWorker.schedule : undefined,
            rest_days: typeof rawWorker.rest_days === "string" ? rawWorker.rest_days : typeof rawWorker.restDays === "string" ? rawWorker.restDays : undefined,
            phone: typeof rawWorker.phone === "string" ? rawWorker.phone : undefined,
          });
        }

        if (c.license) {
          setWithPay(Boolean(c.license.withPay));
          setStart(c.license.startDate ?? "");
          setEnd(c.license.endDate ?? "");
          setIsExtension(Boolean(c.license.isExtension));
          setPrevStart(c.license.previousStartDate ?? "");
          setPrevEnd(c.license.previousEndDate ?? "");
          setReason(c.license.reason ?? "");
          setProof(c.license.proofDescription ?? "");
          setNotes(c.license.notes ?? "");
          setRestDays(c.license.restDays ?? c.worker?.rest_days ?? "");
          setPhone(c.license.phone ?? c.worker?.phone ?? "");
        } else if (c.worker) {
          setRestDays(c.worker.rest_days ?? "");
          setPhone(c.worker.phone ?? "");
        }

        // Si el caso está en draft, restaurar el paso guardado
        if (c.status === "draft") {
          const savedStep = (c.currentStep as 1 | 2 | 3) || 1;
          setStep(savedStep);
        } else {
          // Si está completado o en edición, colocar en el paso adecuado
          setStep(isEditMode ? 1 : 3);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Error al cargar expediente");
        }
      } finally {
        if (isMounted) {
          setLoadingInitial(false);
          isInitialLoad.current = false;
        }
      }
    }

    loadCase();
    return () => {
      isMounted = false;
    };
  }, [initialCaseId, isEditMode]);

  // Marcador de cambios cuando el usuario edita campos
  useEffect(() => {
    if (isInitialLoad.current || loadingInitial) return;
    setIsDirty(true);
  }, [worker, withPay, start, end, isExtension, prevStart, prevEnd, reason, proof, notes, restDays, phone, loadingInitial]);

  const preview = (() => {
    try {
      return start && end ? calculateLicense({ withPay, startISO: start, endISO: end }) : null;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Error" };
    }
  })();

  const resolvedWorker = worker ? resolveUnionWorkerName(worker) : null;
  const workerDisplayName = resolvedWorker?.displayName || "";
  const isWorkerMissingName = worker ? !resolvedWorker?.validForLicense : false;
  const isWorkerMissingMatricula = worker ? !worker.employee_number?.trim() : false;

  // Autoguardado del borrador progresivo
  async function triggerDraftAutosave(targetStep?: number): Promise<string | null> {
    if (isEditMode || status !== "draft") return caseId;
    if (!worker) return null;

    setAutoSaving(true);
    try {
      const res = await fetch("/api/union/licenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId || undefined,
          worker_id: worker.id,
          current_step: targetStep ?? step,
          with_pay: withPay,
          start_date: start || null,
          end_date: end || null,
          is_extension: isExtension,
          previous_start_date: prevStart || null,
          previous_end_date: prevEnd || null,
          reason: reason || null,
          proof_description: proof || null,
          notes: notes || null,
          rest_days: restDays ? restDays.trim() : null,
          phone: phone ? phone.trim() : null,
        }),
      });

      if (!res.ok) return null;

      const j = await res.json();
      if (j.caseId) {
        setCaseId(j.caseId);
        setFolio(j.folio);
        return j.caseId;
      }
    } catch {
      // El autoguardado es silencioso para no interrumpir la experiencia de escritura
    } finally {
      setAutoSaving(false);
    }
    return null;
  }

  // Avanzar de paso en el Wizard con guardado automático
  async function goToStep(nextStep: 1 | 2 | 3): Promise<void> {
    setError(null);

    if (nextStep > 1 && !worker) {
      setError("Selecciona al trabajador antes de continuar.");
      return;
    }

    if (nextStep > 1 && (isWorkerMissingName || isWorkerMissingMatricula)) {
      setError("El trabajador seleccionado requiere nombre y matrícula válidos.");
      return;
    }

    if (nextStep === 3) {
      if (!start || !end) {
        setError("Selecciona las fechas de inicio y término.");
        return;
      }
      if (preview && "error" in preview) {
        setError(preview.error);
        return;
      }
      if (!reason.trim()) {
        setError("El motivo de la licencia es indispensable.");
        return;
      }
    }

    setStep(nextStep);
    await triggerDraftAutosave(nextStep);
  }

  // Finalizar trámite (de draft a completed)
  async function finalizeCase(): Promise<void> {
    setError(null);
    setSuccessMessage(null);

    if (!worker) {
      setError("Selecciona al trabajador.");
      return;
    }
    if (isWorkerMissingName || isWorkerMissingMatricula) {
      setError("El trabajador debe tener nombre y matrícula registrados.");
      return;
    }
    if (!start || !end) {
      setError("Selecciona las fechas de inicio y término.");
      return;
    }
    if (preview && "error" in preview) {
      setError(preview.error);
      return;
    }
    if (!reason.trim()) {
      setError("Captura el motivo de la licencia (indispensable).");
      return;
    }

    setBusy(true);
    try {
      // Si aún no se creó el borrador, guardarlo primero
      let activeCaseId = caseId;
      if (!activeCaseId) {
        activeCaseId = await triggerDraftAutosave(3);
      }
      if (!activeCaseId) throw new Error("No se pudo iniciar el expediente.");

      const res = await fetch("/api/union/licenses/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: activeCaseId,
          worker_id: worker.id,
          with_pay: withPay,
          start_date: start,
          end_date: end,
          is_extension: isExtension,
          previous_start_date: prevStart || null,
          previous_end_date: prevEnd || null,
          reason: reason.trim(),
          proof_description: proof.trim(),
          notes: notes.trim(),
          rest_days: restDays ? restDays.trim() : null,
          phone: phone ? phone.trim() : null,
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "No se pudo finalizar el trámite.");

      setStatus("completed");
      setFolio(j.folio);
      setStep(3);
      setIsDirty(false);
      setSuccessMessage(`¡Trámite ${j.folio} completado con éxito! Ya puedes emitir los documentos oficiales.`);
      onSuccess?.(activeCaseId, j.folio);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al finalizar el trámite.");
    } finally {
      setBusy(false);
    }
  }

  // Guardar cambios explícitos en modo edición (completed case)
  async function saveExplicitEdit(): Promise<void> {
    if (!caseId) return;
    setError(null);
    setConflictError(null);
    setSuccessMessage(null);

    if (!start || !end) {
      setError("Las fechas de inicio y término son indispensables.");
      return;
    }
    if (preview && "error" in preview) {
      setError(preview.error);
      return;
    }
    if (!reason.trim()) {
      setError("El motivo es indispensable.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/union/licenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          expected_revision: revisionNumber,
          change_summary: changeSummary.trim() || undefined,
          worker_id: worker?.id,
          with_pay: withPay,
          start_date: start,
          end_date: end,
          is_extension: isExtension,
          previous_start_date: prevStart || null,
          previous_end_date: prevEnd || null,
          reason: reason.trim(),
          proof_description: proof.trim(),
          notes: notes.trim(),
          rest_days: restDays ? restDays.trim() : null,
          phone: phone ? phone.trim() : null,
        }),
      });

      const j = await res.json();
      if (res.status === 409) {
        setConflictError(j.error ?? "Conflicto de concurrencia. Alguien más modificó este trámite.");
        return;
      }

      if (!res.ok) {
        throw new Error(j.error ?? "Error al guardar cambios de la licencia.");
      }

      setRevisionNumber(j.revisionNumber);
      setIsOutdated(true);
      setIsDirty(false);
      setSuccessMessage(`Cambios guardados con éxito. Nueva revisión asignada: Rev. ${j.revisionNumber}. Folio conservado: ${j.folio}.`);
      setStep(3);
      onSuccess?.(caseId, j.folio);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar los cambios.");
    } finally {
      setBusy(false);
    }
  }

  async function download(kind: "excel" | "word"): Promise<void> {
    if (!caseId) return;
    setError(null);
    if (kind === "excel") setDownloadingExcel(true);
    else setDownloadingWord(true);

    try {
      const res = await fetch(`/api/union/licenses/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `No se pudo generar el documento ${kind}.`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "excel" ? `licencia-${folio ?? ""}.xlsm` : `oficio-licencia-${folio ?? ""}.docx`;
      a.click();
      URL.revokeObjectURL(url);

      // Los documentos ahora reflejan la revisión actual
      setDocumentRevision(revisionNumber);
      setIsOutdated(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Error al descargar ${kind}.`);
    } finally {
      if (kind === "excel") setDownloadingExcel(false);
      else setDownloadingWord(false);
    }
  }

  async function printPackage(): Promise<void> {
    if (!caseId) return;
    setError(null);
    setPrintingPackage(true);

    try {
      const res = await fetch("/api/union/licenses/print-package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "No se pudo generar el paquete de impresión.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, "_blank", "noopener,noreferrer");
      if (!newTab) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `expediente-licencia-${folio ?? ""}.pdf`;
        a.click();
      }

      // Los documentos ahora reflejan la revisión actual
      setDocumentRevision(revisionNumber);
      setIsOutdated(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al generar paquete de impresión.");
    } finally {
      setPrintingPackage(false);
    }
  }

  // Cargar estado de la estación de oficina en Paso 3
  useEffect(() => {
    if (step !== 3 || !caseId) return;

    let cancelled = false;
    async function loadPrintStatus() {
      try {
        const res = await fetch("/api/union/print/stations/status", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled && j.success && j.station) {
          setAutoPrintStation(j.station);
        }
      } catch {
        // Silently continue
      }
    }
    loadPrintStatus();

    return () => {
      cancelled = true;
    };
  }, [step, caseId]);

  // Enviar a imprimir automáticamente sin diálogos
  async function triggerAutoPrint(): Promise<void> {
    if (!caseId) return;
    setError(null);
    setAutoPrintError(null);
    setAutoPrintStatus("preparing");

    try {
      const res = await fetch("/api/union/print/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, copies: 1 }),
      });

      const j = await res.json();
      if (!res.ok) {
        throw new Error(j.error || "No se pudo enviar a la impresora.");
      }

      setAutoPrintStatus("queued");

      const pollInterval = setInterval(async () => {
        try {
          const checkRes = await fetch(`/api/union/print/jobs?delegation_id=${j.job.delegation_id}`, { cache: "no-store" });
          if (!checkRes.ok) return;
          const checkData = await checkRes.json();
          if (!checkData.success) return;

          const isPrinted = (checkData.recent as Array<{ id: string }> | undefined)?.find((x) => x.id === j.job.id);
          if (isPrinted) {
            setAutoPrintStatus("printed");
            setLastPrintedTime(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
            clearInterval(pollInterval);
            return;
          }

          const isPrinting = (checkData.printing as Array<{ id: string }> | undefined)?.find((x) => x.id === j.job.id);
          if (isPrinting) {
            setAutoPrintStatus("printing");
            return;
          }

          const isFailed = (checkData.failed as Array<{ id: string; error_message?: string }> | undefined)?.find((x) => x.id === j.job.id);
          if (isFailed) {
            setAutoPrintStatus("failed");
            setAutoPrintError(isFailed.error_message || "La impresora no pudo completar el trabajo.");
            clearInterval(pollInterval);
            return;
          }
        } catch {
          // Keep polling
        }
      }, 2500);

      setTimeout(() => clearInterval(pollInterval), 90000);
    } catch (err: unknown) {
      setAutoPrintStatus("failed");
      setAutoPrintError(err instanceof Error ? err.message : "Error al enviar a la impresora.");
    }
  }

  function handleBackClick() {
    if (isDirty && isEditMode) {
      setShowExitConfirm(true);
    } else {
      onBack?.();
    }
  }

  if (loadingInitial) {
    return (
      <Card>
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          Cargando datos del expediente...
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", position: "relative" }}>
      {/* Botón superior de regreso y banner de estado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={handleBackClick}>
            ← Volver al historial
          </Button>
        ) : <div />}

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {autoSaving && (
            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic" }}>
              Autoguardando borrador...
            </span>
          )}
          {folio && (
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: 600,
                fontSize: "0.875rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "4px",
                backgroundColor: "var(--accent)",
              }}
            >
              {folio}
            </span>
          )}
        </div>
      </div>

      {/* Banner de Modo Edición */}
      {isEditMode && folio && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            color: "#1e40af",
            fontSize: "0.875rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong>Editando licencia:</strong> {folio} · Revisión {revisionNumber}
          </div>
          <span style={{ fontSize: "0.75rem", backgroundColor: "#dbeafe", padding: "0.15rem 0.5rem", borderRadius: "999px", fontWeight: 600 }}>
            MODO EDICIÓN
          </span>
        </div>
      )}

      {/* Alerta de Documentos Desactualizados */}
      {isOutdated && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fffbeb",
            border: "1px solid #fef3c7",
            borderRadius: "6px",
            color: "#b45309",
            fontSize: "0.875rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem" }}>
            ⚠️ Los datos del trámite cambiaron.
          </div>
          <div style={{ fontSize: "0.8125rem" }}>
            Vuelve a generar los documentos para reflejar la información actual (Revisión actual: {revisionNumber} · Documentos previos: Rev. {documentRevision}).
          </div>
        </div>
      )}

      {/* Mensaje de conflicto de concurrencia */}
      {conflictError && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            color: "#b91c1c",
            fontSize: "0.875rem",
          }}
        >
          <strong>Conflicto detectado:</strong> {conflictError}
          <div style={{ marginTop: "0.5rem" }}>
            <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
              Recargar página
            </Button>
          </div>
        </div>
      )}

      {/* Mensaje de Éxito */}
      {successMessage && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "6px",
            color: "#15803d",
            fontSize: "0.875rem",
            fontWeight: 500,
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Barra de progreso de pasos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "0.5rem",
          marginBottom: "0.25rem",
        }}
      >
        <button
          type="button"
          onClick={() => void goToStep(1)}
          style={{
            padding: "0.5rem",
            borderRadius: "6px",
            border: "none",
            backgroundColor: step === 1 ? "var(--primary)" : "var(--accent)",
            color: step === 1 ? "var(--primary-fg)" : "var(--fg)",
            fontWeight: step === 1 ? 600 : 400,
            fontSize: "0.8125rem",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          1. Trabajador y tipo
        </button>
        <button
          type="button"
          onClick={() => void goToStep(2)}
          disabled={!worker}
          style={{
            padding: "0.5rem",
            borderRadius: "6px",
            border: "none",
            backgroundColor: step === 2 ? "var(--primary)" : "var(--accent)",
            color: step === 2 ? "var(--primary-fg)" : "var(--fg)",
            fontWeight: step === 2 ? 600 : 400,
            fontSize: "0.8125rem",
            cursor: worker ? "pointer" : "not-allowed",
            textAlign: "center",
            opacity: worker ? 1 : 0.6,
          }}
        >
          2. Fechas y motivo
        </button>
        <button
          type="button"
          onClick={() => void goToStep(3)}
          disabled={!worker || !start || !end || !reason.trim()}
          style={{
            padding: "0.5rem",
            borderRadius: "6px",
            border: "none",
            backgroundColor: step === 3 ? "var(--primary)" : "var(--accent)",
            color: step === 3 ? "var(--primary-fg)" : "var(--fg)",
            fontWeight: step === 3 ? 600 : 400,
            fontSize: "0.8125rem",
            cursor: worker && start && end && reason.trim() ? "pointer" : "not-allowed",
            textAlign: "center",
            opacity: worker && start && end && reason.trim() ? 1 : 0.6,
          }}
        >
          3. Emisión y documentos
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PASO 1: TRABAJADOR Y TIPO DE LICENCIA                                     */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <WorkerPicker
            selected={worker}
            onSelect={(w) => {
              setWorker(w);
              if (w) {
                if (!restDays && w.rest_days) setRestDays(w.rest_days);
                if (!phone && w.phone) setPhone(w.phone);
              }
            }}
          />

          <Card>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Tipo de remuneración</h2>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }} role="radiogroup" aria-label="Tipo de licencia">
              <Button variant={!withPay ? "primary" : "secondary"} onClick={() => setWithPay(false)}>
                Sin goce de sueldo
              </Button>
              <Button variant={withPay ? "primary" : "secondary"} onClick={() => setWithPay(true)}>
                Con goce de sueldo
              </Button>
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              {withPay
                ? "Con goce: hasta 3 días naturales por causas de fuerza mayor o cuidados especiales."
                : "Sin goce: de 1 a 3 días, de 4 a 60 días, o de 61 a 365 días según Cláusula 42 del CCT."}
            </p>
          </Card>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              onClick={() => void goToStep(2)}
              disabled={!worker || isWorkerMissingName || isWorkerMissingMatricula}
            >
              Continuar a fechas y motivo →
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 2: FECHAS, PRÓRROGA, MOTIVO Y COMPROBANTES                           */}
      {/* ========================================================================= */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Card>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Periodo de la licencia</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.5rem" }}>
              <Input label="Inicio" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <Input label="Término" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            {preview && "totalDays" in preview ? (
              <p style={{ fontSize: "0.875rem", margin: "0.5rem 0 0", color: "var(--fg)" }}>
                Total: <strong>{preview.totalDays} días</strong> · {preview.rangeLabel}
              </p>
            ) : null}
            {preview && "error" in preview ? (
              <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem", margin: "0.5rem 0 0" }}>
                {preview.error}
              </p>
            ) : null}
          </Card>

          <Card>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Motivo y justificación</h2>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.875rem", marginBottom: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" checked={isExtension} onChange={(e) => setIsExtension(e.target.checked)} />
              ¿Es prórroga?
            </label>
            {isExtension && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <Input label="Licencia anterior: inicio" type="date" value={prevStart} onChange={(e) => setPrevStart(e.target.value)} />
                <Input label="Licencia anterior: fin" type="date" value={prevEnd} onChange={(e) => setPrevEnd(e.target.value)} />
              </div>
            )}
            <Input label="Motivo (indispensable, sin diagnóstico clínico)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Cuidados maternos, trámite personal…" />
            <Input label="Comprobante / documentación" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="INE, receta, constancia…" />
            <Input label="Observaciones internas" value={notes} onChange={(e) => setNotes(e.target.value)} />

            {isEditMode && (
              <div style={{ marginTop: "0.5rem" }}>
                <Input label="Resumen del cambio (para bitácora de revisiones)" value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} placeholder="Ej. Corrección de fecha de inicio a petición del trabajador…" />
              </div>
            )}
          </Card>

          <Card>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>Datos para la solicitud</h2>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Campos para el formato institucional 1A74-009-036 (Excel).
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
              <Input
                label="Descansos"
                value={restDays}
                onChange={(e) => setRestDays(e.target.value)}
                placeholder="Ej. SÁB - DOM, JUE - VIE…"
              />
              <Input
                label="Teléfono de contacto"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 443 123 4567"
              />
            </div>
          </Card>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button variant="secondary" onClick={() => setStep(1)}>
              ← Paso anterior
            </Button>
            <Button
              onClick={() => void goToStep(3)}
              disabled={Boolean(!start || !end || !reason.trim() || (preview && "error" in preview))}
            >
              Revisar y finalizar →
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 3: REVISIÓN Y EMISIÓN DE DOCUMENTOS                                  */}
      {/* ========================================================================= */}
      {step === 3 && (
        <Card>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>Resumen del expediente</h2>

          {worker && (
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "6px",
                backgroundColor: "var(--accent)",
                fontSize: "0.8125rem",
                marginBottom: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <div>
                <strong>Trabajador:</strong> {workerDisplayName}{" "}
                <span style={{ color: "var(--muted)" }}>({worker.employee_number})</span>
              </div>
              <div>
                <strong>Categoría:</strong> {worker.category || "—"} · <strong>Turno:</strong> {worker.turn || "—"}
              </div>
              <div>
                <strong>Adscripción:</strong> {worker.assignment || "—"} · <strong>Horario:</strong> {worker.schedule || "—"}
              </div>
              {preview && "totalDays" in preview && (
                <div>
                  <strong>Licencia:</strong> {withPay ? "Con goce de sueldo" : "Sin goce de sueldo"} · {preview.totalDays} días ({start} al {end})
                </div>
              )}
              {reason && (
                <div>
                  <strong>Motivo:</strong> {reason}
                </div>
              )}
              {isExtension && (
                <div>
                  <strong>Prórroga:</strong> Sí (Licencia previa: {prevStart} al {prevEnd})
                </div>
              )}
              <div>
                <strong>Descansos:</strong> {restDays?.trim() ? restDays.trim().toUpperCase() : <span style={{ color: "var(--muted)" }}>Sin capturar</span>} ·{" "}
                <strong>Teléfono:</strong> {phone?.trim() ? phone.trim() : <span style={{ color: "var(--muted)" }}>Sin capturar</span>}
              </div>
            </div>
          )}

          {/* Alertas informativas no bloqueantes */}
          {(!phone?.trim() || !restDays?.trim()) && (
            <div
              style={{
                padding: "0.5rem 0.75rem",
                backgroundColor: "#fffbeb",
                border: "1px solid #fef3c7",
                borderRadius: "6px",
                color: "#b45309",
                fontSize: "0.8125rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                ⚠️ Avisos sobre datos complementarios (no bloqueante)
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                {!phone?.trim() && <li>Falta teléfono: el formato Excel se generará sin número de contacto.</li>}
                {!restDays?.trim() && <li>Faltan descansos: el formato Excel se generará sin días de descanso.</li>}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" style={{ color: "var(--error)", fontSize: "0.8125rem", marginBottom: "0.5rem" }}>
              {error}
            </p>
          )}

          {/* Botones de acción según estado */}
          {status === "draft" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Button onClick={() => void finalizeCase()} loading={busy} fullWidth variant="primary">
                Finalizar trámite y habilitar documentos
              </Button>
              <Button variant="secondary" onClick={() => setStep(2)}>
                ← Volver a editar fechas y motivo
              </Button>
            </div>
          ) : isEditMode ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Button onClick={() => void saveExplicitEdit()} loading={busy} fullWidth variant="primary">
                Guardar cambios (Nueva revisión)
              </Button>
              <Button variant="secondary" onClick={() => setStep(2)}>
                ← Volver a campos editables
              </Button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <p role="status" style={{ color: "var(--success)", fontSize: "0.875rem", margin: 0, fontWeight: 500 }}>
                Expediente {folio} (Rev. {revisionNumber}) completado. Documentos oficiales listos.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Acción Principal de Oficina
                </div>
                <Button
                  onClick={() => {
                    if (autoPrintStatus === "printed" || lastPrintedTime) {
                      setShowReprintConfirm(true);
                    } else {
                      void triggerAutoPrint();
                    }
                  }}
                  variant="primary"
                  loading={autoPrintStatus === "preparing" || autoPrintStatus === "queued" || autoPrintStatus === "printing"}
                  disabled={downloadingExcel || downloadingWord || printingPackage}
                  fullWidth
                >
                  <Printer size={18} weight="bold" />
                  {autoPrintStatus === "preparing"
                    ? "Preparando documentos..."
                    : autoPrintStatus === "queued"
                      ? "Enviado a impresora (En cola)..."
                      : autoPrintStatus === "printing"
                        ? "Imprimiendo en oficina..."
                        : autoPrintStatus === "printed"
                          ? "✓ Impreso correctamente (Reimprimir)"
                          : autoPrintStatus === "failed"
                            ? "Reintentar impresión automática"
                            : "Mandar a imprimir"}
                </Button>

                {/* Subtítulo informativo */}
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0.25rem" }}>
                  <span>Oficio + Solicitud · Oficina Sindical</span>
                  {autoPrintStation ? (
                    <span style={{ color: autoPrintStation.is_online ? "#16a34a" : "#dc2626", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: autoPrintStation.is_online ? "#16a34a" : "#dc2626", display: "inline-block" }} />
                      {autoPrintStation.is_online ? "Impresora disponible" : "Impresora desconectada"}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>Verificando estación...</span>
                  )}
                </div>

                {autoPrintError && (
                  <div style={{ fontSize: "0.8125rem", color: "#dc2626", backgroundColor: "rgba(220, 38, 38, 0.08)", padding: "0.5rem 0.75rem", borderRadius: "4px" }}>
                    {autoPrintError}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Opciones Secundarias
                </div>
                <Button
                  onClick={() => void printPackage()}
                  variant="secondary"
                  loading={printingPackage}
                  disabled={downloadingExcel || downloadingWord || autoPrintStatus === "preparing"}
                  fullWidth
                >
                  {printingPackage ? "Preparando visor..." : "👁️ Ver / Imprimir ambos"}
                </Button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <Button
                    onClick={() => void download("word")}
                    variant="ghost"
                    loading={downloadingWord}
                    disabled={downloadingExcel || printingPackage}
                    fullWidth
                  >
                    📄 Oficio Word (.docx)
                  </Button>
                  <Button
                    onClick={() => void download("excel")}
                    variant="ghost"
                    loading={downloadingExcel}
                    disabled={downloadingWord || printingPackage}
                    fullWidth
                  >
                    📊 Formato Excel (.xlsm)
                  </Button>
                </div>
              </div>

              {onBack && (
                <div style={{ marginTop: "0.5rem" }}>
                  <Button variant="ghost" fullWidth onClick={onBack}>
                    Volver al historial de licencias
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Modal de confirmación para reimpresión */}
      {showReprintConfirm && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "var(--card)", borderRadius: "var(--radius, 0.5rem)", maxWidth: "420px", width: "100%", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>Reimprimir Licencia</h3>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>
              Esta licencia ya fue enviada e impresa {lastPrintedTime ? `a las ${lastPrintedTime}` : "previamente"}. ¿Deseas enviar otra copia a la impresora de la oficina?
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="ghost" size="sm" onClick={() => setShowReprintConfirm(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setShowReprintConfirm(false);
                  void triggerAutoPrint();
                }}
              >
                Reimprimir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal global de confirmación de salida con cambios sin guardar */}
      {showExitConfirm && (
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
              maxWidth: "400px",
              width: "100%",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem" }}>Tienes cambios sin guardar</h3>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "var(--muted)" }}>
              Si sales ahora del modo edición, las modificaciones realizadas no se registrarán en la nueva revisión.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <Button variant="secondary" onClick={() => setShowExitConfirm(false)}>
                Seguir editando
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowExitConfirm(false);
                  onBack?.();
                }}
              >
                Salir sin guardar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
