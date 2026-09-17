import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { normalizeLockerNumber, naturalCompare } from "@/features/representacion/lib/lockers";
import { lockerCreateSchema } from "@/features/representacion/lib/validation";
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
      const { data: locker, error: lErr } = await supabase
        .from("union_lockers")
        .select("id, locker_number, location, section, status, notes, updated_at, created_at, delegation_id")
        .eq("id", detailLockerId)
        .eq("delegation_id", depId)
        .single();
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pendingItem } = await (supabase as any)
        .from("union_locker_review_items")
        .select("id, locker_number, source_employee_number, source_worker_name, reason, reason_details, status, created_at")
        .eq("delegation_id", depId)
        .eq("locker_number", (locker as { locker_number: string }).locker_number)
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

      return noStore(
        NextResponse.json({
          locker: {
            ...locker,
            active_assignment: activeAsg ? { ...activeAsg, union_workers: activeWorker } : null,
            pending_review_item: pendingItem ?? null,
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
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const sort = url.searchParams.get("sort") ?? "number_asc";

    // Obtener todos los casilleros de la delegación
    const { data: rawLockers, error } = await supabase
      .from("union_lockers")
      .select("id, locker_number, location, section, status, notes, updated_at, created_at")
      .eq("delegation_id", depId);
    if (error) throw error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allLockers: any[] = rawLockers ?? [];

    // Obtener asignaciones activas de los casilleros de esta delegación
    const lockerIds = allLockers.map((l) => l.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let assignmentRows: any[] = [];
    if (lockerIds.length > 0) {
      const { data: assignments } = await supabase
        .from("union_locker_assignments")
        .select("id, locker_id, worker_id, assigned_at, status")
        .in("locker_id", lockerIds)
        .eq("status", "active");
      assignmentRows = assignments ?? [];
    }
    const workerIds = [...new Set(assignmentRows.map((a) => a.worker_id))];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let workerById = new Map<string, any>();
    if (workerIds.length > 0) {
      const { data: workers } = await supabase
        .from("union_workers")
        .select("id, first_name, paternal_surname, maternal_surname, employee_number, category, turn")
        .in("id", workerIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workerById = new Map((workers ?? []).map((w: any) => [w.id, w]));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeByLocker = new Map<string, any>();
    for (const a of assignmentRows) {
      activeByLocker.set(a.locker_id, { ...a, union_workers: workerById.get(a.worker_id) ?? null });
    }

    // Obtener elementos pendientes activos de revisión para esta delegación
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawPending } = await (supabase as any)
      .from("union_locker_review_items")
      .select("id, locker_id, locker_number, source_employee_number, source_worker_name, reason, reason_details, status")
      .eq("delegation_id", depId)
      .eq("status", "pending");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingItems: any[] = rawPending ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pendingByLockerNumber = new Map<string, any>();
    for (const p of pendingItems) {
      if (p.locker_number && !pendingByLockerNumber.has(p.locker_number)) {
        pendingByLockerNumber.set(p.locker_number, p);
      }
    }

    // Calcular conteos reales sobre la totalidad de casilleros de la delegación
    let availableCount = 0;
    let assignedCount = 0;
    let reservedCount = 0;
    let maintenanceCount = 0;
    let blockedCount = 0;

    for (const l of allLockers) {
      if (l.status === "available") availableCount++;
      else if (l.status === "assigned") assignedCount++;
      else if (l.status === "reserved") reservedCount++;
      else if (l.status === "maintenance") maintenanceCount++;
      else if (l.status === "blocked") blockedCount++;
    }

    const counts = {
      total: allLockers.length,
      available: availableCount,
      assigned: assignedCount,
      reserved: reservedCount,
      maintenance: maintenanceCount,
      blocked: blockedCount,
      pending: pendingItems.length,
    };

    // Construir filas unificadas con asignación activa y pendiente de revisión
    const enriched = allLockers.map((l) => {
      const activeAsg = activeByLocker.get(l.id) ?? null;
      const pendingItem = pendingByLockerNumber.get(l.locker_number) ?? null;
      return {
        ...l,
        active_assignment: activeAsg,
        pending_review_item: pendingItem,
      };
    });

    // Filtrar por estado
    let filtered = enriched;
    if (status === "pending") {
      filtered = filtered.filter((l) => Boolean(l.pending_review_item));
    } else if (status !== "all") {
      filtered = filtered.filter((l) => l.status === status);
    }

    // Filtrar por texto de búsqueda q (número de locker, matrícula o nombre de trabajador)
    if (q) {
      filtered = filtered.filter((l) => {
        if (l.locker_number && l.locker_number.toLowerCase().includes(q)) return true;
        const w = l.active_assignment?.union_workers;
        if (w) {
          if (w.employee_number && w.employee_number.toLowerCase().includes(q)) return true;
          const fullName = `${w.paternal_surname ?? ""} ${w.maternal_surname ?? ""} ${w.first_name ?? ""}`.toLowerCase();
          if (fullName.includes(q)) return true;
        }
        const p = l.pending_review_item;
        if (p) {
          if (p.source_employee_number && p.source_employee_number.toLowerCase().includes(q)) return true;
          if (p.source_worker_name && p.source_worker_name.toLowerCase().includes(q)) return true;
        }
        return false;
      });
    }

    // Ordenamiento (por defecto número natural ascendente)
    filtered.sort((a, b) => {
      if (sort === "number_desc") {
        return naturalCompare(b.locker_number ?? "", a.locker_number ?? "");
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
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo consultar lockers" }, { status: 500 }));
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
      const parsed = lockerCreateSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));
      const { data, error } = await supabase
        .from("union_lockers")
        .insert({
          delegation_id: depId,
          locker_number: normalizeLockerNumber(parsed.data.locker_number),
          location: parsed.data.location ?? "",
          section: parsed.data.section ?? "",
          status: "available",
          notes: parsed.data.notes ?? "",
        })
        .select("id")
        .single();
      if (error) return noStore(NextResponse.json({ error: "Número de locker duplicado o inválido" }, { status: 409 }));
      await writeAuditLog({ delegation_id: depId, entity_type: "union_locker", entity_id: String((data as { id: string }).id), action: "locker.created", metadata: {} });
      return noStore(NextResponse.json({ id: (data as { id: string }).id }));
    }

    if (action === "assign") {
      const parsed = assignSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
      const { data: locker } = await supabase.from("union_lockers").select("id, delegation_id, status").eq("id", parsed.data.locker_id).single();
      if (!locker || (locker as { delegation_id: string }).delegation_id !== depId) {
        return noStore(NextResponse.json({ error: "Locker no encontrado en esta delegación" }, { status: 404 }));
      }
      if ((locker as { status: string }).status === "maintenance" || (locker as { status: string }).status === "blocked") {
        return noStore(NextResponse.json({ error: "El locker no está disponible" }, { status: 409 }));
      }
      const { data: existingLocker } = await supabase
        .from("union_locker_assignments")
        .select("id")
        .eq("locker_id", parsed.data.locker_id)
        .eq("status", "active")
        .limit(1);
      if (existingLocker && existingLocker.length > 0) {
        return noStore(NextResponse.json({ error: "El locker ya tiene una asignación activa" }, { status: 409 }));
      }
      if (!parsed.data.admin_override) {
        const { data: existingWorker } = await supabase
          .from("union_locker_assignments")
          .select("id")
          .eq("worker_id", parsed.data.worker_id)
          .eq("status", "active")
          .limit(1);
        if (existingWorker && existingWorker.length > 0) {
          return noStore(NextResponse.json({ error: "El trabajador ya tiene un locker activo" }, { status: 409 }));
        }
      } else if (!parsed.data.admin_override_reason.trim()) {
        return noStore(NextResponse.json({ error: "El override administrativo requiere motivo auditado" }, { status: 400 }));
      }
      const { data: created, error } = await supabase
        .from("union_locker_assignments")
        .insert({
          locker_id: parsed.data.locker_id,
          worker_id: parsed.data.worker_id,
          status: "active",
          assignment_reason: parsed.data.assignment_reason ?? "",
          admin_override: parsed.data.admin_override,
          admin_override_reason: parsed.data.admin_override_reason ?? "",
          created_by: auth.user.id,
        })
        .select("id")
        .single();
      if (error) return noStore(NextResponse.json({ error: "No se pudo asignar (conflicto de unicidad)" }, { status: 409 }));
      await supabase.from("union_lockers").update({ status: "assigned" }).eq("id", parsed.data.locker_id);
      await writeAuditLog({
        delegation_id: depId,
        entity_type: "union_locker_assignment",
        entity_id: String((created as { id: string }).id),
        action: "locker.assigned",
        metadata: { admin_override: parsed.data.admin_override },
      });
      return noStore(NextResponse.json({ id: (created as { id: string }).id }));
    }

    if (action === "release") {
      const parsed = releaseSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
      const { data: asg } = await supabase
        .from("union_locker_assignments")
        .select("id, locker_id, status")
        .eq("id", parsed.data.assignment_id)
        .single();
      if (!asg) return noStore(NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 }));
      await supabase
        .from("union_locker_assignments")
        .update({ status: "released", released_at: new Date().toISOString(), release_reason: parsed.data.release_reason })
        .eq("id", parsed.data.assignment_id);
      await supabase.from("union_lockers").update({ status: "available" }).eq("id", (asg as { locker_id: string }).locker_id);
      await writeAuditLog({ delegation_id: depId, entity_type: "union_locker_assignment", entity_id: parsed.data.assignment_id, action: "locker.released", metadata: {} });
      return noStore(NextResponse.json({ ok: true }));
    }

    if (action === "status") {
      const parsed = statusSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
      await supabase.from("union_lockers").update({ status: parsed.data.status, notes: parsed.data.notes }).eq("id", parsed.data.locker_id);
      await writeAuditLog({ delegation_id: depId, entity_type: "union_locker", entity_id: parsed.data.locker_id, action: "locker.status", metadata: { status: parsed.data.status } });
      return noStore(NextResponse.json({ ok: true }));
    }

    return noStore(NextResponse.json({ error: "Acción no soportada" }, { status: 400 }));
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo procesar lockers" }, { status: 500 }));
  }
}
