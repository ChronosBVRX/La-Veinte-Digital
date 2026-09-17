import { createClient } from "@/lib/supabase/server";
import type { Json, Database } from "@/lib/supabase/types";
import { casePrefix } from "@/features/representacion/lib/folio";
import { calculateLicense, type LicenseCalcResult } from "@/features/representacion/lib/licenses";
import { writeAuditLog } from "@/features/representacion/services/audit";

export interface LicenseWorkerSnapshot {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  category: string;
  assignment: string;
  turn: string;
  schedule: string | null;
  rest_days: string | null;
  phone?: string | null;
}

export interface SaveLicenseDraftParams {
  delegationId: string;
  delegationCode: string;
  userId: string;
  caseId?: string | null;
  workerId?: string | null;
  currentStep?: number;
  withPay?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  isExtension?: boolean;
  previousStartDate?: string | null;
  previousEndDate?: string | null;
  reason?: string | null;
  proofDescription?: string | null;
  notes?: string | null;
  phone?: string | null;
}

export interface CompleteLicenseCaseParams {
  caseId: string;
  userId: string;
  workerId: string;
  withPay: boolean;
  startDate: string;
  endDate: string;
  isExtension?: boolean;
  previousStartDate?: string | null;
  previousEndDate?: string | null;
  reason: string;
  proofDescription?: string;
  notes?: string;
}

export interface UpdateCompletedLicenseParams {
  caseId: string;
  userId: string;
  expectedRevision: number;
  changeSummary?: string;
  workerId?: string;
  withPay: boolean;
  startDate: string;
  endDate: string;
  isExtension?: boolean;
  previousStartDate?: string | null;
  previousEndDate?: string | null;
  reason: string;
  proofDescription?: string;
  notes?: string;
}

export interface LicenseCaseDetailResult {
  id: string;
  folio: string;
  status: string;
  delegationId: string;
  currentStep: number;
  revisionNumber: number;
  documentRevision: number;
  isOutdated: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  createdAt: string;
  updatedAt: string;
  worker: LicenseWorkerSnapshot | null;
  license: {
    withPay: boolean;
    licenseRangeType: string;
    startDate: string | null;
    endDate: string | null;
    totalDays: number;
    isExtension: boolean;
    previousStartDate: string | null;
    previousEndDate: string | null;
    reason: string;
    proofDescription: string;
    notes: string;
  } | null;
  events: Array<{
    id: string;
    eventType: string;
    title: string;
    detail: string | null;
    createdAt: string;
  }>;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    changeSummary: string | null;
    createdAt: string;
    createdBy: string | null;
    snapshot: Record<string, unknown>;
  }>;
}

export class ConcurrencyConflictError extends Error {
  code = "CONCURRENCY_CONFLICT";
  constructor(message = "Este trámite fue actualizado desde otra sesión. Recarga antes de guardar.") {
    super(message);
    this.name = "ConcurrencyConflictError";
  }
}

/**
 * Guarda o actualiza un borrador progresivo de licencia.
 * Mantiene el mismo case_id durante todo el llenado.
 */
