// Servicio centralizado para la Cola de Impresión de la Oficina Sindical.
// Garantiza inmutabilidad del PDF del job, unicidad por revisión,
// trazabilidad de auditoría y reclamo atómico concurrency-safe.

import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { requireUnionMembership } from "./permissions";
import {
  resolvePrintableDocumentTypeForCase,
  getPrintableDocumentDefinition,
} from "./print-document-registry";
import { addCaseEvent } from "./cases";

export type PrintJobStatus = "queued" | "claimed" | "printing" | "printed" | "failed" | "cancelled";

export interface PrintStationRecord {
  id: string;
  delegation_id: string;
  name: string;
  printer_name: string;
  is_active: boolean;
  last_seen_at: string | null;
  agent_version: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrintJobRecord {
  id: string;
  delegation_id: string;
  station_id: string;
  case_id: string | null;
  document_type: string;
  document_revision: number;
  status: PrintJobStatus;
  copies: number;
  duplex: boolean;
  document_storage_path: string | null;
  document_sha256: string | null;
  document_size_bytes: number | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  created_by: string | null;
  created_at: string;
  claimed_at: string | null;
  printing_at: string | null;
  printed_at: string | null;
  failed_at: string | null;
  // Campos enriquecidos para visualización
  case_folio?: string;
  worker_name?: string;
}

export interface PrintQueueSummary {
  station: (PrintStationRecord & { isOnline: boolean }) | null;
  queued: PrintJobRecord[];
  printing: PrintJobRecord[];
  failed: PrintJobRecord[];
  recent: PrintJobRecord[];
}

/**
 * Umbral de segundos para considerar que una estación está en línea (heartbeat vivo).
 */
export const STATION_ONLINE_THRESHOLD_SECONDS = 45;

export function isStationOnline(lastSeenAt: string | null, thresholdSeconds = STATION_ONLINE_THRESHOLD_SECONDS): boolean {
  if (!lastSeenAt) return false;
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  return diffMs <= thresholdSeconds * 1000;
}

/**
 * Obtiene la estación de impresión activa de una delegación sindical.
 */
export async function getActiveStationForDelegation(delegationId: string): Promise<PrintStationRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("union_print_stations")
    .select("id, delegation_id, name, printer_name, is_active, last_seen_at, agent_version, ip_address, created_at, updated_at")
    .eq("delegation_id", delegationId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as PrintStationRecord) || null;
}

/**
 * Crea un trabajo de impresión para cualquier trámite sindical con documento oficial imprimible
 * (Licencias, Pasaje 026, Pasaje 027).
 *
 * Flujo estricto de inmutabilidad:
 * 1. Consulta union_cases y deriva autoritativamente el document_type.
 * 2. Valida membresía sindical para la delegación del caso.
 * 3. Resuelve la estación de impresión activa de la delegación.
 * 4. Genera el PDF final inmutable mediante el builder del registro central.
 * 5. Pre-genera el UUID del job y calcula SHA-256 + tamaño exacto.
 * 6. Almacena los bytes en el bucket privado union-private (print-jobs/{delegationId}/{caseId}/{jobId}.pdf).
 * 7. Inserta el registro en union_print_jobs con status 'queued'.
 * 8. Si la inserción falla, ejecuta limpieza best-effort del PDF en Storage.
 * 9. Registra el evento de auditoría en el expediente.
 */
export async function createUnionPrintJob(params: {
  caseId: string;
  userId: string;
  copies?: number;
  duplex?: boolean;
}): Promise<{ job: PrintJobRecord; station: PrintStationRecord; documentBuffer: Buffer }> {
  const supabase = await createClient();

  // 1. Obtener expediente de la base de datos
  const { data: caseRow, error: caseErr } = await supabase
    .from("union_cases")
    .select("id, delegation_id, folio, case_type")
    .eq("id", params.caseId)
    .single();

  if (caseErr || !caseRow) {
    throw new Error(`Expediente no encontrado (ID: ${params.caseId})`);
  }

  const c = caseRow as {
    id: string;
    delegation_id: string;
    folio: string;
    case_type: string;
  };

  // 2. Validar membresía sindical en la delegación
  await requireUnionMembership(c.delegation_id);

  // 3. Derivar tipo documental y obtener definición desde el registro central
  const docType = resolvePrintableDocumentTypeForCase(c.case_type);
  const docDef = getPrintableDocumentDefinition(docType);
  if (!docDef) {
    throw new Error(`Definición no encontrada para el tipo documental: ${docType}`);
  }

  // 4. Localizar estación de impresión activa para la delegación
  const station = await getActiveStationForDelegation(c.delegation_id);
  if (!station) {
    throw new Error("No hay ninguna estación de impresión configurada o activa para esta oficina sindical.");
  }

  // 5. Generar el PDF final inmutable
  const docResult = await docDef.buildDocument({ supabase, caseId: params.caseId });
  const pdfBuffer = docResult.buffer;
  const sha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
  const sizeBytes = pdfBuffer.length;

  const copies = params.copies && params.copies > 0 ? params.copies : docDef.defaultCopies;
  const duplex = typeof params.duplex === "boolean" ? params.duplex : docDef.defaultDuplex;

  // 6. Pre-generar UUID del trabajo y ruta inmutable en storage privado
  const jobId = crypto.randomUUID();
  const storagePath = `print-jobs/${c.delegation_id}/${params.caseId}/${jobId}.pdf`;

  // 7. Almacenar exactamente estos bytes en el bucket privado union-private
  const { error: uploadErr } = await supabase.storage
    .from("union-private")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadErr) {
    throw new Error(`Error al almacenar el documento para impresión: ${uploadErr.message}`);
  }

  // 8. Insertar el trabajo en la cola (status: queued) apuntando al archivo en Storage
  const { data: job, error: insertErr } = await supabase
    .from("union_print_jobs")
    .insert({
      id: jobId,
      delegation_id: c.delegation_id,
      station_id: station.id,
      case_id: params.caseId,
      document_type: docType,
      document_revision: docResult.documentRevision,
      status: "queued",
      copies,
      duplex,
      document_storage_path: storagePath,
      document_sha256: sha256,
      document_size_bytes: sizeBytes,
      created_by: params.userId,
    })
    .select("*")
    .single();

  if (insertErr || !job) {
    // Limpieza best-effort del archivo huérfano en Storage
    await supabase.storage.from("union-private").remove([storagePath]).catch(() => {});
    throw new Error(`Error al registrar el trabajo en la cola de impresión: ${insertErr?.message || "sin respuesta"}`);
  }

  // 9. Registrar evento de auditoría en el expediente (sin datos clínicos sensibles)
  await addCaseEvent(
    params.caseId,
    "document",
    "Trabajo de impresión enviado a oficina",
    `${docDef.label} ${docResult.folio} (Rev. ${docResult.documentRevision}) enviado a la estación "${station.name}". Impresora: ${station.printer_name || "Predeterminada"}. Copias: ${copies}.`,
  );

  return {
    job: job as PrintJobRecord,
    station,
    documentBuffer: pdfBuffer,
  };
}

