import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership, requireUnionAdmin } from "@/features/representacion/services/permissions";
import { fetchAllSupabaseRows } from "@/shared/lib/supabase-pagination";
import { z } from "zod";
import type { LockerReviewItem } from "@/features/representacion/services/worker-importer/types";
import {
  buildReconciliationCases,
  type SourceRowData,
  type LockerData,
  type WorkerData,
  type AssignmentData,
} from "@/features/representacion/services/locker-reconciliation-cases";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const resolveItemSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resolve_case"),
    caseType: z.enum(["WORKER_MULTIPLE_LOCKERS", "LOCKER_MULTIPLE_WORKERS", "WORKER_NOT_FOUND", "OTHER"]),
    subAction: z.enum(["select_locker_for_worker", "select_worker_for_locker", "link_worker_to_locker", "ignore"]),
    reviewItemIds: z.array(z.string().min(1)).min(1),
    selectedLockerId: z.string().min(1).optional(),
    selectedWorkerId: z.string().min(1).optional(),
    selectedLockerNumber: z.string().optional(),
    selectedEmployeeNumber: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("batch_resolve_safe_matches"),
    matches: z.array(
      z.object({
        reviewItemId: z.string().min(1),
        workerId: z.string().min(1),
        lockerId: z.string().min(1),
      })
    ),
  }),
  // Compatibilidad hacia atrás con endpoints anteriores
  z.object({
    action: z.literal("link_worker"),
    reviewItemId: z.string().min(1),
    workerId: z.string().min(1),
  }),
  z.object({
    action: z.literal("select_worker_for_locker"),
    reviewItemId: z.string().min(1),
    selectedEmployeeNumber: z.string().min(1),
  }),
  z.object({
    action: z.literal("select_locker_for_worker"),
    reviewItemId: z.string().min(1),
    selectedLockerNumber: z.string().min(1),
  }),
  z.object({
    action: z.literal("ignore"),
    reviewItemId: z.string().min(1),
  }),
  z.object({
    action: z.literal("batch_link_matches"),
  }),
]);

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const url = new URL(req.url);
    const delegationId = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) {
      return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    }

    const supabase = await createClient();
    const filter = url.searchParams.get("filter") ?? "all";
    const search = url.searchParams.get("search") ?? "";
    const sort = url.searchParams.get("sort") ?? "easy";
    const page = parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
    const pageSize = parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25;

    // 1. Cargar items de revisión pendientes de la delegación
    const items = await fetchAllSupabaseRows<LockerReviewItem>(
      ({ from, to }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("union_locker_review_items")
          .select("*")
          .eq("delegation_id", depId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .range(from, to),
      { pageSize: 500 }
    );

    // 2. Cargar datos del archivo Hoja1 para enriquecer con evidencia temporal y notas
    const sourceRows = await fetchAllSupabaseRows<SourceRowData>(
      ({ from, to }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("union_locker_import_source_rows")
          .select(
            "row_number, matricula_raw, matricula_normalized, worker_name_raw, plaza_raw, turn_raw, category_raw, schedule_raw, locker_raw, locker_normalized, observations_raw, supplementary_data"
          )
          .eq("delegation_id", depId)
          .range(from, to),
      { pageSize: 1000 }
    );

    // 3. Cargar inventario de casilleros físicos
    const lockers = await fetchAllSupabaseRows<LockerData>(
      ({ from, to }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("union_lockers")
          .select("id, locker_number, status, condition, zone_id, bank_id, notes")
          .eq("delegation_id", depId)
          .range(from, to),
      { pageSize: 1000 }
    );

    // 4. Cargar padrón de trabajadores
    const workers = await fetchAllSupabaseRows<WorkerData>(
      ({ from, to }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, adscripcion")
          .eq("delegation_id", depId)
          .range(from, to),
      { pageSize: 1000 }
    );

    // 5. Cargar asignaciones activas de los casilleros de esta delegación
    const assignments = await fetchAllSupabaseRows<AssignmentData>(
      ({ from, to }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("union_locker_assignments")
          .select("id, locker_id, worker_id, status, source, assigned_at, admin_override, union_lockers!inner(delegation_id)")
          .eq("union_lockers.delegation_id", depId)
          .range(from, to),
      { pageSize: 1000 }
    );

    // 6. Filtrar items por pestaña antes de agrupar si no es "all"
    let targetItems = items;
    if (filter === "worker_not_found") {
      targetItems = items.filter((i) => i.reason === "WORKER_NOT_FOUND");
    } else if (filter === "locker_multiple_workers") {
      targetItems = items.filter(
        (i) =>
          i.reason === "LOCKER_MULTIPLE_WORKERS" ||
          i.reason === "DUPLICATE_LOCKER_DIFFERENT_WORKERS" ||
          i.reason === "LOCKER_ASSIGNED_TO_OTHER_WORKER"
      );
    } else if (filter === "worker_multiple_lockers") {
      targetItems = items.filter((i) => i.reason === "WORKER_MULTIPLE_LOCKERS");
    } else if (filter === "other") {
      targetItems = items.filter(
        (i) =>
          i.reason !== "WORKER_NOT_FOUND" &&
          i.reason !== "LOCKER_MULTIPLE_WORKERS" &&
          i.reason !== "DUPLICATE_LOCKER_DIFFERENT_WORKERS" &&
          i.reason !== "LOCKER_ASSIGNED_TO_OTHER_WORKER" &&
          i.reason !== "WORKER_MULTIPLE_LOCKERS"
      );
    }

    // 7. Construir casos de conciliación enriquecidos
    const result = buildReconciliationCases({
      items: targetItems,
      sourceRows,
      lockers,
      workers,
      assignments,
      search,
      sort,
      page,
      pageSize,
    });

    return noStore(
      NextResponse.json({
        cases: result.cases,
        totalCases: result.totalCases,
        totalReviewItems: items.length,
        caseCounts: result.caseCounts,
        itemCounts: result.itemCounts,
        safeMatchesSummary: result.safeMatchesSummary,
        page,
        pageSize,
        // Compatibilidad hacia atrás para vistas que aún esperen items crudos
        items: targetItems,
        counts: {
          total: items.length,
          workerNotFound: result.itemCounts.workerNotFound,
          multipleWorkers: result.itemCounts.multipleWorkers,
          multipleLockers: result.itemCounts.multipleLockers,
          other: result.itemCounts.other,
        },
        newMatchesCount: result.safeMatchesSummary.totalFound,
        matches: result.safeMatchesSummary.safeMatches.map((m) => ({
          reviewItemId: m.reviewItemId,
          lockerNumber: m.lockerNumber,
          employeeNumber: m.employeeNumber,
          workerId: m.workerId,
          workerName: m.workerName,
        })),
      })
    );
  } catch (err: unknown) {
    return noStore(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Error al cargar casos de conciliación de casilleros" },
        { status: 500 }
      )
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const json = await req.json();
    const parsed = resolveItemSchema.safeParse(json);
    if (!parsed.success) {
      return noStore(
        NextResponse.json(
          { error: "Parámetros inválidos", details: parsed.error.issues },
          { status: 400 }
        )
      );
    }

    const memberships = await requireUnionMembership();
    const depId = memberships[0]?.delegation_id;
    if (!depId) {
      return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    }

    await requireUnionAdmin(depId);
    const supabase = await createClient();
    const body = parsed.data;

    // A) RESOLUCIÓN ATÓMICA DE UN CASO COMPLETO
    if (body.action === "resolve_case") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc(
        "union_resolve_locker_review_case",
        {
          p_delegation_id: depId,
          p_case_type: body.caseType,
          p_action: body.subAction,
          p_review_item_ids: body.reviewItemIds,
          p_selected_locker_id: body.selectedLockerId || null,
          p_selected_worker_id: body.selectedWorkerId || null,
          p_selected_locker_number: body.selectedLockerNumber || null,
          p_selected_employee_number: body.selectedEmployeeNumber || null,
          p_notes: body.notes || null,
          p_user_id: auth.user.id,
        }
      );

      if (rpcErr) {
        return noStore(NextResponse.json({ error: rpcErr.message }, { status: 500 }));
      }

      return noStore(NextResponse.json({ ok: true, result: rpcRes }));
    }

    // B) RESOLUCIÓN SEGURA DE COINCIDENCIAS EN LOTE
    if (body.action === "batch_resolve_safe_matches") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batchRes, error: batchErr } = await (supabase as any).rpc(
        "union_batch_resolve_safe_matches",
        {
          p_delegation_id: depId,
          p_matches: body.matches,
          p_user_id: auth.user.id,
        }
      );

      if (batchErr) {
        return noStore(NextResponse.json({ error: batchErr.message }, { status: 500 }));
      }

      return noStore(NextResponse.json({ ok: true, ...batchRes }));
    }

    // C) COMPATIBILIDAD: VINCULAR TRABAJADOR MANUALMENTE
    if (body.action === "link_worker") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc(
        "union_resolve_locker_review_case",
        {
          p_delegation_id: depId,
          p_case_type: "WORKER_NOT_FOUND",
          p_action: "link_worker_to_locker",
          p_review_item_ids: [body.reviewItemId],
          p_selected_worker_id: body.workerId,
          p_user_id: auth.user.id,
        }
      );

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 500 }));
      return noStore(NextResponse.json({ ok: true, resolvedId: body.reviewItemId, result: rpcRes }));
    }

    // D) COMPATIBILIDAD: SELECCIONAR TRABAJADOR PARA CASILLERO
    if (body.action === "select_worker_for_locker") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc(
        "union_resolve_locker_review_case",
        {
          p_delegation_id: depId,
          p_case_type: "LOCKER_MULTIPLE_WORKERS",
          p_action: "select_worker_for_locker",
          p_review_item_ids: [body.reviewItemId],
          p_selected_employee_number: body.selectedEmployeeNumber,
          p_user_id: auth.user.id,
        }
      );

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 500 }));
      return noStore(NextResponse.json({ ok: true, resolvedId: body.reviewItemId, result: rpcRes }));
    }

    // E) COMPATIBILIDAD: SELECCIONAR CASILLERO PARA TRABAJADOR
    if (body.action === "select_locker_for_worker") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc(
        "union_resolve_locker_review_case",
        {
          p_delegation_id: depId,
          p_case_type: "WORKER_MULTIPLE_LOCKERS",
          p_action: "select_locker_for_worker",
          p_review_item_ids: [body.reviewItemId],
          p_selected_locker_number: body.selectedLockerNumber,
          p_user_id: auth.user.id,
        }
      );

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 500 }));
      return noStore(NextResponse.json({ ok: true, resolvedId: body.reviewItemId, result: rpcRes }));
    }

    // F) COMPATIBILIDAD: IGNORAR ITEM
    if (body.action === "ignore") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc(
        "union_resolve_locker_review_case",
        {
          p_delegation_id: depId,
          p_case_type: "OTHER",
          p_action: "ignore",
          p_review_item_ids: [body.reviewItemId],
          p_user_id: auth.user.id,
        }
      );

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 500 }));
      return noStore(NextResponse.json({ ok: true, resolvedId: body.reviewItemId, result: rpcRes }));
    }

    // G) COMPATIBILIDAD: BATCH LINK MATCHES
    if (body.action === "batch_link_matches") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawItems } = await (supabase as any)
        .from("union_locker_review_items")
        .select("id, locker_number, source_employee_number")
        .eq("delegation_id", depId)
        .eq("status", "pending")
        .eq("reason", "WORKER_NOT_FOUND");

      const pendingItems = (rawItems as LockerReviewItem[]) ?? [];
      const matriculas = pendingItems.map((i) => i.source_employee_number).filter(Boolean) as string[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: workers } = await (supabase as any)
        .from("union_workers")
        .select("id, employee_number")
        .eq("delegation_id", depId)
        .in("employee_number", matriculas);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lockers } = await (supabase as any)
        .from("union_lockers")
        .select("id, locker_number")
        .eq("delegation_id", depId);

      const workerMap = new Map((workers as Array<{ id: string; employee_number: string }>)?.map((w) => [w.employee_number, w.id]));
      const lockerMap = new Map((lockers as Array<{ id: string; locker_number: string }>)?.map((l) => [l.locker_number, l.id]));

      const safeMatchesList: Array<{ reviewItemId: string; workerId: string; lockerId: string }> = [];
      for (const it of pendingItems) {
        if (!it.source_employee_number) continue;
        const wId = workerMap.get(it.source_employee_number);
        const lId = lockerMap.get(it.locker_number);
        if (wId && lId) {
          safeMatchesList.push({
            reviewItemId: it.id,
            workerId: wId,
            lockerId: lId,
          });
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: batchRes, error: batchErr } = await (supabase as any).rpc(
        "union_batch_resolve_safe_matches",
        {
          p_delegation_id: depId,
          p_matches: safeMatchesList,
          p_user_id: auth.user.id,
        }
      );

      if (batchErr) return noStore(NextResponse.json({ error: batchErr.message }, { status: 500 }));
      return noStore(NextResponse.json({ ok: true, linkedCount: batchRes?.linkedCount ?? 0 }));
    }

    return noStore(NextResponse.json({ error: "Acción no reconocida" }, { status: 400 }));
  } catch (err: unknown) {
    return noStore(
      NextResponse.json(
        { error: err instanceof Error ? err.message : "Error al procesar resolución de caso" },
        { status: 500 }
      )
    );
  }
}
