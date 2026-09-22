import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { createUnionCase, addCaseEvent } from "@/features/representacion/services/cases";
import { calculateMaternity } from "@/features/representacion/lib/maternity";
import { calculateLactation, type LactationWorkdayType } from "@/features/representacion/lib/lactation";
import { calculateLicense } from "@/features/representacion/lib/licenses";
import {
  maternityInputSchema,
  lactationInputSchema,
  passage026Schema,
  passage027Schema,
  licenseInputSchema,
  caseStatusSchema,
} from "@/features/representacion/lib/validation";
import { z } from "zod";
import type { Json } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const statusBody = z.object({ case_id: z.string().uuid(), status: caseStatusSchema, note: z.string().max(500).default("") });

async function workerSnapshot(supabase: Awaited<ReturnType<typeof createClient>>, workerId: string) {
  const { data } = await supabase
    .from("union_workers")
    .select("id, employee_number, first_name, paternal_surname, maternal_surname, siap_full_name, category, assignment, turn, schedule, rest_days")
    .eq("id", workerId)
    .single();
  if (!data) throw new Error("Trabajador no encontrado");
  return data as unknown as Record<string, unknown>;
}

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
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const wq = url.searchParams.get("worker_id");
    const folioQ = (url.searchParams.get("folio") ?? "").trim();
    let query = supabase
      .from("union_cases")
      .select("id, folio, case_type, status, opened_at, closed_at, worker_id")
      .eq("delegation_id", depId)
      .order("opened_at", { ascending: false })
      .limit(100);
    if (type) query = query.eq("case_type", type);
    if (status) query = query.eq("status", status);
    if (wq) query = query.eq("worker_id", wq);
    if (folioQ) query = query.ilike("folio", `%${folioQ}%`);
    const { data, error } = await query;
    if (error) throw error;
    const caseRows = (data ?? []) as Array<{ id: string; worker_id: string } & Record<string, unknown>>;
    const workerIds = [...new Set(caseRows.map((c) => c.worker_id))];
    let workersById = new Map<string, Record<string, unknown>>();
    if (workerIds.length > 0) {
      const { data: workers } = await supabase
        .from("union_workers")
        .select("id, first_name, paternal_surname, maternal_surname, employee_number")
        .in("id", workerIds);
      workersById = new Map(((workers ?? []) as Array<{ id: string } & Record<string, unknown>>).map((w) => [w.id, w]));
    }
    return noStore(
      NextResponse.json({
        cases: caseRows.map((c) => ({ ...c, union_workers: workersById.get(c.worker_id) ?? null })),
      }),
    );
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo consultar expedientes" }, { status: 500 }));
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body = (await req.json()) as { kind?: string; delegation_id?: string } & Record<string, unknown>;
    const kind = String(body.kind ?? "");
    const memberships = await requireUnionMembership(typeof body.delegation_id === "string" ? body.delegation_id : undefined);
    const depId = (typeof body.delegation_id === "string" && body.delegation_id) || memberships[0]?.delegation_id;
    const depCode = memberships.find((m) => m.delegation_id === depId)?.delegation_code ?? "XXI";
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    const supabase = await createClient();

    if (kind === "maternity") {
      const parsed = maternityInputSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));
      const snap = await workerSnapshot(supabase, parsed.data.worker_id);
      const calc = calculateMaternity(parsed.data.incapacity_start);
      const created = await createUnionCase({
        delegation_id: depId,
        delegation_code: depCode,
        worker_id: parsed.data.worker_id,
        worker_snapshot: snap,
        case_type: "maternity",
      });
      await supabase.from("union_maternity_cases").insert({
        case_id: created.id,
        incapacity_start: calc.incapacityStart,
        incapacity_end: calc.incapacityEnd,
        return_to_work: calc.returnToWork,
        lactation_start: calc.lactationStart,
        lactation_end: calc.lactationEnd,
        rule_version: calc.ruleVersion,
        notes: parsed.data.notes ?? "",
      });
      await addCaseEvent(created.id, "calculated", "Cálculo administrativo orientativo", `90 días ${calc.incapacityStart} → ${calc.incapacityEnd}; reanuda ${calc.returnToWork}.`);
      await writeAuditLog({ delegation_id: depId, entity_type: "union_case", entity_id: created.id, action: "case.maternity.created", metadata: { folio: created.folio } });
      return noStore(NextResponse.json({ id: created.id, folio: created.folio, result: calc }));
    }

    if (kind === "lactation") {
      const parsed = lactationInputSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));
      const snap = await workerSnapshot(supabase, parsed.data.worker_id);
      const calc = calculateLactation(parsed.data.return_to_work);
      const created = await createUnionCase({
        delegation_id: depId,
        delegation_code: depCode,
        worker_id: parsed.data.worker_id,
        worker_snapshot: snap,
        case_type: "lactation",
      });
      await supabase.from("union_lactation_cases").insert({
        case_id: created.id,
        return_to_work: parsed.data.return_to_work,
        period_start: calc.periodStart,
        period_end: calc.periodEnd,
        workday_type: parsed.data.workday_type as LactationWorkdayType,
        selected_modality: parsed.data.selected_modality ?? "",
        rule_version: calc.ruleVersion,
        notes: parsed.data.notes ?? "",
      });
      await addCaseEvent(created.id, "calculated", "Periodo de lactancia registrado", `365 días ${calc.periodStart} → ${calc.periodEnd}.`);
      await writeAuditLog({ delegation_id: depId, entity_type: "union_case", entity_id: created.id, action: "case.lactation.created", metadata: { folio: created.folio } });
      return noStore(NextResponse.json({ id: created.id, folio: created.folio, result: calc }));
    }

    if (kind === "passage_026" || kind === "passage_027") {
      const schema = kind === "passage_026" ? passage026Schema : passage027Schema;
      const parsed = schema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));
      const p = parsed.data as { worker_id: string; request_date: string; control_number?: string; ooad: string } & Record<string, unknown>;
      const snap = await workerSnapshot(supabase, p.worker_id);
      const created = await createUnionCase({
        delegation_id: depId,
        delegation_code: depCode,
        worker_id: p.worker_id,
        worker_snapshot: snap,
        case_type: kind,
      });
      const base = {
        case_id: created.id,
        concept: kind === "passage_026" ? "026" : "027",
        request_date: p.request_date,
        control_number: (p.control_number as string) || null,
        ooad: String(p.ooad ?? ""),
        observations: String((p as Record<string, unknown>).observations ?? ""),
        external_status: "pending",
      };
      if (kind === "passage_026") {
        const r = p as unknown as { extramural_functions: string; transfer_period: string };
        await supabase.from("union_passage_cases").insert({
          ...base,
          discontinuous_schedule: "",
          extramural_functions: r.extramural_functions ?? "",
          transfer_period: r.transfer_period ?? "",
          worker_address: {},
          assignment_address: {},
          phone: "",
        });
      } else {
        const r = p as unknown as {
          discontinuous_schedule: string;
          worker_address: Record<string, string>;
          assignment_address: Record<string, string>;
          phone: string;
        };
        await supabase.from("union_passage_cases").insert({
          ...base,
          discontinuous_schedule: r.discontinuous_schedule,
          extramural_functions: "",
          transfer_period: "",
          worker_address: r.worker_address as unknown as Json,
          assignment_address: r.assignment_address as unknown as Json,
          phone: r.phone ?? "",
        });
      }
      await addCaseEvent(created.id, "prepared", "Formato listo para revisión", "Pendiente de dictamen de la Subcomisión Mixta de Pasajes.");
      await writeAuditLog({ delegation_id: depId, entity_type: "union_case", entity_id: created.id, action: `case.${kind}.created`, metadata: { folio: created.folio } });
      return noStore(NextResponse.json({ id: created.id, folio: created.folio }));
    }

    if (kind === "license") {
      const parsed = licenseInputSchema.safeParse(body);
      if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 }));
      const snap = await workerSnapshot(supabase, parsed.data.worker_id);
      const calc = calculateLicense({ withPay: parsed.data.with_pay, startISO: parsed.data.start_date, endISO: parsed.data.end_date });
      const created = await createUnionCase({
        delegation_id: depId,
        delegation_code: depCode,
        worker_id: parsed.data.worker_id,
        worker_snapshot: snap,
        case_type: "license",
      });
      await supabase.from("union_license_cases").insert({
        case_id: created.id,
        with_pay: parsed.data.with_pay,
        license_range_type: calc.rangeType,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        total_days: calc.totalDays,
        previous_license_start: parsed.data.previous_license_start || null,
        previous_license_end: parsed.data.previous_license_end || null,
        is_extension: parsed.data.is_extension ?? false,
        reason: parsed.data.reason,
        proof_description: parsed.data.proof_description ?? "",
        debt_control_required: parsed.data.debt_control_required ?? false,
        debt_certification_status: "pending",
        notes: parsed.data.notes ?? "",
        external_status: "pending",
      });
      await addCaseEvent(created.id, "prepared", "Solicitud generada", `${calc.rangeLabel}: ${calc.totalDays} días. Formato listo para revisión.`);
      await writeAuditLog({ delegation_id: depId, entity_type: "union_case", entity_id: created.id, action: "case.license.created", metadata: { folio: created.folio } });
      return noStore(NextResponse.json({ id: created.id, folio: created.folio, result: calc }));
    }

    return noStore(NextResponse.json({ error: "Tipo de trámite no soportado" }, { status: 400 }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    const status = message.includes("Sin acceso") || message.includes("autenticado") ? 403 : 500;
    return noStore(NextResponse.json({ error: "No se pudo crear el expediente" }, { status }));
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body: unknown = await req.json();
    const parsed = statusBody.safeParse(body);
    if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
    const supabase = await createClient();
    const { data: existing } = await supabase.from("union_cases").select("id, delegation_id, folio").eq("id", parsed.data.case_id).single();
    if (!existing) return noStore(NextResponse.json({ error: "No encontrado" }, { status: 404 }));
    await requireUnionMembership((existing as { delegation_id: string }).delegation_id);
    const patch: { status: string; updated_by: string; updated_at: string; closed_at?: string } = {
      status: parsed.data.status,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    };
    if (["completed", "cancelled", "archived"].includes(parsed.data.status)) patch.closed_at = new Date().toISOString();
    const { error } = await supabase.from("union_cases").update(patch).eq("id", parsed.data.case_id);
    if (error) throw error;
    await addCaseEvent(parsed.data.case_id, "status", `Estado: ${parsed.data.status}`, parsed.data.note || "Cambio registrado por representante.");
    await writeAuditLog({
      delegation_id: (existing as { delegation_id: string }).delegation_id,
      entity_type: "union_case",
      entity_id: parsed.data.case_id,
      action: "case.status.changed",
      metadata: { status: parsed.data.status },
    });
    return noStore(NextResponse.json({ ok: true }));
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 }));
  }
}