export async function saveLicenseDraft(
  params: SaveLicenseDraftParams,
): Promise<{ caseId: string; folio: string; currentStep: number; status: string; calcResult?: LicenseCalcResult }> {
  const supabase = await createClient();

  let workerSnapshotData: Record<string, unknown> = {};
  if (params.workerId) {
    const { data: wData } = await supabase
      .from("union_workers")
      .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn, schedule, rest_days, phone")
      .eq("id", params.workerId)
      .single();
    if (wData) {
      workerSnapshotData = wData as unknown as Record<string, unknown>;
    }
  }

  let calc: LicenseCalcResult | undefined;
  if (params.startDate && params.endDate) {
    try {
      calc = calculateLicense({
        withPay: Boolean(params.withPay),
        startISO: params.startDate,
        endISO: params.endDate,
      });
    } catch {
      // Si las fechas aún no son válidas durante el borrador, se ignora el error
    }
  }

  let caseId = params.caseId;
  let folio = "";

  if (caseId) {
    // Actualizar expediente existente
    const { data: existing, error: existError } = await supabase
      .from("union_cases")
      .select("id, folio, status, delegation_id")
      .eq("id", caseId)
      .single();

    if (existError || !existing) throw new Error("Expediente de borrador no encontrado");

    folio = existing.folio;

    const casePatch: Database["public"]["Tables"]["union_cases"]["Update"] = {
      updated_at: new Date().toISOString(),
      updated_by: params.userId,
      current_step: params.currentStep ?? 1,
    };
    if (params.workerId) {
      casePatch.worker_id = params.workerId;
      casePatch.worker_snapshot = workerSnapshotData as unknown as Json;
    }

    const { error: patchError } = await supabase.from("union_cases").update(casePatch).eq("id", caseId);
    if (patchError) throw new Error("Error al actualizar borrador en union_cases");
  } else {
    // Crear nuevo borrador atómico
    const year = new Date().getFullYear();
    const { data: newFolio, error: folioError } = await supabase.rpc("union_next_folio", {
      p_delegation_code: params.delegationCode,
      p_year: year,
      p_prefix: casePrefix("license"),
    });
    if (folioError || !newFolio) throw new Error("No se pudo generar el folio para el borrador.");
    folio = newFolio as string;

    const { data: newCase, error: createError } = await supabase
      .from("union_cases")
      .insert({
        delegation_id: params.delegationId,
        worker_id: params.workerId ?? "00000000-0000-0000-0000-000000000000",
        case_type: "license",
        folio,
        status: "draft",
        current_step: params.currentStep ?? 1,
        worker_snapshot: workerSnapshotData as unknown as Json,
        created_by: params.userId,
        updated_by: params.userId,
      })
      .select("id, folio")
      .single();

    if (createError || !newCase) {
      throw new Error(`No se pudo crear el borrador: ${createError?.message ?? "Error"}`);
    }
    caseId = newCase.id as string;

    await supabase.from("union_case_events").insert({
      case_id: caseId,
      event_type: "draft_created",
      title: "Borrador iniciado",
      detail: `Folio asignado: ${folio}. Trámite en captura progresiva.`,
      created_by: params.userId,
    });
  }

  // Guardar detalle en union_license_cases
  const detailPayload: Database["public"]["Tables"]["union_license_cases"]["Insert"] = {
    case_id: caseId,
    with_pay: Boolean(params.withPay),
    license_range_type: calc?.rangeType ?? "r1_3",
    start_date: params.startDate || null,
    end_date: params.endDate || null,
    total_days: calc?.totalDays ?? 0,
    previous_license_start: params.previousStartDate || null,
    previous_license_end: params.previousEndDate || null,
    is_extension: Boolean(params.isExtension),
    reason: (params.reason ?? "").trim(),
    proof_description: (params.proofDescription ?? "").trim(),
    debt_control_required: Boolean(params.withPay),
    notes: (params.notes ?? "").trim(),
  };

  const { error: detailError } = await supabase
    .from("union_license_cases")
    .upsert(detailPayload, { onConflict: "case_id" });

  if (detailError) {
    throw new Error(`No se pudo guardar el detalle del borrador: ${detailError.message}`);
  }

  return {
    caseId,
    folio,
    currentStep: params.currentStep ?? 1,
    status: "draft",
    calcResult: calc,
  };
}

/**
 * Finaliza un trámite de licencia completando validaciones estrictas
 * y pasando el estado de draft a completed.
 */
