// Servicio de agregación server-side para el Centro de Control de Representación Sindical.
// Centraliza las métricas operativas, la detección de pendientes accionables
// y la actividad reciente, garantizando cero waterfalls y cero parpadeos.

import { createClient } from "@/lib/supabase/server";
import {
  type UnionDashboardSummary,
  formatRelativeTimeEs,
  formatCaseTypeLabel,
  formatCaseStatusLabel,
} from "../lib/dashboard-format";

export type { UnionDashboardSummary };
export { formatRelativeTimeEs, formatCaseTypeLabel, formatCaseStatusLabel };

const ROLLED_BACK_FILTER = "source_import_state.is.null,source_import_state.neq.rolled_back";

export async function getUnionDashboardSummary(delegationId: string): Promise<UnionDashboardSummary> {
  const supabase = await createClient();

  // 1. Delegación
  const { data: delegationRaw } = await supabase
    .from("union_delegations")
    .select("id, code, name, section, facility")
    .eq("id", delegationId)
    .single();

  const delegation = {
    id: delegationRaw?.id ?? delegationId,
    code: delegationRaw?.code ?? "XXI",
    name: delegationRaw?.name ?? "Delegación XXI",
    section: delegationRaw?.section ?? "Sección XX Michoacán",
    facility: delegationRaw?.facility ?? "HGR No. 1 Charo",
  };

  // 2. Ejecutar consultas paralelas tolerantes a fallos (Promise.allSettled)
  const [
    workersTotalRes,
    workersActiveRes,
    casesTotalRes,
    recentCasesRes,
    lockersRes,
    waitlistRes,
    lockerReviewRes,
  ] = await Promise.allSettled([
    // Workers total
    supabase
      .from("union_workers")
      .select("id", { count: "exact", head: true })
      .eq("delegation_id", delegationId)
      .or(ROLLED_BACK_FILTER),

    // Workers active
    supabase
      .from("union_workers")
      .select("id", { count: "exact", head: true })
      .eq("delegation_id", delegationId)
      .eq("active", true)
      .or(ROLLED_BACK_FILTER),

    // Cases total
    supabase
      .from("union_cases")
      .select("id", { count: "exact", head: true })
      .eq("delegation_id", delegationId)
      .is("deleted_at", null),

    // Recent cases with details (up to 20 for metrics + attention + recent activity)
    supabase
      .from("union_cases")
      .select("id, folio, case_type, status, opened_at, updated_at, worker_id")
      .eq("delegation_id", delegationId)
      .is("deleted_at", null)
      .order("opened_at", { ascending: false })
      .limit(20),

    // Lockers
    supabase
      .from("union_lockers")
      .select("status")
      .eq("delegation_id", delegationId),

    // Waitlist
    supabase
      .from("union_locker_waitlist")
      .select("id", { count: "exact", head: true })
      .eq("delegation_id", delegationId)
      .eq("status", "waiting"),

    // Locker review items (safe query)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("union_locker_review_items")
      .select("id", { count: "exact", head: true })
      .eq("delegation_id", delegationId)
      .eq("status", "pending"),
  ]);

  // Procesar Workers
  const workersTotal =
    workersTotalRes.status === "fulfilled" && !workersTotalRes.value.error
      ? workersTotalRes.value.count ?? 0
      : null;
  const workersActive =
    workersActiveRes.status === "fulfilled" && !workersActiveRes.value.error
      ? workersActiveRes.value.count ?? 0
      : null;
  const workersError =
    workersTotalRes.status === "rejected" ||
    Boolean(workersTotalRes.status === "fulfilled" && workersTotalRes.value.error);

  // Procesar Cases
  const casesTotal =
    casesTotalRes.status === "fulfilled" && !casesTotalRes.value.error
      ? casesTotalRes.value.count ?? 0
      : null;
  const casesError =
    casesTotalRes.status === "rejected" ||
    Boolean(casesTotalRes.status === "fulfilled" && casesTotalRes.value.error);

  // Procesar Lockers
  const lockersError =
    lockersRes.status === "rejected" ||
    Boolean(lockersRes.status === "fulfilled" && lockersRes.value.error);
  let lockersTotal: number | null = null;
  let lockersAssigned: number | null = null;
  let lockersAvailable: number | null = null;
  let lockersOccupancy: number | null = null;

  if (lockersRes.status === "fulfilled" && !lockersRes.value.error && Array.isArray(lockersRes.value.data)) {
    const lRows = lockersRes.value.data as Array<{ status: string }>;
    lockersTotal = lRows.length;
    lockersAssigned = lRows.filter((l) => l.status === "assigned").length;
    lockersAvailable = lRows.filter((l) => l.status === "available").length;
    lockersOccupancy = lockersTotal > 0 ? Math.round((lockersAssigned / lockersTotal) * 100) : 0;
  }

  const waitlistCount =
    waitlistRes.status === "fulfilled" && !waitlistRes.value.error
      ? waitlistRes.value.count ?? 0
      : 0;

  const lockerReviewCount =
    lockerReviewRes.status === "fulfilled" && !lockerReviewRes.value.error
      ? lockerReviewRes.value.count ?? 0
      : 0;

  // Procesar casos recientes y estado de trámites
  type CaseRow = {
    id: string;
    folio: string;
    case_type: string;
    status: string;
    opened_at: string;
    updated_at: string;
    worker_id: string;
  };

  const casesRows: CaseRow[] =
    recentCasesRes.status === "fulfilled" && !recentCasesRes.value.error && Array.isArray(recentCasesRes.value.data)
      ? (recentCasesRes.value.data as unknown as CaseRow[])
      : [];

  const openStatuses = new Set(["draft", "ready", "submitted", "under_review"]);
  const inProgressCases = casesRows.filter((c) => openStatuses.has(c.status));
  const draftCases = casesRows.filter((c) => c.status === "draft");
  const underReviewCases = casesRows.filter((c) => ["ready", "submitted", "under_review"].includes(c.status));

  // Obtener nombres de trabajadores para casos relevantes
  const relevantWorkerIds = [
    ...new Set(casesRows.slice(0, 10).map((c) => c.worker_id).filter(Boolean)),
  ];

  const workerMap = new Map<string, { name: string; employeeNumber: string }>();
  if (relevantWorkerIds.length > 0) {
    try {
      const { data: wList } = await supabase
        .from("union_workers")
        .select("id, first_name, paternal_surname, maternal_surname, employee_number")
        .in("id", relevantWorkerIds);

      if (wList) {
        for (const w of wList) {
          const parts = [w.first_name, w.paternal_surname, w.maternal_surname].filter(Boolean);
          workerMap.set(w.id, {
            name: parts.join(" "),
            employeeNumber: w.employee_number,
          });
        }
      }
    } catch {
      // Ignorar fallback de nombres
    }
  }

  // 3. Construir lista "Requiere tu atención" (Accionables reales)
  const attentionItems: UnionDashboardSummary["attentionItems"] = [];

  // A) Licencias en borrador (urgencia alta)
  for (const c of draftCases) {
    const w = workerMap.get(c.worker_id);
    const wInfo = w ? ` · ${w.name} (${w.employeeNumber})` : "";
    if (c.case_type === "license") {
      attentionItems.push({
        id: `att-draft-${c.id}`,
        caseId: c.id,
        type: "license_draft",
        title: `Licencia ${c.folio}`,
        subtitle: `Borrador sin finalizar${wInfo}`,
        actionLabel: "Continuar",
        actionHref: `/representacion/licencias?case=${c.id}&action=continue`,
        urgency: "high",
        date: c.opened_at,
      });
    } else {
      attentionItems.push({
        id: `att-draft-${c.id}`,
        caseId: c.id,
        type: "case_under_review",
        title: `${formatCaseTypeLabel(c.case_type)} ${c.folio}`,
        subtitle: `Borrador sin finalizar${wInfo}`,
        actionLabel: "Ver",
        actionHref: `/representacion/expedientes?folio=${c.folio}`,
        urgency: "high",
        date: c.opened_at,
      });
    }
  }

  // B) Trámites en revisión institucional
  for (const c of underReviewCases) {
    const w = workerMap.get(c.worker_id);
    const wInfo = w ? ` · ${w.name}` : "";
    attentionItems.push({
      id: `att-review-${c.id}`,
      caseId: c.id,
      type: "case_under_review",
      title: `${formatCaseTypeLabel(c.case_type)} ${c.folio}`,
      subtitle: `${formatCaseStatusLabel(c.status)}${wInfo}`,
      actionLabel: "Revisar",
      actionHref:
        c.case_type === "license"
          ? `/representacion/licencias?case=${c.id}&action=edit`
          : `/representacion/expedientes?folio=${c.folio}`,
      urgency: "medium",
      date: c.opened_at,
    });
  }

  // C) Casilleros con diferencias de importación
  if (lockerReviewCount > 0) {
    attentionItems.push({
      id: "att-lockers-review",
      type: "locker_review",
      title: `${lockerReviewCount} casillero${lockerReviewCount > 1 ? "s" : ""} con diferencias`,
      subtitle: "Registros de lockers pendientes de conciliar con el padrón",
      actionLabel: "Conciliar",
      actionHref: "/representacion/lockers/pendientes",
      urgency: "medium",
    });
  }

  // D) Lista de espera con casilleros disponibles
  if (waitlistCount > 0 && (lockersAvailable ?? 0) > 0) {
    attentionItems.push({
      id: "att-lockers-waitlist",
      type: "locker_waitlist",
      title: `${waitlistCount} compañero${waitlistCount > 1 ? "s" : ""} en lista de espera`,
      subtitle: `Hay ${lockersAvailable} casillero${(lockersAvailable ?? 0) > 1 ? "s" : ""} disponible${(lockersAvailable ?? 0) > 1 ? "s" : ""} para asignar`,
      actionLabel: "Asignar",
      actionHref: "/representacion/lockers",
      urgency: "medium",
    });
  }

  // Ordenar y limitar a top 5 elementos accionables
  const topAttention = attentionItems.slice(0, 5);

  // 4. Actividad reciente (últimos 5 eventos sin datos clínicos ni diagnósticos)
  const recentActivity: UnionDashboardSummary["recentActivity"] = [];
  for (const c of casesRows.slice(0, 5)) {
    const w = workerMap.get(c.worker_id);
    const workerLabel = w ? ` · ${w.name}` : "";
    recentActivity.push({
      id: c.id,
      title: `${formatCaseTypeLabel(c.case_type)} ${c.folio}`,
      detail: `${formatCaseStatusLabel(c.status)}${workerLabel}`,
      timeAgo: formatRelativeTimeEs(c.opened_at),
      timestamp: c.opened_at,
      caseType: c.case_type,
      folio: c.folio,
      href: c.case_type === "license" ? `/representacion/licencias?case=${c.id}&action=edit` : `/representacion/expedientes?folio=${c.folio}`,
    });
  }

  return {
    delegation,
    metrics: {
      workers: {
        total: workersTotal,
        active: workersActive,
        error: workersError,
      },
      cases: {
        total: casesTotal,
        error: casesError,
      },
      lockers: {
        total: lockersTotal,
        assigned: lockersAssigned,
        available: lockersAvailable,
        occupancyPercentage: lockersOccupancy,
        waitlistCount,
        error: lockersError,
      },
      procedures: {
        inProgress: inProgressCases.length,
        drafts: draftCases.length,
        underReview: underReviewCases.length,
        error: casesError,
      },
      attentionCount: attentionItems.length,
    },
    attentionItems: topAttention,
    recentActivity,
  };
}
