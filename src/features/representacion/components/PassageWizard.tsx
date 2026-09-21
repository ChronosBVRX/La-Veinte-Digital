"use client";

import { useState } from "react";
import type { UnionWorkerOption } from "./WorkerPicker";
import { validatePassage026, validatePassage027 } from "../lib/passages";

import styles from "./passages/PassageWizard.module.css";
import {
  PassageConceptSelector,
  type PassageConcept,
} from "./passages/PassageConceptSelector";
import { PassageWorkerSection } from "./passages/PassageWorkerSection";
import { PassageRequestDetails } from "./passages/PassageRequestDetails";
import { Passage026Details } from "./passages/Passage026Details";
import { Passage027Details } from "./passages/Passage027Details";
import { PassageInternalNotes } from "./passages/PassageInternalNotes";
import { PassageValidationBanner } from "./passages/PassageValidationBanner";
import { PassageActions } from "./passages/PassageActions";
import { PassageSummarySidebar } from "./passages/PassageSummarySidebar";

export function PassageWizard(): React.JSX.Element {
  const [concept, setConcept] = useState<PassageConcept>("027");
  const [worker, setWorker] = useState<UnionWorkerOption | null>(null);
  const [ooad, setOoad] = useState("MICHOACÁN");
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [control, setControl] = useState("");
  const [extramural, setExtramural] = useState("");
  const [transfer, setTransfer] = useState("");
  const [disc, setDisc] = useState<"Si" | "No" | "">("");
  const [phone, setPhone] = useState("");
  const [obs, setObs] = useState("");
  const [wAddr, setWAddr] = useState({
    street: "",
    neighborhood: "",
    postalCode: "",
    municipality: "",
    state: "",
  });
  const [aAddr, setAAddr] = useState({
    street: "",
    neighborhood: "",
    postalCode: "",
    municipality: "",
    state: "",
  });

  // Estados de proceso, validación y dirty tracking
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [customError, setCustomError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [caseId, setCaseId] = useState<string | null>(null);
  const [folio, setFolio] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Invalida el snapshot anterior si el usuario edita algún dato
  function markDirty(): void {
    if (caseId) {
      setCaseId(null);
      setIsDirty(true);
    }
  }

  function handleConceptChange(newConcept: PassageConcept): void {
    markDirty();
    setConcept(newConcept);
    setMissingFields([]);
    setCustomError(null);
    setFieldErrors({});
  }

  function handleWorkerChange(newWorker: UnionWorkerOption | null): void {
    markDirty();
    setWorker(newWorker);
    setMissingFields([]);
    setCustomError(null);
    setFieldErrors({});
  }

  function setWA(k: keyof typeof wAddr, v: string): void {
    markDirty();
    setWAddr((s) => ({ ...s, [k]: v }));
  }

  function setAA(k: keyof typeof aAddr, v: string): void {
    markDirty();
    setAAddr((s) => ({ ...s, [k]: v }));
  }

  async function prepare(): Promise<void> {
    setCustomError(null);
    setMissingFields([]);
    const errors: Record<string, boolean> = {};
    const missing: string[] = [];

    if (!worker) {
      errors.worker = true;
      missing.push("Trabajador solicitante");
    }

    if (concept === "026") {
      const rawMissing = validatePassage026({
        ooad,
        requestDate,
        controlNumber: control,
        paternalSurname: worker?.paternal_surname ?? "",
        maternalSurname: worker?.maternal_surname ?? "",
        firstName: worker?.first_name ?? "",
        employeeNumber: worker?.employee_number ?? "",
        category: worker?.category ?? "",
        assignment: worker?.assignment ?? "",
        extramuralFunctions: extramural,
        transferPeriod: transfer,
      });

      rawMissing.forEach((item) => {
        if (item.toLowerCase().includes("funciones extramuros")) {
          errors.extramuralFunctions = true;
          missing.push("Funciones extramuros en el desempeño de sus labores");
        } else if (item.toLowerCase().includes("periodo de traslado")) {
          errors.transferPeriod = true;
          missing.push("Periodo de traslado");
        } else if (item.toLowerCase().includes("fecha")) {
          errors.requestDate = true;
          missing.push("Fecha de solicitud");
        } else if (!missing.includes(item)) {
          missing.push(item);
        }
      });
    } else {
      const rawMissing = validatePassage027({
        ooad,
        requestDate,
        controlNumber: control,
        paternalSurname: worker?.paternal_surname ?? "",
        maternalSurname: worker?.maternal_surname ?? "",
        firstName: worker?.first_name ?? "",
        employeeNumber: worker?.employee_number ?? "",
        category: worker?.category ?? "",
        assignment: worker?.assignment ?? "",
        discontinuousSchedule: disc,
        workerAddress: wAddr,
        assignmentAddress: aAddr,
        phone,
      });

      rawMissing.forEach((item) => {
        const lower = item.toLowerCase();
        if (lower.includes("horario discontinuo")) {
          errors.discontinuousSchedule = true;
          missing.push("Horario discontinuo (indica Sí o No)");
        } else if (lower.includes("calle del trabajador") || (lower.includes("calle") && !lower.includes("adscripción"))) {
          errors.workerStreet = true;
          missing.push("Calle del domicilio del trabajador");
        } else if (lower.includes("colonia del trabajador") || (lower.includes("colonia") && !lower.includes("adscripción"))) {
          errors.workerNeighborhood = true;
          missing.push("Colonia del domicilio del trabajador");
        } else if (lower.includes("código postal del trabajador") || lower.includes("cp del trabajador")) {
          errors.workerPostalCode = true;
          missing.push("Código postal del trabajador");
        } else if (lower.includes("municipio del trabajador")) {
          errors.workerMunicipality = true;
          missing.push("Municipio del trabajador");
        } else if (lower.includes("estado del trabajador")) {
          errors.workerState = true;
          missing.push("Estado del trabajador");
        } else if (lower.includes("calle") && lower.includes("adscripción")) {
          errors.assignmentStreet = true;
          missing.push("Calle del domicilio de adscripción");
        } else if (lower.includes("colonia") && lower.includes("adscripción")) {
          errors.assignmentNeighborhood = true;
          missing.push("Colonia del domicilio de adscripción");
        } else if (lower.includes("código postal") && lower.includes("adscripción")) {
          errors.assignmentPostalCode = true;
          missing.push("Código postal de adscripción");
        } else if (lower.includes("municipio") && lower.includes("adscripción")) {
          errors.assignmentMunicipality = true;
          missing.push("Municipio de adscripción");
        } else if (lower.includes("estado") && lower.includes("adscripción")) {
          errors.assignmentState = true;
          missing.push("Estado de adscripción");
        } else if (lower.includes("teléfono") || lower.includes("telefono")) {
          errors.phone = true;
          missing.push("Teléfono de contacto");
        } else if (!missing.includes(item)) {
          missing.push(item);
        }
      });
    }

    if (missing.length > 0) {
      setFieldErrors(errors);
      setMissingFields(missing);
      return;
    }

    setBusy(true);
    setFieldErrors({});
    setMissingFields([]);
    try {
      const body =
        concept === "026"
          ? {
              kind: "passage_026",
              worker_id: worker!.id,
              ooad,
              request_date: requestDate,
              control_number: control,
              extramural_functions: extramural,
              transfer_period: transfer,
              observations: obs,
            }
          : {
              kind: "passage_027",
              worker_id: worker!.id,
              ooad,
              request_date: requestDate,
              control_number: control,
              discontinuous_schedule: disc,
              worker_address: wAddr,
              assignment_address: aAddr,
              phone,
              observations: obs,
            };

      const res = await fetch("/api/union/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const j = (await res.json()) as { id?: string; folio?: string; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Error al preparar la solicitud");

      setCaseId(j.id ?? null);
      setFolio(j.folio ?? null);
      setIsDirty(false);
    } catch (err: unknown) {
      setCustomError(err instanceof Error ? err.message : "No se pudo preparar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf(): Promise<void> {
    if (!caseId) return;
    setDownloading(true);
    setCustomError(null);
    try {
      const res = await fetch("/api/union/passages/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "No se pudo descargar el formato oficial.");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `pasaje-${concept}-${worker?.employee_number || "solicitud"}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setCustomError(err instanceof Error ? err.message : "No se pudo descargar el PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Columna Principal con Formulario Estructurado */}
        <div className={styles.mainColumn}>
          {/* 1. Selector de Concepto (026 / 027) */}
          <PassageConceptSelector
            concept={concept}
            onChange={handleConceptChange}
            disabled={busy || downloading}
          />

          {/* 2. Sección del Trabajador Solicitante */}
          <PassageWorkerSection
            selected={worker}
            onSelect={handleWorkerChange}
            disabled={busy || downloading}
            hasError={Boolean(fieldErrors.worker)}
          />

          {/* 3. Datos de la Solicitud (OOAD, Fecha, Control) */}
          <PassageRequestDetails
            ooad={ooad}
            onOoadChange={(v) => {
              markDirty();
              setOoad(v);
            }}
            requestDate={requestDate}
            onRequestDateChange={(v) => {
              markDirty();
              setRequestDate(v);
            }}
            controlNumber={control}
            onControlNumberChange={(v) => {
              markDirty();
              setControl(v);
            }}
            disabled={busy || downloading}
          />

          {/* 4. Detalles Específicos según Concepto */}
          {concept === "026" ? (
            <Passage026Details
              extramuralFunctions={extramural}
              onExtramuralFunctionsChange={(v) => {
                markDirty();
                setExtramural(v);
              }}
              transferPeriod={transfer}
              onTransferPeriodChange={(v) => {
                markDirty();
                setTransfer(v);
              }}
              disabled={busy || downloading}
              fieldErrors={fieldErrors}
            />
          ) : (
            <Passage027Details
              discontinuousSchedule={disc}
              onDiscontinuousScheduleChange={(v) => {
                markDirty();
                setDisc(v);
              }}
              workerAddress={wAddr}
              onWorkerAddressChange={setWA}
              assignmentAddress={aAddr}
              onAssignmentAddressChange={setAA}
              phone={phone}
              onPhoneChange={(v) => {
                markDirty();
                setPhone(v);
              }}
              disabled={busy || downloading}
              fieldErrors={fieldErrors}
            />
          )}

          {/* 5. Observaciones Internas (no se imprimen en el PDF) */}
          <PassageInternalNotes
            notes={obs}
            onNotesChange={(v) => {
              markDirty();
              setObs(v);
            }}
            disabled={busy || downloading}
          />

          {/* 6. Banner de Validación y Errores */}
          <PassageValidationBanner
            missingFields={missingFields}
            customError={customError}
          />

          {/* 7. Acciones Principales (CTA Preparar / Descargar y Banners) */}
          <PassageActions
            concept={concept}
            caseId={caseId}
            folio={folio}
            isDirty={isDirty}
            busy={busy}
            downloading={downloading}
            onPrepare={() => void prepare()}
            onDownload={() => void downloadPdf()}
          />
        </div>

        {/* Panel Lateral Sticky de Resumen (Visible en pantallas grandes >= 1200px) */}
        <PassageSummarySidebar
          concept={concept}
          worker={worker}
          requestDate={requestDate}
          caseId={caseId}
          folio={folio}
          isDirty={isDirty}
          busy={busy}
          downloading={downloading}
          onPrepare={() => void prepare()}
          onDownload={() => void downloadPdf()}
        />
      </div>
    </div>
  );
}