export async function completeLicenseCase(
  params: CompleteLicenseCaseParams,
): Promise<{ caseId: string; folio: string; status: string; calcResult: LicenseCalcResult }> {
  const supabase = await createClient();

  const { data: c, error: cErr } = await supabase
    .from("union_cases")
    .select("id, folio, status, delegation_id")
    .eq("id", params.caseId)
    .single();
  if (cErr || !c) throw new Error("Expediente no encontrado");

  // Validar trabajador
  const { data: wData } = await supabase
    .from("union_workers")
    .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn, schedule, rest_days, phone")
    .eq("id", params.workerId)
    .single();
  if (!wData) throw new Error("Trabajador no encontrado");
  if (!wData.first_name?.trim() && !wData.paternal_surname?.trim()) {
    throw new Error("El trabajador no tiene nombre registrado en el sistema.");
  }
  if (!wData.employee_number?.trim()) {
    throw new Error("El trabajador no tiene matrícula registrada.");
  }

  // Validar cálculo
  if (!params.startDate || !params.endDate) {
    throw new Error("Las fechas de inicio y término son indispensables.");
  }
  const calc = calculateLicense({
    withPay: params.withPay,
    startISO: params.startDate,
    endISO: params.endDate,
  });

  if (!params.reason?.trim()) {
    throw new Error("El motivo de la licencia es indispensable.");
  }

  // Actualizar union_cases
  const now = new Date().toISOString();
  const { error: caseUpErr } = await supabase
    .from("union_cases")
    .update({
      worker_id: params.workerId,
      worker_snapshot: wData as unknown as Json,
      status: "completed",
      current_step: 3,
      updated_at: now,
      updated_by: params.userId,
    })
    .eq("id", params.caseId);
  if (caseUpErr) throw new Error(`Error al actualizar estado a completado: ${caseUpErr.message}`);

  // Actualizar union_license_cases
  const { error: detailUpErr } = await supabase
    .from("union_license_cases")
    .upsert({
      case_id: params.caseId,
      with_pay: params.withPay,
      license_range_type: calc.rangeType,
      start_date: params.startDate,
      end_date: params.endDate,
      total_days: calc.totalDays,
      previous_license_start: params.previousStartDate || null,
      previous_license_end: params.previousEndDate || null,
      is_extension: Boolean(params.isExtension),
      reason: params.reason.trim(),
      proof_description: (params.proofDescription ?? "").trim(),
      debt_control_required: params.withPay,
      notes: (params.notes ?? "").trim(),
    });
  if (detailUpErr) throw new Error(`Error al guardar detalle: ${detailUpErr.message}`);

  await supabase.from("union_case_events").insert({
    case_id: params.caseId,
    event_type: "completed",
    title: "Trámite completado",
    detail: `${calc.rangeLabel}: ${calc.totalDays} días. Expediente listo para emisión de documentos oficiales.`,
    created_by: params.userId,
  });

  await writeAuditLog({
    delegation_id: c.delegation_id,
    entity_type: "union_case",
    entity_id: params.caseId,
    action: "case.license.completed",
    metadata: { folio: c.folio, range_type: calc.rangeType, total_days: calc.totalDays },
  });

  return {
    caseId: params.caseId,
    folio: c.folio,
    status: "completed",
    calcResult: calc,
  };
}

/**
 * Edición explícita de un trámite completado.
 * Controla concurrencia con expectedRevision (409 Conflict si no coincide),
 * genera un snapshot en union_license_revisions, incrementa revision_number
 * y conserva el mismo folio.
 */
