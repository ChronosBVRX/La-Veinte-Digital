// Servicio server-side del Directorio de Trabajadores sindical.
// Toda consulta exige una delegación ya resuelta y verificada por
// requireUnionMembership() en la ruta o página que lo invoca.
// Nunca selecciona PII sensible (rfc, curp, nss).

import { createClient } from "@/lib/supabase/server";
import {
  WORKER_DIRECTORY_MAX_PAGE_SIZE,
  sanitizeWorkerSearchTerm,
  type WorkerDirectoryQuery,
  type WorkerDirectorySortId,
  type WorkerDirectoryStatus,
} from "../lib/worker-directory-params";

export interface UnionWorkerFilters {
  q: string;
  categories: string[];
  turns: string[];
  assignments: string[];
  status: WorkerDirectoryStatus;
}

export interface WorkerDirectoryRow {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  siap_full_name: string;
  category: string;
  assignment: string;
  turn: string;
  schedule: string | null;
  rest_days: string | null;
  phone?: string | null;
  active: boolean;
  seniority_years: number | null;
  employment_start_date: string | null;
}

export interface WorkerDirectoryResult {
  workers: WorkerDirectoryRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface WorkerDirectoryFacets {
  categories: string[];
  turns: string[];
  assignments: string[];
}

const WORKER_LIST_COLUMNS =
  "id, employee_number, first_name, paternal_surname, maternal_surname, siap_full_name, category, assignment, turn, schedule, rest_days, phone, active, seniority_years, employment_start_date";

const ROLLED_BACK_FILTER = "source_import_state.is.null,source_import_state.neq.rolled_back";

interface FilterValues {
  q: string;
  categories: string[];
  turns: string[];
  assignments: string[];
  status: WorkerDirectoryStatus;
}

function valuesOf(filters: UnionWorkerFilters): FilterValues {
  return {
    q: sanitizeWorkerSearchTerm(filters.q),
    categories: filters.categories,
    turns: filters.turns,
    assignments: filters.assignments,
    status: filters.status,
  };
}

function searchFilter(q: string): string | null {
  if (!q) return null;
  const like = `%${q}%`;
  return [
    `employee_number.ilike.${like}`,
    `first_name.ilike.${like}`,
    `paternal_surname.ilike.${like}`,
    `maternal_surname.ilike.${like}`,
    `siap_full_name.ilike.${like}`,
  ].join(",");
}

export async function listUnionWorkers(
  delegationId: string,
  query: WorkerDirectoryQuery,
): Promise<WorkerDirectoryResult> {
  const supabase = await createClient();
  const values = valuesOf({
    q: query.q,
    categories: query.categories,
    turns: query.turns,
    assignments: query.assignments,
    status: query.status,
  });
  const pageSize = Math.min(Math.max(query.pageSize, 1), WORKER_DIRECTORY_MAX_PAGE_SIZE);
  const page = Math.max(query.page, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let builder = supabase
    .from("union_workers")
    .select(WORKER_LIST_COLUMNS, { count: "exact" })
    .eq("delegation_id", delegationId)
    .or(ROLLED_BACK_FILTER);
  if (values.status === "activos") builder = builder.eq("active", true);
  if (values.status === "inactivos") builder = builder.eq("active", false);
  if (values.categories.length > 0) builder = builder.in("category", values.categories);
  if (values.turns.length > 0) builder = builder.in("turn", values.turns);
  if (values.assignments.length > 0) builder = builder.in("assignment", values.assignments);
  const search = searchFilter(values.q);
  if (search) builder = builder.or(search);

  const sort: WorkerDirectorySortId = query.sort;
  switch (sort) {
    case "nombre_desc":
      builder = builder
        .order("paternal_surname", { ascending: false })
        .order("maternal_surname", { ascending: false })
        .order("first_name", { ascending: false });
      break;
    case "antiguedad_desc":
      builder = builder
        .order("seniority_years", { ascending: false, nullsFirst: false })
        .order("paternal_surname", { ascending: true });
      break;
    case "antiguedad_asc":
      builder = builder
        .order("seniority_years", { ascending: true, nullsFirst: false })
        .order("paternal_surname", { ascending: true });
      break;
    case "categoria_asc":
      builder = builder.order("category", { ascending: true }).order("paternal_surname", { ascending: true });
      break;
    case "matricula_asc":
      builder = builder.order("employee_number", { ascending: true });
      break;
    case "nombre_asc":
    default:
      builder = builder
        .order("paternal_surname", { ascending: true })
        .order("maternal_surname", { ascending: true })
        .order("first_name", { ascending: true });
      break;
  }

  const { data, error, count } = await builder.range(from, to);
  if (error) throw error;

  const total = count ?? 0;
  return {
    workers: (data ?? []) as unknown as WorkerDirectoryRow[],
    total,
    page,
    pageSize,
    hasMore: to + 1 < total,
  };
}

export async function countUnionWorkers(delegationId: string, filters: UnionWorkerFilters): Promise<number> {
  const supabase = await createClient();
  const values = valuesOf(filters);
  let builder = supabase
    .from("union_workers")
    .select("id", { count: "exact", head: true })
    .eq("delegation_id", delegationId)
    .or(ROLLED_BACK_FILTER);
  if (values.status === "activos") builder = builder.eq("active", true);
  if (values.status === "inactivos") builder = builder.eq("active", false);
  if (values.categories.length > 0) builder = builder.in("category", values.categories);
  if (values.turns.length > 0) builder = builder.in("turn", values.turns);
  if (values.assignments.length > 0) builder = builder.in("assignment", values.assignments);
  const search = searchFilter(values.q);
  if (search) builder = builder.or(search);

  const { count, error } = await builder;
  if (error) throw error;
  return count ?? 0;
}

export async function getUnionWorkerFacets(delegationId: string): Promise<WorkerDirectoryFacets> {
  const supabase = await createClient();
  const categories = new Set<string>();
  const turns = new Set<string>();
  const assignments = new Set<string>();
  const batchSize = 1000;
  const maxBatches = 5;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const from = batch * batchSize;
    const { data, error } = await supabase
      .from("union_workers")
      .select("category, assignment, turn")
      .eq("delegation_id", delegationId)
      .or(ROLLED_BACK_FILTER)
      .order("category", { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ category: string | null; assignment: string | null; turn: string | null }>;
    for (const row of rows) {
      if (row.category) categories.add(row.category.trim());
      if (row.assignment) assignments.add(row.assignment.trim());
      if (row.turn) turns.add(row.turn.trim());
    }
    if (rows.length < batchSize) break;
  }

  const sortEs = (a: string, b: string) => a.localeCompare(b, "es-MX");
  return {
    categories: [...categories].filter(Boolean).sort(sortEs),
    turns: [...turns].filter(Boolean).sort(sortEs),
    assignments: [...assignments].filter(Boolean).sort(sortEs),
  };
}

export interface WorkerSummaryCounts {
  total: number;
  active: number;
  inactive: number;
  categoriesCount: number;
}

export async function getUnionWorkerSummary(
  delegationId: string,
  categoriesCount = 0,
): Promise<WorkerSummaryCounts> {
  const supabase = await createClient();
  const [totalRes, activeRes] = await Promise.all([
    supabase
      .from("union_workers")
      .select("id", { count: "exact", head: true })
      .eq("delegation_id", delegationId)
      .or(ROLLED_BACK_FILTER),
    supabase
      .from("union_workers")
      .select("id", { count: "exact", head: true })
      .eq("delegation_id", delegationId)
      .eq("active", true)
      .or(ROLLED_BACK_FILTER),
  ]);
  const total = totalRes.count ?? 0;
  const active = activeRes.count ?? 0;
  const inactive = Math.max(0, total - active);
  return {
    total,
    active,
    inactive,
    categoriesCount,
  };
}

// ── Expediente del trabajador ──────────────────────────────────────────────

export interface UnionExpedienteWorker {
  id: string;
  employee_number: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string | null;
  siap_full_name: string;
  category: string;
  assignment: string;
  turn: string;
  schedule: string | null;
  rest_days: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  seniority_years: number | null;
  seniority_fortnights: number | null;
  seniority_days: number | null;
  seniority_raw: string | null;
  employment_start_date: string | null;
  contract_type_code: string | null;
  plaza_code: string | null;
  plaza_type_code: string | null;
  department_code: string | null;
  department_description: string | null;
  position_code: string | null;
  position_description: string | null;
  schedule_code: string | null;
  schedule_description: string | null;
  shift_code: string | null;
  occupation_start_date: string | null;
  occupation_limit_date: string | null;
  source_import_state: string | null;
  updated_at: string;
}

interface CaseBaseRow {
  id: string;
  folio: string;
  case_type: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
}

export interface UnionExpedienteCase extends CaseBaseRow {
  maternity: Record<string, unknown> | null;
  lactation: Record<string, unknown> | null;
  passage: Record<string, unknown> | null;
  license: Record<string, unknown> | null;
  documents: Array<{
    id: string;
    document_type: string;
    file_name: string | null;
    mime_type: string | null;
    template_version: string | null;
    created_at: string;
  }>;
  events: Array<{ id: string; event_type: string; title: string; detail: string | null; created_at: string }>;
}

export interface UnionWorkerExpediente {
  worker: UnionExpedienteWorker;
  cases: UnionExpedienteCase[];
  lockers: Array<{
    id: string;
    locker_number: string;
    location: string | null;
    section: string | null;
    status: string;
    assigned_at: string;
    released_at: string | null;
  }>;
  waitlist: Array<{ id: string; requested_at: string; status: string; notes: string | null }>;
  audit: Array<{ id: string; action: string; entity_type: string; created_at: string }>;
}

const WORKER_DETAIL_COLUMNS =
  "id, employee_number, first_name, paternal_surname, maternal_surname, siap_full_name, category, assignment, turn, schedule, rest_days, phone, notes, active, seniority_years, seniority_fortnights, seniority_days, seniority_raw, employment_start_date, contract_type_code, plaza_code, plaza_type_code, department_code, department_description, position_code, position_description, schedule_code, schedule_description, shift_code, occupation_start_date, occupation_limit_date, source_import_state, updated_at";

export async function getUnionWorkerExpediente(
  delegationId: string,
  workerId: string,
): Promise<UnionWorkerExpediente | null> {
  const supabase = await createClient();
  const { data: worker, error: workerError } = await supabase
    .from("union_workers")
    .select(WORKER_DETAIL_COLUMNS)
    .eq("delegation_id", delegationId)
    .eq("id", workerId)
    .or(ROLLED_BACK_FILTER)
    .maybeSingle();
  if (workerError) throw workerError;
  if (!worker) return null;

  const { data: caseRows, error: caseError } = await supabase
    .from("union_cases")
    .select("id, folio, case_type, status, opened_at, closed_at")
    .eq("delegation_id", delegationId)
    .eq("worker_id", workerId)
    .order("opened_at", { ascending: false })
    .limit(50);
  if (caseError) throw caseError;

  const cases = (caseRows ?? []) as CaseBaseRow[];
  const caseIds = cases.map((c) => c.id);

  const maternityByCase = new Map<string, Record<string, unknown>>();
  const lactationByCase = new Map<string, Record<string, unknown>>();
  const passageByCase = new Map<string, Record<string, unknown>>();
  const licenseByCase = new Map<string, Record<string, unknown>>();
  const documentsByCase = new Map<string, UnionExpedienteCase["documents"]>();
  const eventsByCase = new Map<string, UnionExpedienteCase["events"]>();

  if (caseIds.length > 0) {
    const [maternity, lactation, passages, licenses, documents, events] = await Promise.all([
      supabase.from("union_maternity_cases").select("*").in("case_id", caseIds),
      supabase.from("union_lactation_cases").select("*").in("case_id", caseIds),
      supabase.from("union_passage_cases").select("*").in("case_id", caseIds),
      supabase.from("union_license_cases").select("*").in("case_id", caseIds),
      supabase
        .from("union_case_documents")
        .select("id, case_id, document_type, file_name, mime_type, template_version, created_at")
        .in("case_id", caseIds)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("union_case_events")
        .select("id, case_id, event_type, title, detail, created_at")
        .in("case_id", caseIds)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    for (const row of (maternity.data ?? []) as Array<{ case_id: string } & Record<string, unknown>>) {
      maternityByCase.set(row.case_id, row);
    }
    for (const row of (lactation.data ?? []) as Array<{ case_id: string } & Record<string, unknown>>) {
      lactationByCase.set(row.case_id, row);
    }
    for (const row of (passages.data ?? []) as Array<{ case_id: string } & Record<string, unknown>>) {
      passageByCase.set(row.case_id, row);
    }
    for (const row of (licenses.data ?? []) as Array<{ case_id: string } & Record<string, unknown>>) {
      licenseByCase.set(row.case_id, row);
    }
    for (const row of (documents.data ?? []) as Array<{ case_id: string } & Record<string, unknown>>) {
      const list = documentsByCase.get(row.case_id) ?? [];
      list.push(row as unknown as UnionExpedienteCase["documents"][number]);
      documentsByCase.set(row.case_id, list);
    }
    for (const row of (events.data ?? []) as Array<{ case_id: string } & Record<string, unknown>>) {
      const list = eventsByCase.get(row.case_id) ?? [];
      list.push(row as unknown as UnionExpedienteCase["events"][number]);
      eventsByCase.set(row.case_id, list);
    }
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("union_locker_assignments")
    .select("id, locker_id, assigned_at, released_at, status")
    .eq("worker_id", workerId)
    .order("assigned_at", { ascending: false })
    .limit(20);
  if (assignmentError) throw assignmentError;

  const lockerIds = [...new Set((assignmentRows ?? []).map((a) => (a as { locker_id: string }).locker_id))];
  const lockerById = new Map<
    string,
    { locker_number: string; location: string | null; section: string | null; status: string }
  >();
  if (lockerIds.length > 0) {
    const { data: lockerRows } = await supabase
      .from("union_lockers")
      .select("id, locker_number, location, section, status")
      .in("id", lockerIds);
    for (const row of (lockerRows ?? []) as Array<{
      id: string;
      locker_number: string;
      location: string | null;
      section: string | null;
      status: string;
    }>) {
      lockerById.set(row.id, row);
    }
  }

  const { data: waitlistRows, error: waitlistError } = await supabase
    .from("union_locker_waitlist")
    .select("id, requested_at, status, notes")
    .eq("worker_id", workerId)
    .order("requested_at", { ascending: false })
    .limit(20);
  if (waitlistError) throw waitlistError;

  const { data: auditRows, error: auditError } = await supabase
    .from("union_audit_log")
    .select("id, action, entity_type, created_at")
    .eq("entity_type", "union_worker")
    .eq("entity_id", workerId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (auditError) throw auditError;

  return {
    worker: worker as unknown as UnionExpedienteWorker,
    cases: cases.map((c) => ({
      ...c,
      maternity: maternityByCase.get(c.id) ?? null,
      lactation: lactationByCase.get(c.id) ?? null,
      passage: passageByCase.get(c.id) ?? null,
      license: licenseByCase.get(c.id) ?? null,
      documents: documentsByCase.get(c.id) ?? [],
      events: eventsByCase.get(c.id) ?? [],
    })),
    lockers: (assignmentRows ?? [])
      .map((row) => {
        const assignment = row as {
          id: string;
          locker_id: string;
          assigned_at: string;
          released_at: string | null;
          status: string;
        };
        const locker = lockerById.get(assignment.locker_id);
        if (!locker) return null;
        return {
          id: assignment.id,
          locker_number: locker.locker_number,
          location: locker.location,
          section: locker.section,
          status: assignment.status,
          assigned_at: assignment.assigned_at,
          released_at: assignment.released_at,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    waitlist: (waitlistRows ?? []) as UnionWorkerExpediente["waitlist"],
    audit: (auditRows ?? []) as UnionWorkerExpediente["audit"],
  };
}
