import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { createUnionCase, addCaseEvent } from "@/features/representacion/services/cases";
import { writeAuditLog } from "@/features/representacion/services/audit";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const renewalSchema = z.object({
  delegation_id: z.string().uuid().optional(),
  worker_id: z.string().uuid(),
  locker_id: z.string().uuid(),
  movement_type: z.enum(["actualizacion_2026", "asignacion_nueva", "cambio", "baja"]).default("actualizacion_2026"),
  phone: z.string().max(50).optional(),
  condition: z.enum(["ok", "maintenance", "damaged", "blocked"]).default("ok"),
  observations: z.string().max(1000).optional().default(""),
  physical_code: z.string().max(100).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = renewalSchema.safeParse(body);
    if (!parsed.success) {
      return noStore(
        NextResponse.json(
          { error: "Datos de actualización inválidos", issues: parsed.error.issues },
          { status: 400 },
        ),
      );
    }

    const memberships = await requireUnionMembership(parsed.data.delegation_id);
    const depId = parsed.data.delegation_id || memberships[0]?.delegation_id;
    const depCode = memberships.find((m) => m.delegation_id === depId)?.delegation_code ?? "XXI";
    if (!depId) {
      return noStore(NextResponse.json({ error: "Sin delegación autorizada" }, { status: 403 }));
    }

    const supabase = await createClient();

    // 1. Obtener datos del trabajador
    const { data: worker, error: workerErr } = await supabase
      .from("union_workers")
      .select("id, employee_number, first_name, paternal_surname, maternal_surname, siap_full_name, category, assignment, turn, phone")
      .eq("id", parsed.data.worker_id)
      .eq("delegation_id", depId)
      .single();

    if (workerErr || !worker) {
      return noStore(NextResponse.json({ error: "Trabajador no encontrado en el padrón" }, { status: 404 }));
    }

    // Actualizar teléfono del trabajador si fue modificado
    if (parsed.data.phone !== undefined && parsed.data.phone.trim() !== (worker.phone || "").trim()) {
      await supabase
        .from("union_workers")
        .update({ phone: parsed.data.phone.trim(), updated_at: new Date().toISOString() })
        .eq("id", worker.id);
    }

    // 2. Obtener datos del casillero
    const { data: locker, error: lockerErr } = await supabase
      .from("union_lockers")
      .select("id, locker_number, zone_id, bank_id, physical_code, condition, status, delegation_id")
      .eq("id", parsed.data.locker_id)
      .eq("delegation_id", depId)
      .single();

    if (lockerErr || !locker) {
      return noStore(NextResponse.json({ error: "Casillero no encontrado en la delegación" }, { status: 404 }));
    }

    // Obtener nombres de zona y bloque si existen
    let zoneName = "Área General";
    if (locker.zone_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: zData } = await (supabase as any)
        .from("union_locker_zones")
        .select("name")
        .eq("id", locker.zone_id)
        .maybeSingle();
      if (zData?.name) zoneName = zData.name;
    }

    let bankName = "Mueble Estándar";
    if (locker.bank_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bData } = await (supabase as any)
        .from("union_locker_banks")
        .select("name")
        .eq("id", locker.bank_id)
        .maybeSingle();
      if (bData?.name) bankName = bData.name;
    }

    // 3. Gestionar Asignación Activa
    const { data: existingAsg } = await supabase
      .from("union_locker_assignments")
      .select("id, locker_id, worker_id, status, resguardo_status")
      .eq("locker_id", locker.id)
      .eq("status", "active")
      .maybeSingle();

    let assignmentId: string | null = null;

    if (existingAsg) {
      if (existingAsg.worker_id === worker.id) {
        // Mismo trabajador: refrendo / actualización de resguardo
        assignmentId = existingAsg.id;
        await supabase
          .from("union_locker_assignments")
          .update({
            resguardo_status: "actualizado_2026",
            assignment_reason: "Programa de Actualización de Locker 2026",
          })
          .eq("id", existingAsg.id);
      } else {
        // Está asignado a OTRA persona: si no es liberación explícita, advertir
        return noStore(
          NextResponse.json(
            { error: `El casillero ${locker.locker_number} figura asignado a otro trabajador. Debe liberarse primero.` },
            { status: 409 },
          ),
        );
      }
    } else {
      // No tiene asignación activa: asignar de forma atómica
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcRes, error: rpcErr } = await (supabase as any).rpc("union_assign_locker", {
        p_locker_id: locker.id,
        p_worker_id: worker.id,
        p_assignment_reason: "Programa de Actualización de Locker 2026",
        p_admin_override: true,
        p_admin_override_reason: "Asignación ventanilla Actualización 2026",
        p_created_by: auth.user.id,
      });

      if (rpcErr || !rpcRes?.success) {
        return noStore(
          NextResponse.json(
            { error: rpcErr?.message || rpcRes?.error || "No se pudo asignar el casillero." },
            { status: 400 },
          ),
        );
      }

      assignmentId = rpcRes.assignment_id || null;
      if (assignmentId) {
        await supabase
          .from("union_locker_assignments")
          .update({ resguardo_status: "actualizado_2026" })
          .eq("id", assignmentId);
      }
    }

    // Actualizar condición y código físico del casillero si cambió
    await supabase
      .from("union_lockers")
      .update({
        condition: parsed.data.condition,
        physical_code: parsed.data.physical_code !== undefined ? parsed.data.physical_code : locker.physical_code,
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", locker.id);

    // 4. Crear Expediente Oficial con Folio Atómico LOK
    const fullName =
      typeof worker.siap_full_name === "string" && worker.siap_full_name
        ? worker.siap_full_name
        : `${worker.first_name || ""} ${worker.paternal_surname || ""} ${worker.maternal_surname || ""}`.trim();

    const createdCase = await createUnionCase({
      delegation_id: depId,
      delegation_code: depCode,
      worker_id: worker.id,
      worker_snapshot: {
        ...worker,
        full_name: fullName,
        phone: parsed.data.phone || worker.phone,
        locker_number: locker.locker_number,
        zone_name: zoneName,
        bank_name: bankName,
        movement_type: parsed.data.movement_type,
        condition: parsed.data.condition,
        observations: parsed.data.observations,
      },
      case_type: "locker",
    });

    // 5. Insertar en tabla complementaria union_locker_cases
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("union_locker_cases").insert({
      case_id: createdCase.id,
      delegation_id: depId,
      locker_id: locker.id,
      assignment_id: assignmentId,
      movement_type: parsed.data.movement_type,
      locker_number: locker.locker_number,
      zone_name: zoneName,
      bank_name: bankName,
      physical_code: parsed.data.physical_code || locker.physical_code || null,
      condition: parsed.data.condition,
      worker_phone: parsed.data.phone || worker.phone || "",
      worker_turn: worker.turn || "",
      worker_assignment: worker.assignment || "",
      worker_category: worker.category || "",
      observations: parsed.data.observations || "",
    });

    // 6. Registrar Evento en Línea de Tiempo del Expediente
    await addCaseEvent(
      createdCase.id,
      "renewed",
      "Actualización de Locker 2026",
      `Casillero No. ${locker.locker_number} actualizado con folio ${createdCase.folio}. Resguardo vigente 2026.`,
    );

    // 7. Auditoría
    await writeAuditLog({
      delegation_id: depId,
      entity_type: "union_locker",
      entity_id: locker.id,
      action: "locker.renewal_2026",
      metadata: {
        folio: createdCase.folio,
        case_id: createdCase.id,
        worker_id: worker.id,
        movement_type: parsed.data.movement_type,
      },
    });

    return noStore(
      NextResponse.json({
        success: true,
        case_id: createdCase.id,
        folio: createdCase.folio,
        locker_number: locker.locker_number,
        worker_name: fullName,
        delegation_id: depId,
      }),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar actualización de casillero.";
    return noStore(NextResponse.json({ error: message }, { status: 500 }));
  }
}