export async function updateCompletedLicense(
  params: UpdateCompletedLicenseParams,
): Promise<{ caseId: string; folio: string; revisionNumber: number; documentRevision: number; isOutdated: boolean }> {
  const supabase = await createClient();

  const { data: existing, error: existErr } = await supabase
    .from("union_cases")
    .select("id, folio, status, revision_number, document_revision, delegation_id, worker_id, worker_snapshot")
    .eq("id", params.caseId)
    .single();

  if (existErr || !existing) throw new Error("Expediente no encontrado");

  // Concurrencia optimista
  if (existing.revision_number !== params.expectedRevision) {
    throw new ConcurrencyConflictError(
      `Conflicto de concurrencia: El trámite fue modificado por otra sesión (revisión actual ${existing.revision_number}, esperada ${params.expectedRevision}). Recarga antes de guardar.`,
    );
  }

  // Obtener detalle actual para snapshot
  const { data: prevDetail } = await supabase
    .from("union_license_cases")
    .select("*")
    .eq("case_id", params.caseId)
    .single();

  const snapshotData = {
    revision_number: existing.revision_number,
    worker: existing.worker_snapshot,
    license: prevDetail ?? {},
    timestamp: new Date().toISOString(),
  };

  // Guardar snapshot de la versión anterior
  await supabase.from("union_license_revisions").insert({
    case_id: params.caseId,
    revision_number: existing.revision_number,
    snapshot: snapshotData as unknown as Json,
    change_summary: params.changeSummary?.trim() || "Modificación de datos del trámite",
    created_by: params.userId,
  });

  // Validar y calcular
  const calc = calculateLicense({
    withPay: params.withPay,
    startISO: params.startDate,
    endISO: params.endDate,
  });

  const nextRevision = existing.revision_number + 1;
  const now = new Date().toISOString();

  // Actualizar union_cases
  const caseUpdate: Database["public"]["Tables"]["union_cases"]["Update"] = {
    revision_number: nextRevision,
    updated_at: now,
    updated_by: params.userId,
  };

  if (params.workerId && params.workerId !== existing.worker_id) {
    const { data: newWorker } = await supabase
      .from("union_workers")
      .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn, schedule, rest_days, phone")
      .eq("id", params.workerId)
      .single();
    if (newWorker) {
      caseUpdate.worker_id = params.workerId;
      caseUpdate.worker_snapshot = newWorker as unknown as Json;
    }
  }

  const { error: caseUpErr } = await supabase.from("union_cases").update(caseUpdate).eq("id", params.caseId);
  if (caseUpErr) throw new Error(`Error al actualizar caso: ${caseUpErr.message}`);

  // Actualizar detalle
  const { error: detailUpErr } = await supabase
    .from("union_license_cases")
    .upsert({
      case_id: params.caseId,
      with_pay: params.withPay,
      license_range_type: calc.rangeType,
      start_date: params.startDate,
      end_date: params.endDate,
      total_days: calc.totalDays,
      previous_license_start: params.previousStartDate || null,
      previous_license_end: params.previousEndDate || null,
      is_extension: Boolean(params.isExtension),
      reason: params.reason.trim(),
      proof_description: (params.proofDescription ?? "").trim(),
      debt_control_required: params.withPay,
      notes: (params.notes ?? "").trim(),
    });
  if (detailUpErr) throw new Error(`Error al actualizar detalle: ${detailUpErr.message}`);

  await supabase.from("union_case_events").insert({
    case_id: params.caseId,
    event_type: "license_updated",
    title: `Trámite editado (Revisión ${nextRevision})`,
    detail: `Folio ${existing.folio} actualizado. Los documentos deben regenerarse para reflejar la revisión ${nextRevision}.`,
    created_by: params.userId,
  });

  await writeAuditLog({
    delegation_id: existing.delegation_id,
    entity_type: "union_case",
    entity_id: params.caseId,
    action: "license_updated",
    metadata: {
      revision_before: existing.revision_number,
      revision_after: nextRevision,
    },
  });

  return {
    caseId: params.caseId,
    folio: existing.folio,
    revisionNumber: nextRevision,
    documentRevision: existing.document_revision,
    isOutdated: true,
  };
}

/**
 * Consulta el detalle completo de un expediente de licencia.
 */
