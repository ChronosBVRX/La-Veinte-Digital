import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { normalizeLockerNumber } from "@/features/representacion/lib/lockers";
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
    const status = url.searchParams.get("status");
    const q = (url.searchParams.get("q") ?? "").trim();
    let query = supabase
      .from("union_lockers")
      .select("id, locker_number, location, section, status, notes, updated_at")
      .eq("delegation_id", depId)
      .order("locker_number", { ascending: true })
      .limit(500);
    if (status) query = query.eq("status", status);
    if (q) query = query.ilike("locker_number", `%${q}%`);
    const { data: lockers, error } = await query;
    if (error) throw error;
    const { data: assignments } = await supabase
      .from("union_locker_assignments")
      .select("id, locker_id, worker_id, assigned_at, status")
      .eq("status", "active");
    const assignmentRows = ((assignments ?? []) as unknown) as Array<{ id: string; locker_id: string; worker_id: string; assigned_at: string }>;
    const workerIds = [...new Set(assignmentRows.map((a) => a.worker_id))];
    let workerById = new Map<string, Record<string, unknown>>();
    if (workerIds.length > 0) {
      const { data: workers } = await supabase
        .from("union_workers")
        .select("id, first_name, paternal_surname, maternal_surname, employee_number")
        .in("id", workerIds);
      workerById = new Map((((workers ?? []) as unknown) as Array<{ id: string } & Record<string, unknown>>).map((w) => [w.id, w]));
    }
    const activeByLocker = new Map<string, unknown>();
    for (const a of assignmentRows) {
      activeByLocker.set(a.locker_id, { ...a, union_workers: workerById.get(a.worker_id) ?? null });
    }
    return noStore(
      NextResponse.json({
        lockers: ((lockers ?? []) as unknown as Array<{ id: string } & Record<string, unknown>>).map((l) => ({
          ...l,
          active_assignment: activeByLocker.get(l.id) ?? null,
        })),
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
