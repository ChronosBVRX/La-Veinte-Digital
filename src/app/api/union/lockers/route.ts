import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership, requireUnionAdmin } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { naturalCompare } from "@/features/representacion/lib/lockers";
import {
  lockerCreateSchema,
  lockerUpdateSchema,
  lockerArchiveSchema,
  lockerRestoreSchema,
  lockerDeleteUnusedSchema,
  lockerBulkActionSchema,
} from "@/features/representacion/lib/validation";
import { fetchAllSupabaseRows, chunkArray } from "@/shared/lib/supabase-pagination";
import { getCanonicalLockerSummary } from "@/features/representacion/services/lockers-summary";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const assignSchema = z.object({
  locker_id: z.string().uuid(),
  worker_id: z.string().uuid(),
  assignment_reason: z.string().max(500).default(""),
  admin_override: z.boolean().default(false),
  admin_override_reason: z.string().max(500).default(""),
});

const releaseSchema = z.object({
  assignment_id: z.string().uuid(),
  release_reason: z.string().trim().min(1).max(500),
});

const statusSchema = z.object({
  locker_id: z.string().uuid(),
  status: z.enum(["available", "assigned", "reserved", "maintenance", "blocked"]),
  notes: z.string().max(500).default(""),
  condition: z.enum(["ok", "maintenance", "blocked"]).optional(),
  maintenance_reason: z.string().max(500).optional(),
  maintenance_notes: z.string().max(500).optional(),
});

const conditionSchema = z.object({
  locker_id: z.string().uuid(),
  condition: z.enum(["ok", "maintenance", "blocked"]),
  maintenance_reason: z.string().max(500).optional().default(""),
  maintenance_notes: z.string().max(500).optional().default(""),
});

const reserveSchema = z.object({
  locker_id: z.string().uuid(),
  worker_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional().default(""),
});

const cancelReserveSchema = z.object({
  locker_id: z.string().uuid(),
  reason: z.string().max(500).optional().default(""),
});