export async function getLicenseCaseDetail(
  caseId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<LicenseCaseDetailResult> {
  const supabase = await createClient();

  let query = supabase
    .from("union_cases")
    .select("id, folio, status, delegation_id, current_step, revision_number, document_revision, deleted_at, deleted_by, created_at, updated_at, worker_id, worker_snapshot")
    .eq("id", caseId);

  if (!options.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data: c, error: cErr } = await query.single();
  if (cErr || !c) throw new Error("Expediente de licencia no encontrado");

  // Worker detail
  let worker: LicenseWorkerSnapshot | null = null;
  if (c.worker_id && c.worker_id !== "00000000-0000-0000-0000-000000000000") {
    const { data: wData } = await supabase
      .from("union_workers")
      .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn, schedule, rest_days, phone")
      .eq("id", c.worker_id)
      .single();
    worker = (wData ?? (c.worker_snapshot as unknown as LicenseWorkerSnapshot)) || null;
  } else if (c.worker_snapshot && Object.keys(c.worker_snapshot).length > 0) {
    worker = c.worker_snapshot as unknown as LicenseWorkerSnapshot;
  }

  // License detail
  const { data: lData } = await supabase
    .from("union_license_cases")
    .select("*")
    .eq("case_id", caseId)
    .single();

  // Events
  const { data: events } = await supabase
    .from("union_case_events")
    .select("id, event_type, title, detail, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  // Revisions
  const { data: revisions } = await supabase
    .from("union_license_revisions")
    .select("id, revision_number, change_summary, created_at, created_by, snapshot")
    .eq("case_id", caseId)
    .order("revision_number", { ascending: false });

  const revNum = c.revision_number ?? 1;
  const docRev = c.document_revision ?? 0;

  return {
    id: c.id,
    folio: c.folio,
    status: c.status,
    delegationId: c.delegation_id,
    currentStep: c.current_step ?? 1,
    revisionNumber: revNum,
    documentRevision: docRev,
    isOutdated: c.status === "completed" && docRev < revNum,
    deletedAt: c.deleted_at,
    deletedBy: c.deleted_by,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    worker,
    license: lData
      ? {
          withPay: Boolean(lData.with_pay),
          licenseRangeType: lData.license_range_type ?? "r1_3",
          startDate: lData.start_date,
          endDate: lData.end_date,
          totalDays: lData.total_days ?? 0,
          isExtension: Boolean(lData.is_extension),
          previousStartDate: lData.previous_license_start,
          previousEndDate: lData.previous_license_end,
          reason: lData.reason ?? "",
          proofDescription: lData.proof_description ?? "",
          notes: lData.notes ?? "",
        }
      : null,
    events: (events ?? []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      title: e.title,
      detail: e.detail,
      createdAt: e.created_at,
    })),
    revisions: (revisions ?? []).map((r) => ({
      id: r.id,
      revisionNumber: r.revision_number,
      changeSummary: r.change_summary,
      createdAt: r.created_at,
      createdBy: r.created_by,
      snapshot: (r.snapshot as Record<string, unknown>) ?? {},
    })),
  };
}

/**
 * Listado de trámites de licencia con filtros y conteos por estado.
 */