/**
 * Wrapper de retrocompatibilidad estricta para crear trabajos de impresión de licencias.
 */
export async function createLicensePrintJob(params: {
  caseId: string;
  userId: string;
  copies?: number;
  duplex?: boolean;
}): Promise<{ job: PrintJobRecord; station: PrintStationRecord; documentBuffer: Buffer }> {
  return await createUnionPrintJob(params);
}

/**
 * Consulta el estado del último trabajo de impresión de un expediente.
 */
export async function getCaseLatestPrintJob(caseId: string): Promise<PrintJobRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("union_print_jobs")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PrintJobRecord) || null;
}

/**
 * Reintenta un trabajo de impresión fallido.
 */
export async function retryPrintJob(jobId: string, userId?: string): Promise<PrintJobRecord> {
  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("union_print_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (fetchErr || !existing) {
    throw new Error("Trabajo de impresión no encontrado.");
  }

  if (existing.status === "printing" || existing.status === "claimed") {
    throw new Error("El trabajo ya se está procesando actualmente en la impresora.");
  }

  // Si ya estaba impreso, no cambiarlo: el representante debe crear una reimpresión
  if (existing.status === "printed") {
    throw new Error("Este trabajo ya fue impreso exitosamente. Utiliza 'Reimprimir' para generar una nueva copia.");
  }

  const { data: updated, error: updateErr } = await supabase
    .from("union_print_jobs")
    .update({
      status: "queued",
      error_code: null,
      error_message: null,
      claimed_at: null,
      printing_at: null,
      failed_at: null,
      created_by: userId || null,
      created_at: new Date().toISOString(), // Renueva prioridad FIFO
    })
    .eq("id", jobId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    throw new Error(`No se pudo reactivar el trabajo: ${updateErr?.message || "error desconocido"}`);
  }

  if (existing.case_id) {
    await addCaseEvent(
      existing.case_id,
      "document",
      "Reintento de impresión solicitado",
      `Trabajo de impresión reactivado por el representante. Reintento programado en cola.`,
    );
  }

  return updated as PrintJobRecord;
}

/**
 * Obtiene la cola de impresión completa de una delegación clasificada por estado.
 */
export async function getPrintQueueSummary(delegationId: string): Promise<PrintQueueSummary> {
  const supabase = await createClient();

  const station = await getActiveStationForDelegation(delegationId);

  // Obtener trabajos con datos del expediente
  const { data: rawJobs } = await supabase
    .from("union_print_jobs")
    .select(`
      *,
      union_cases (
        folio,
        union_workers (
          first_name,
          paternal_surname
        )
      )
    `)
    .eq("delegation_id", delegationId)
    .order("created_at", { ascending: false })
    .limit(60);

  const jobs: PrintJobRecord[] = (rawJobs || []).map((raw) => {
    const r = raw as unknown as PrintJobRecord & {
      union_cases?: {
        folio?: string;
        union_workers?: { first_name?: string; paternal_surname?: string };
      };
    };
    const c = r.union_cases;
    const w = c?.union_workers;
    const workerName = w ? `${w.paternal_surname || ""} ${w.first_name || ""}`.trim() : undefined;
    return {
      ...r,
      case_folio: c?.folio,
      worker_name: workerName || undefined,
    };
  });

  const queued = jobs.filter((j) => j.status === "queued").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const printing = jobs.filter((j) => j.status === "claimed" || j.status === "printing");
  const failed = jobs.filter((j) => j.status === "failed").slice(0, 10);
  const recent = jobs.filter((j) => j.status === "printed").slice(0, 10);

  return {
    station: station ? { ...station, isOnline: isStationOnline(station.last_seen_at) } : null,
    queued,
    printing,
    failed,
    recent,
  };
}