const updateLocationSchema = z.object({
  locker_id: z.string().uuid(),
  zone_id: z.string().uuid().nullable().optional(),
  bank_id: z.string().uuid().nullable().optional(),
  row_position: z.number().int().min(1).nullable().optional(),
  column_position: z.number().int().min(1).nullable().optional(),
  position_label: z.string().max(50).nullable().optional(),
  physical_code: z.string().max(50).nullable().optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  try {
    const delegationId = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    const supabase = await createClient();

    // 1. Consulta de detalle de un solo casillero e historial reciente
    const detailLockerId = url.searchParams.get("locker_id");
    if (detailLockerId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rawLocker, error: lErr } = await (supabase as any)
        .from("union_lockers")
        .select("id, locker_number, location, section, status, condition, zone_id, bank_id, row_position, column_position, position_label, physical_code, notes, maintenance_reason, maintenance_notes, updated_at, created_at, delegation_id, source, source_batch_id, last_seen_batch_id, last_seen_at, archived_at, archived_by, archive_reason, archive_source, reserved_for_worker_id, reservation_reason, reserved_until")
        .eq("id", detailLockerId)
        .eq("delegation_id", depId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const locker = rawLocker as Record<string, any> | null;
      if (lErr || !locker) {
        return noStore(NextResponse.json({ error: "Locker no encontrado" }, { status: 404 }));
      }

      const { data: rawActiveAsg } = await supabase
        .from("union_locker_assignments")
        .select("id, worker_id, assigned_at, status, admin_override, admin_override_reason")
        .eq("locker_id", detailLockerId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      const activeAsg = rawActiveAsg as {
        id: string;
        worker_id: string;
        assigned_at: string;
        status: string;
        admin_override: boolean;
        admin_override_reason: string;
      } | null;

      let activeWorker = null;
      if (activeAsg?.worker_id) {
        const { data: w } = await supabase
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname, category, assignment, turn")
          .eq("id", activeAsg.worker_id)
          .maybeSingle();
        activeWorker = w;
      }

      let reservedWorker = null;
      const lockerData = locker as { reserved_for_worker_id?: string | null; locker_number: string };
      if (lockerData.reserved_for_worker_id) {
        const { data: rw } = await supabase
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname")
          .eq("id", lockerData.reserved_for_worker_id)
          .maybeSingle();
        reservedWorker = rw;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pendingItem, count: pendingCount } = await (supabase as any)
        .from("union_locker_review_items")
        .select("id, locker_number, source_employee_number, source_worker_name, reason, source_notes, status, created_at", { count: "exact" })
        .eq("delegation_id", depId)
        .eq("locker_number", lockerData.locker_number)
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();

      const { data: history } = await supabase
        .from("union_locker_assignments")
        .select("id, worker_id, status, assigned_at, released_at, release_reason, admin_override, admin_override_reason")
        .eq("locker_id", detailLockerId)
        .order("assigned_at", { ascending: false })
        .limit(10);

      const historyWorkerIds = [...new Set((history ?? []).map((h) => h.worker_id))];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let historyWorkerMap = new Map<string, any>();
      if (historyWorkerIds.length > 0) {
        const { data: hw } = await supabase
          .from("union_workers")
          .select("id, employee_number, first_name, paternal_surname, maternal_surname")
          .in("id", historyWorkerIds);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        historyWorkerMap = new Map((hw ?? []).map((w: any) => [w.id, w]));
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedHistory = (history ?? []).map((h: any) => ({
        ...h,
        worker: historyWorkerMap.get(h.worker_id) ?? null,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let zoneData: any = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bankData: any = null;
      const lockerWithZone = locker as { zone_id?: string | null; bank_id?: string | null };
      if (lockerWithZone.zone_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: z } = await (supabase as any)
          .from("union_locker_zones")
          .select("id, name, building, floor")
          .eq("id", lockerWithZone.zone_id)
          .maybeSingle();
        zoneData = z;
      }
      if (lockerWithZone.bank_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: b } = await (supabase as any)
          .from("union_locker_banks")
          .select("id, name, rows, columns, orientation")
          .eq("id", lockerWithZone.bank_id)
          .maybeSingle();
        bankData = b;
      }

      return noStore(
        NextResponse.json({
          locker: {
            ...locker,
            zone: zoneData,
            bank: bankData,
            active_assignment: activeAsg ? { ...activeAsg, union_workers: activeWorker } : null,
            reserved_worker: reservedWorker,
            pending_review_item: pendingItem ?? null,
            pending_review_items_count: pendingCount ?? (pendingItem ? 1 : 0),
          },
          history: formattedHistory,
        }),
      );
    }

    // 2. Consulta rápida para verificar si un trabajador ya tiene casillero activo
    const checkWorkerId = url.searchParams.get("check_worker_id");
    if (checkWorkerId) {
      const { data: asg } = await supabase
        .from("union_locker_assignments")
        .select("id, locker_id, assigned_at")
        .eq("worker_id", checkWorkerId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (asg) {
        const { data: l } = await supabase
          .from("union_lockers")
          .select("id, locker_number")
          .eq("id", asg.locker_id)
          .maybeSingle();
        return noStore(
          NextResponse.json({
            hasActiveLocker: true,
            currentLockerId: asg.locker_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            currentLockerNumber: (l as any)?.locker_number ?? null,
          }),
        );
      }
      return noStore(NextResponse.json({ hasActiveLocker: false }));
    }

    // 3. Consulta de lista de casilleros con paginación server-side, orden natural y búsqueda
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "25", 10) || 25));
    const status = url.searchParams.get("status") ?? "all";
    const inventory = url.searchParams.get("inventory") ?? "active"; // active | archived | all
    const condition = url.searchParams.get("condition") ?? "all"; // all | ok | maintenance | blocked
    const location = url.searchParams.get("location") ?? "all"; // all | located | unlocated
    const zoneFilter = url.searchParams.get("zone") ?? "all";
    const bankFilter = url.searchParams.get("bank") ?? "all";
    const sourceFilter = url.searchParams.get("source") ?? "all";
    const q = (url.searchParams.get("q") ?? "").trim();
    const sort = url.searchParams.get("sort") ?? "number_asc";

    // Obtener resumen canónico de la delegación
    const canonicalSummary = await getCanonicalLockerSummary(supabase, depId);

    // Obtener todos los casilleros de la delegación con paginación server-side
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allLockers: any[] = await fetchAllSupabaseRows<any>(
      ({ from, to }) =>
        supabase
          .from("union_lockers")
          .select("id, locker_number, physical_code, location, section, status, condition, notes, maintenance_reason, maintenance_notes, updated_at, created_at, zone_id, bank_id, row_position, column_position, position_label, source, archived_at, archived_by, archive_reason, archive_source")
          .eq("delegation_id", depId)
          .range(from, to),
      { pageSize: 500 },
    );

    // Obtener zonas y bloques para enriquecer la ubicación física
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawZones } = await (supabase as any)
      .from("union_locker_zones")
      .select("id, name, building, floor")
      .eq("delegation_id", depId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawBanks } = await (supabase as any)
      .from("union_locker_banks")
      .select("id, name, rows, columns, orientation")
      .eq("delegation_id", depId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zoneMap = new Map((rawZones ?? []).map((z: any) => [z.id, z]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bankMap = new Map((rawBanks ?? []).map((b: any) => [b.id, b]));

    // Obtener asignaciones activas de los casilleros de esta delegación con paginación y join SQL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignmentRows: any[] = await fetchAllSupabaseRows<any>(
      ({ from, to }) =>
        supabase
          .from("union_locker_assignments")
          .select("id, locker_id, worker_id, assigned_at, status, union_lockers!inner(delegation_id)")
          .eq("status", "active")
          .eq("union_lockers.delegation_id", depId)
          .range(from, to),
      { pageSize: 500 },
    );

    const workerIds = [...new Set(assignmentRows.map((a) => a.worker_id).filter(Boolean))];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workerById = new Map<string, any>();
    if (workerIds.length > 0) {
      const workerChunks = chunkArray(workerIds, 200);
      for (const chunk of workerChunks) {
        const { data: workers } = await supabase
          .from("union_workers")
          .select("id, first_name, paternal_surname, maternal_surname, employee_number, category, turn")
          .in("id", chunk);
        if (workers) {
          for (const w of workers) {
            workerById.set(w.id, w);
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeByLocker = new Map<string, any>();
    for (const a of assignmentRows) {
      activeByLocker.set(a.locker_id, { ...a, union_workers: workerById.get(a.worker_id) ?? null });
    }

    // Obtener elementos pendientes activos de revisión para esta delegación con paginación
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingItems: any[] = await fetchAllSupabaseRows<any>(
      ({ from, to }) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("union_locker_review_items")
          .select("id, locker_id, locker_number, source_employee_number, source_worker_name, reason, source_notes, status")
          .eq("delegation_id", depId)
          .eq("status", "pending")
          .range(from, to),
      { pageSize: 500 },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingByLockerNumber = new Map<string, any>();
    for (const p of pendingItems) {
      if (p.locker_number && !pendingByLockerNumber.has(p.locker_number)) {
        pendingByLockerNumber.set(p.locker_number, p);
      }
    }

    const counts = {
      total: canonicalSummary.active_inventory ?? canonicalSummary.total,
      activeInventory: canonicalSummary.active_inventory ?? canonicalSummary.total,
      archived: canonicalSummary.archived ?? 0,
      available: canonicalSummary.available,
      assigned: canonicalSummary.assigned,
      reserved: canonicalSummary.reserved,
      maintenance: canonicalSummary.maintenance,
      blocked: canonicalSummary.blocked,
      unlocated: canonicalSummary.unlocated,
      pending: canonicalSummary.pendingReview,
    };

    // Construir filas unificadas con asignación activa y pendiente de revisión
    const enriched = allLockers.map((l) => {
      const activeAsg = activeByLocker.get(l.id) ?? null;
      const pendingItem = pendingByLockerNumber.get(l.locker_number) ?? null;
      return {
        ...l,
        zone: l.zone_id ? (zoneMap.get(l.zone_id) ?? null) : null,
        bank: l.bank_id ? (bankMap.get(l.bank_id) ?? null) : null,
        active_assignment: activeAsg,
        pending_review_item: pendingItem,
      };
    });

    // 1. Filtrar por inventario (activo / archivado / todos)
    let filtered = enriched;
    if (inventory === "active") {
      filtered = filtered.filter((l) => !l.archived_at);
    } else if (inventory === "archived") {
      filtered = filtered.filter((l) => Boolean(l.archived_at));
    }

    // 2. Filtrar por ocupación (status)
    if (status === "pending") {
      filtered = filtered.filter((l) => Boolean(l.pending_review_item));
    } else if (status !== "all") {
      filtered = filtered.filter((l) => l.status === status);
    }

    // 3. Filtrar por condición física
    if (condition !== "all") {
      filtered = filtered.filter((l) => l.condition === condition);
    }

    // 4. Filtrar por ubicación (ubicado / sin ubicar)
    if (location === "located") {
      filtered = filtered.filter((l) => Boolean(l.zone_id) && Boolean(l.bank_id));
    } else if (location === "unlocated") {
      filtered = filtered.filter((l) => !l.zone_id || !l.bank_id);
    }

    // 5. Filtrar por zona específica
    if (zoneFilter !== "all") {
      filtered = filtered.filter((l) => l.zone_id === zoneFilter);
    }

    // 6. Filtrar por mueble/bloque específico
    if (bankFilter !== "all") {
      filtered = filtered.filter((l) => l.bank_id === bankFilter);
    }

    // 7. Filtrar por fuente de origen
    if (sourceFilter !== "all") {
      filtered = filtered.filter((l) => l.source === sourceFilter);
    }

    // 8. Búsqueda tolerante a acentos y mayúsculas
    if (q) {
      const normalizeText = (t: string) =>
        t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const qNorm = normalizeText(q.replace(/^#/, ""));
      filtered = filtered.filter((l) => {
        if (l.locker_number && normalizeText(l.locker_number).includes(qNorm)) return true;
        if (l.physical_code && normalizeText(l.physical_code).includes(qNorm)) return true;
        if (l.zone?.name && normalizeText(l.zone.name).includes(qNorm)) return true;
        if (l.bank?.name && normalizeText(l.bank.name).includes(qNorm)) return true;
        const w = l.active_assignment?.union_workers;
        if (w) {
          if (w.employee_number && normalizeText(w.employee_number).includes(qNorm)) return true;
          const fullName = `${w.paternal_surname ?? ""} ${w.maternal_surname ?? ""} ${w.first_name ?? ""}`;
          if (normalizeText(fullName).includes(qNorm)) return true;
        }
        const p = l.pending_review_item;
        if (p) {
          if (p.source_employee_number && normalizeText(p.source_employee_number).includes(qNorm)) return true;
          if (p.source_worker_name && normalizeText(p.source_worker_name).includes(qNorm)) return true;
        }
        return false;
      });
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      if (sort === "number_desc") {
        return naturalCompare(b.locker_number ?? "", a.locker_number ?? "");
      }
      if (sort === "code_asc") {
        const codeA = a.physical_code ?? "ZZZZZZ";
        const codeB = b.physical_code ?? "ZZZZZZ";
        return codeA.localeCompare(codeB, "es", { sensitivity: "base" }) || naturalCompare(a.locker_number ?? "", b.locker_number ?? "");
      }
      if (sort === "updated_desc") {
        return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
      }
      if (sort === "zone_asc") {
        const zA = a.zone?.name ?? "ZZZZZZ";
        const zB = b.zone?.name ?? "ZZZZZZ";
        return zA.localeCompare(zB, "es", { sensitivity: "base" }) || naturalCompare(a.locker_number ?? "", b.locker_number ?? "");
      }
      if (sort === "worker_asc") {
        const nameA = a.active_assignment?.union_workers
          ? `${a.active_assignment.union_workers.paternal_surname} ${a.active_assignment.union_workers.first_name}`
          : a.pending_review_item?.source_worker_name ?? "ZZZZZZ";
        const nameB = b.active_assignment?.union_workers
          ? `${b.active_assignment.union_workers.paternal_surname} ${b.active_assignment.union_workers.first_name}`
          : b.pending_review_item?.source_worker_name ?? "ZZZZZZ";
        const cmp = nameA.localeCompare(nameB, "es", { sensitivity: "base" });
        if (cmp !== 0) return cmp;
        return naturalCompare(a.locker_number ?? "", b.locker_number ?? "");
      }
      if (sort === "status") {
        const cmp = (a.status ?? "").localeCompare(b.status ?? "");
        if (cmp !== 0) return cmp;
        return naturalCompare(a.locker_number ?? "", b.locker_number ?? "");
      }
      // default: number_asc
      return naturalCompare(a.locker_number ?? "", b.locker_number ?? "");
    });

    // Paginación
    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (clampedPage - 1) * pageSize;
    const paged = filtered.slice(startIndex, startIndex + pageSize);

    return noStore(
      NextResponse.json({
        lockers: paged,
        pagination: {
          total: totalFiltered,
          page: clampedPage,
          pageSize,
          totalPages,
        },
        counts,
      }),
    );
  } catch (err: unknown) {
    const errorDetails = err && typeof err === "object" ? (err as Record<string, unknown>) : null;
    let code = typeof errorDetails?.code === "string" ? errorDetails.code : undefined;
    if (!code && err instanceof Error) {
      const match = err.message.match(/\[([A-Z0-9_-]+)\]/);
      if (match) code = match[1];
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/union/lockers] Error loading lockers inventory:", {
      code,
      message,
      details: typeof errorDetails?.details === "string" ? errorDetails.details : undefined,
      hint: typeof errorDetails?.hint === "string" ? errorDetails.hint : undefined,
    });
    return noStore(
      NextResponse.json(
        {
          error: "No se pudo cargar el inventario de casilleros.",
          ...(code ? { errorCode: code } : {}),
        },
        { status: 500 },
      ),
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body = (await req.json()) as { action?: string; delegation_id?: string } & Record<string, unknown>;
    const action = String(body.action ?? "create");
    const memberships = await requireUnionMembership(typeof body.delegation_id === "string" ? body.delegation_id : undefined);
    const depId = (typeof body.delegation_id === "string" && body.delegation_id) || memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    const supabase = await createClient();

    if (action === "create") {
      await requireUnionAdmin(depId);
      const parsed = lockerCreateSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("union_create_locker", {
        p_delegation_id: depId,
        p_locker_number: parsed.data.locker_number,
        p_physical_code: parsed.data.physical_code ?? null,
        p_zone_id: parsed.data.zone_id ?? null,
        p_bank_id: parsed.data.bank_id ?? null,
        p_row_position: parsed.data.row_position ?? null,
        p_column_position: parsed.data.column_position ?? null,
        p_position_label: parsed.data.position_label ?? null,
        p_condition: parsed.data.condition ?? "ok",
        p_notes: parsed.data.notes ?? "",
        p_user_id: auth.user.id,
      });

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 409 }));
      return noStore(NextResponse.json({ id: rpcRes.id, locker_number: rpcRes.locker_number, ok: true }));
    }

    if (action === "update") {
      await requireUnionAdmin(depId);
      const parsed = lockerUpdateSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("union_update_locker", {
        p_locker_id: parsed.data.locker_id,
        p_new_locker_number: parsed.data.locker_number,
        p_physical_code: parsed.data.physical_code ?? null,
        p_zone_id: parsed.data.zone_id ?? null,
        p_bank_id: parsed.data.bank_id ?? null,
        p_row_position: parsed.data.row_position ?? null,
        p_column_position: parsed.data.column_position ?? null,
        p_position_label: parsed.data.position_label ?? null,
        p_condition: parsed.data.condition ?? null,
        p_notes: parsed.data.notes ?? null,
        p_renumber_reason: parsed.data.renumber_reason ?? "",
        p_user_id: auth.user.id,
      });

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 400 }));
      return noStore(NextResponse.json({ ok: true, result: rpcRes }));
    }

    if (action === "archive") {
      await requireUnionAdmin(depId);
      const parsed = lockerArchiveSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("union_archive_locker", {
        p_locker_id: parsed.data.locker_id,
        p_reason: parsed.data.reason,
        p_user_id: auth.user.id,
      });

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 400 }));
      return noStore(NextResponse.json({ ok: true, result: rpcRes }));
    }

    if (action === "restore") {
      await requireUnionAdmin(depId);
      const parsed = lockerRestoreSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("union_restore_locker", {
        p_locker_id: parsed.data.locker_id,
        p_user_id: auth.user.id,
      });

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 400 }));
      return noStore(NextResponse.json({ ok: true, result: rpcRes }));
    }

    if (action === "delete_unused") {
      await requireUnionAdmin(depId);
      const parsed = lockerDeleteUnusedSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("union_delete_unused_locker", {
        p_locker_id: parsed.data.locker_id,
        p_confirm_number: parsed.data.confirm_number,
        p_user_id: auth.user.id,
      });

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 400 }));
      return noStore(NextResponse.json({ ok: true, result: rpcRes }));
    }

    if (action === "bulk_update") {
      await requireUnionAdmin(depId);
      const parsed = lockerBulkActionSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("union_bulk_update_lockers", {
        p_delegation_id: depId,
        p_locker_ids: parsed.data.locker_ids,
        p_action: parsed.data.action,
        p_params: parsed.data.params,
        p_user_id: auth.user.id,
      });

      if (rpcErr) return noStore(NextResponse.json({ error: rpcErr.message }, { status: 400 }));
      return noStore(NextResponse.json({ ok: true, result: rpcRes }));
    }

    if (action === "assign") {
      const parsed = assignSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));

      // Ejecutar asignación atómica vía RPC transaccional
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("union_assign_locker", {
        p_locker_id: parsed.data.locker_id,
        p_worker_id: parsed.data.worker_id,
        p_assignment_reason: parsed.data.assignment_reason ?? "",
        p_admin_override: parsed.data.admin_override ?? false,
        p_admin_override_reason: parsed.data.admin_override_reason ?? "",
        p_created_by: auth.user.id,
      });

      if (rpcError) {
        const isForbidden = rpcError.message?.includes("No autorizado") || rpcError.message?.includes("No autenticado") || rpcError.message?.includes("administrador");
        return noStore(NextResponse.json({ error: rpcError.message || "Error al asignar casillero" }, { status: isForbidden ? 403 : 400 }));
      }

      if (!rpcResult || !rpcResult.success) {
        return noStore(NextResponse.json({ error: rpcResult?.error || "No se pudo asignar el casillero" }, { status: 409 }));
      }

      return noStore(NextResponse.json({ id: rpcResult.assignment_id }));
    }

    if (action === "release") {
      const parsed = releaseSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));

      // Ejecutar liberación atómica vía RPC transaccional
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("union_release_locker", {
        p_assignment_id: parsed.data.assignment_id,
        p_release_reason: parsed.data.release_reason,
        p_released_by: auth.user.id,
      });

      if (rpcError) {
        const isForbidden = rpcError.message?.includes("No autorizado") || rpcError.message?.includes("No autenticado");
        return noStore(NextResponse.json({ error: rpcError.message || "Error al liberar casillero" }, { status: isForbidden ? 403 : 400 }));
      }

      if (!rpcResult || !rpcResult.success) {
        return noStore(NextResponse.json({ error: rpcResult?.error || "No se pudo liberar el casillero" }, { status: 400 }));
      }

      return noStore(NextResponse.json({ ok: true }));
    }

    if (action === "status") {
      const parsed = statusSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));

      // Verificar si hay asignación activa antes de permitir cambio manual de status
      const { data: existingAsg } = await supabase
        .from("union_locker_assignments")
        .select("id")
        .eq("locker_id", parsed.data.locker_id)
        .eq("status", "active")
        .maybeSingle();

      if (parsed.data.status === "assigned" && !existingAsg) {
        return noStore(NextResponse.json({
          error: "No se puede marcar el casillero como 'Asignado' manualmente sin una asignación activa. Utilice la acción de asignar trabajador."
        }, { status: 400 }));
      }

      if (parsed.data.status === "available" && existingAsg) {
        return noStore(NextResponse.json({
          error: "No se puede marcar el casillero como 'Disponible' porque tiene una asignación activa. Libere primero la asignación del trabajador."
        }, { status: 400 }));
      }

      const updateData: Record<string, unknown> = {
        status: parsed.data.status,
        notes: parsed.data.notes,
        updated_at: new Date().toISOString(),
      };
      if (parsed.data.condition !== undefined) updateData.condition = parsed.data.condition;
      if (parsed.data.maintenance_reason !== undefined) updateData.maintenance_reason = parsed.data.maintenance_reason;
      if (parsed.data.maintenance_notes !== undefined) updateData.maintenance_notes = parsed.data.maintenance_notes;
      if (parsed.data.condition === "maintenance" || parsed.data.status === "maintenance") {
        updateData.maintenance_date = new Date().toISOString();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("union_lockers").update(updateData).eq("id", parsed.data.locker_id);
      await writeAuditLog({ delegation_id: depId, entity_type: "union_locker", entity_id: parsed.data.locker_id, action: "locker.status", metadata: updateData });
      return noStore(NextResponse.json({ ok: true }));
    }

    if (action === "condition") {
      const parsed = conditionSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("union_set_locker_condition", {
        p_locker_id: parsed.data.locker_id,
        p_condition: parsed.data.condition,
        p_reason: parsed.data.maintenance_reason || "",
        p_notes: parsed.data.maintenance_notes || "",
        p_updated_by: auth.user.id,
      });

      if (rpcError) {
        return noStore(NextResponse.json({ error: rpcError.message || "Error al actualizar condición física" }, { status: 400 }));
      }

      if (!rpcResult || !rpcResult.success) {
        return noStore(NextResponse.json({ error: rpcResult?.error || "No se pudo actualizar condición" }, { status: 400 }));
      }

      return noStore(NextResponse.json({ ok: true }));
    }

    if (action === "reserve") {
      const parsed = reserveSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("union_reserve_locker", {
        p_locker_id: parsed.data.locker_id,
        p_worker_id: parsed.data.worker_id || null,
        p_notes: parsed.data.notes || "",
        p_reserved_by: auth.user.id,
      });

      if (rpcError) {
        return noStore(NextResponse.json({ error: rpcError.message || "Error al reservar casillero" }, { status: 400 }));
      }

      if (!rpcResult || !rpcResult.success) {
        return noStore(NextResponse.json({ error: rpcResult?.error || "No se pudo reservar el casillero" }, { status: 400 }));
      }

      return noStore(NextResponse.json({ ok: true }));
    }

    if (action === "cancel_reservation") {
      const parsed = cancelReserveSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("union_cancel_locker_reservation", {
        p_locker_id: parsed.data.locker_id,
        p_reason: parsed.data.reason || "",
        p_cancelled_by: auth.user.id,
      });

      if (rpcError) {
        return noStore(NextResponse.json({ error: rpcError.message || "Error al cancelar reserva" }, { status: 400 }));
      }

      if (!rpcResult || !rpcResult.success) {
        return noStore(NextResponse.json({ error: rpcResult?.error || "No se pudo cancelar reserva" }, { status: 400 }));
      }

      return noStore(NextResponse.json({ ok: true }));
    }

    if (action === "location") {
      await requireUnionAdmin(depId);
      const parsed = updateLocationSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (parsed.data.zone_id !== undefined) updates.zone_id = parsed.data.zone_id;
      if (parsed.data.bank_id !== undefined) updates.bank_id = parsed.data.bank_id;
      if (parsed.data.row_position !== undefined) updates.row_position = parsed.data.row_position;
      if (parsed.data.column_position !== undefined) updates.column_position = parsed.data.column_position;
      if (parsed.data.position_label !== undefined) updates.position_label = parsed.data.position_label;
      if (parsed.data.physical_code !== undefined) updates.physical_code = parsed.data.physical_code;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("union_lockers").update(updates).eq("id", parsed.data.locker_id);
      await writeAuditLog({ delegation_id: depId, entity_type: "union_locker", entity_id: parsed.data.locker_id, action: "locker.location_changed", metadata: updates });
      return noStore(NextResponse.json({ ok: true }));
    }

    return noStore(NextResponse.json({ error: "Acción no soportada" }, { status: 400 }));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "No se pudo procesar lockers";
    const status = msg.includes("union_admin") || msg.includes("Sin acceso") || msg.includes("No autorizado") ? 403 : 500;
    return noStore(NextResponse.json({ error: msg }, { status }));
  }
}