export async function listLicenseCases(params: {
  delegationId: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  cases: Array<{
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
  }>;
  summary: {
    draftsCount: number;
    completedCount: number;
    deletedCount: number;
    totalCount: number;
  };
}> {
  const supabase = await createClient();
  const depId = params.delegationId;

  // 1. Obtener conteos de resumen
  const [draftsRes, completedRes, deletedRes] = await Promise.all([
    supabase.from("union_cases").select("id", { count: "exact", head: true })
      .eq("delegation_id", depId).eq("case_type", "license").eq("status", "draft").is("deleted_at", null),
    supabase.from("union_cases").select("id", { count: "exact", head: true })
      .eq("delegation_id", depId).eq("case_type", "license").in("status", ["completed", "ready", "submitted", "pending_signature", "approved"]).is("deleted_at", null),
    supabase.from("union_cases").select("id", { count: "exact", head: true })
      .eq("delegation_id", depId).eq("case_type", "license").not("deleted_at", "is", null),
  ]);

  const draftsCount = draftsRes.count ?? 0;
  const completedCount = completedRes.count ?? 0;
  const deletedCount = deletedRes.count ?? 0;
  const totalCount = draftsCount + completedCount;

  // 2. Armar consulta de casos
  let query = supabase
    .from("union_cases")
    .select("id, folio, status, current_step, revision_number, document_revision, created_at, updated_at, deleted_at, worker_id, worker_snapshot")
    .eq("delegation_id", depId)
    .eq("case_type", "license")
    .order("updated_at", { ascending: false })
    .limit(params.limit ?? 50);

  if (params.offset) {
    query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);
  }

  const requestedStatus = params.status ?? "all";
  if (requestedStatus === "deleted") {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
    if (requestedStatus === "draft") {
      query = query.eq("status", "draft");
    } else if (requestedStatus === "completed") {
      query = query.in("status", ["completed", "ready", "submitted", "approved"]);
    } else if (requestedStatus === "pending_signature") {
      query = query.eq("status", "pending_signature");
    }
  }

  const { data: rows, error: qErr } = await query;
  if (qErr) throw new Error(`Error al consultar expedientes: ${qErr.message}`);

  const caseRows = rows ?? [];
  if (caseRows.length === 0) {
    return {
      cases: [],
      summary: { draftsCount, completedCount, deletedCount, totalCount },
    };
  }

  const caseIds = caseRows.map((r) => r.id);
  const workerIds = [...new Set(caseRows.map((r) => r.worker_id).filter((id) => id && id !== "00000000-0000-0000-0000-000000000000"))];

  // Consultar detalles de licencia
  const { data: licenseDetails } = await supabase
    .from("union_license_cases")
    .select("case_id, with_pay, start_date, end_date, total_days, reason")
    .in("case_id", caseIds);

  const licenseMap = new Map((licenseDetails ?? []).map((l) => [l.case_id, l]));

  // Consultar trabajadores
  let workerMap = new Map<string, { id: string; employee_number: string; first_name: string; paternal_surname: string; maternal_surname: string | null; category: string }>();
  if (workerIds.length > 0) {
    const { data: workers } = await supabase
      .from("union_workers")
      .select("id, employee_number, first_name, paternal_surname, maternal_surname, category")
      .in("id", workerIds);
    workerMap = new Map((workers ?? []).map((w) => [w.id, w]));
  }

  let mapped = caseRows.map((row) => {
    const w = workerMap.get(row.worker_id) ?? (row.worker_snapshot as Record<string, unknown> | null);
    const l = licenseMap.get(row.id);

    let fullName = "";
    let employeeNumber = "";
    let category = "";
    if (w) {
      const parts = [
        (w.paternal_surname ?? (w as Record<string, unknown>).paternalSurname),
        (w.maternal_surname ?? (w as Record<string, unknown>).maternalSurname),
        (w.first_name ?? (w as Record<string, unknown>).firstName),
      ]
        .filter(Boolean)
        .join(" ");
      fullName = parts || "Sin nombre registrado";
      employeeNumber = String(w.employee_number ?? (w as Record<string, unknown>).employeeNumber ?? "");
      category = String(w.category ?? "");
    }

    const rev = row.revision_number ?? 1;
    const docRev = row.document_revision ?? 0;

    return {
      id: row.id,
      folio: row.folio,
      status: row.status,
      currentStep: row.current_step ?? 1,
      revisionNumber: rev,
      documentRevision: docRev,
      isOutdated: row.status === "completed" && docRev < rev,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
      worker: w
        ? {
            id: row.worker_id,
            employeeNumber,
            fullName,
            category,
          }
        : null,
      license: l
        ? {
            withPay: Boolean(l.with_pay),
            startDate: l.start_date,
            endDate: l.end_date,
            totalDays: l.total_days ?? 0,
            reason: l.reason ?? "",
          }
        : null,
    };
  });

  // Filtro de búsqueda en memoria para folio / nombre / matrícula si viene parámetro search
  if (params.search?.trim()) {
    const sq = params.search.trim().toLowerCase();
    mapped = mapped.filter((c) => {
      const fMatch = c.folio.toLowerCase().includes(sq);
      const mMatch = c.worker?.employeeNumber.toLowerCase().includes(sq);
      const nMatch = c.worker?.fullName.toLowerCase().includes(sq);
      return fMatch || mMatch || nMatch;
    });
  }

  return {
    cases: mapped,
    summary: { draftsCount, completedCount, deletedCount, totalCount },
  };
}

/**
 * Borrado lógico (soft delete): envía el trámite a la papelera.
 */
export async function softDeleteLicenseCase(caseId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { data: existing, error: existErr } = await supabase
    .from("union_cases")
    .select("id, folio, status, delegation_id")
    .eq("id", caseId)
    .single();

  if (existErr || !existing) throw new Error("Expediente no encontrado");

  const { error: upErr } = await supabase
    .from("union_cases")
    .update({
      status_before_delete: existing.status,
      status: "deleted",
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq("id", caseId);

  if (upErr) throw new Error(`No se pudo eliminar el expediente: ${upErr.message}`);

  await supabase.from("union_case_events").insert({
    case_id: caseId,
    event_type: "license_deleted",
    title: "Trámite enviado a la papelera",
    detail: `El trámite ${existing.folio} fue removido del historial activo.`,
    created_by: userId,
  });

  await writeAuditLog({
    delegation_id: existing.delegation_id,
    entity_type: "union_case",
    entity_id: caseId,
    action: "license_deleted",
    metadata: { previous_status: existing.status },
  });
}

/**
 * Restaura un trámite de la papelera a su estado previo.
 */
export async function restoreLicenseCase(caseId: string, userId: string): Promise<{ previousStatus: string }> {
  const supabase = await createClient();

  const { data: existing, error: existErr } = await supabase
    .from("union_cases")
    .select("id, folio, status, status_before_delete, delegation_id")
    .eq("id", caseId)
    .single();

  if (existErr || !existing) throw new Error("Expediente no encontrado");

  const restoredStatus = existing.status_before_delete || "draft";

  const { error: upErr } = await supabase
    .from("union_cases")
    .update({
      status: restoredStatus,
      status_before_delete: null,
      deleted_at: null,
      deleted_by: null,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", caseId);

  if (upErr) throw new Error(`No se pudo restaurar el expediente: ${upErr.message}`);

  await supabase.from("union_case_events").insert({
    case_id: caseId,
    event_type: "license_restored",
    title: "Trámite restaurado",
    detail: `El trámite ${existing.folio} fue restaurado al estado ${restoredStatus}.`,
    created_by: userId,
  });

  await writeAuditLog({
    delegation_id: existing.delegation_id,
    entity_type: "union_case",
    entity_id: caseId,
    action: "license_restored",
    metadata: { restored_status: restoredStatus },
  });

  return { previousStatus: restoredStatus };
}

/**
 * Eliminación definitiva (hard delete): exclusivo de administradores sindicales.
 * Requiere confirmación con texto exacto "ELIMINAR".
 * Elimina en cascada revisiones, eventos y caso.
 * NUNCA toca plantillas maestras.
 */
export async function hardDeleteLicenseCase(caseId: string, userId: string, confirmationText: string): Promise<void> {
  if (confirmationText !== "ELIMINAR") {
    throw new Error("Confirmación inválida. Debes escribir exactamente ELIMINAR para proceder.");
  }

  const supabase = await createClient();

  const { data: existing, error: existErr } = await supabase
    .from("union_cases")
    .select("id, folio, delegation_id")
    .eq("id", caseId)
    .single();

  if (existErr || !existing) throw new Error("Expediente no encontrado");

  // Registrar auditoría administrativa antes del borrado físico
  await writeAuditLog({
    delegation_id: existing.delegation_id,
    entity_type: "union_case",
    entity_id: caseId,
    action: "license_hard_deleted",
    metadata: { folio: existing.folio },
  });

  // Eliminación física (cascada configurada en FKs elimina revisions, events, license_cases)
  const { error: delErr } = await supabase.from("union_cases").delete().eq("id", caseId);
  if (delErr) throw new Error(`Error al eliminar definitivamente: ${delErr.message}`);
}

/**
 * Actualiza document_revision al valor actual de revision_number
 * cuando se generan o regeneran documentos oficiales para el caso.
 */
export async function markLicenseDocumentsGenerated(caseId: string): Promise<number> {
  const supabase = await createClient();

  const { data: c, error } = await supabase
    .from("union_cases")
    .select("revision_number")
    .eq("id", caseId)
    .single();

  if (error || !c) return 0;

  const rev = c.revision_number ?? 1;

  await supabase
    .from("union_cases")
    .update({
      document_revision: rev,
      status: "completed",
    })
    .eq("id", caseId);

  return rev;
}

