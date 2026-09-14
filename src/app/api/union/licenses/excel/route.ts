import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { buildLicenseExcel } from "@/features/representacion/services/license-excel";
import { addCaseEvent } from "@/features/representacion/services/cases";
import { rangeLabel, type LicenseRangeType } from "@/features/representacion/lib/licenses";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ case_id: z.string().uuid() });

function splitISO(iso: string): { d: string; m: string; y: string } {
  const [y, m, d] = (iso || "").split("-");
  return { d: d ?? "", m: m ?? "", y: y ?? "" };
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body: unknown = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "case_id inválido" }, { status: 400 });
    const supabase = await createClient();
    const { data: c } = await supabase
      .from("union_cases")
      .select("id, delegation_id, folio, opened_at, worker_id")
      .eq("id", parsed.data.case_id)
      .single();
    if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const header = c as {
      delegation_id: string;
      folio: string;
      opened_at: string;
      worker_id: string;
    };
    await requireUnionMembership(header.delegation_id);
    const { data: wData } = await supabase
      .from("union_workers")
      .select("first_name, paternal_surname, maternal_surname, employee_number, category, assignment, turn, schedule, rest_days")
      .eq("id", header.worker_id)
      .single();
    const w = ((wData ?? {}) as unknown) as Record<string, string>;
    const { data: detail } = await supabase.from("union_license_cases").select("*").eq("case_id", parsed.data.case_id).single();
    if (!detail) return NextResponse.json({ error: "Sin detalle de licencia" }, { status: 404 });
    const det = detail as {
      with_pay: boolean;
      license_range_type: LicenseRangeType;
      start_date: string;
      end_date: string;
      total_days: number;
      is_extension: boolean;
      reason: string;
      proof_description: string;
      debt_certification_status: string;
    };
    const s = splitISO(det.start_date);
    const e = splitISO(det.end_date);
    const opened = new Date(header.opened_at);
    const buf = await buildLicenseExcel({
      ooad: "MICHOACÁN",
      place: "LA GOLETA, CHARO, MICHOACÁN",
      folio: header.folio,
      elaborationDay: String(opened.getUTCDate()).padStart(2, "0"),
      elaborationMonth: String(opened.getUTCMonth() + 1).padStart(2, "0"),
      elaborationYear: String(opened.getUTCFullYear()),
      worker: {
        paternalSurname: w.paternal_surname ?? "",
        maternalSurname: w.maternal_surname ?? "",
        firstName: w.first_name ?? "",
        employeeNumber: w.employee_number ?? "",
        category: w.category ?? "",
        assignment: w.assignment ?? "HOSPITAL GENERAL REGIONAL No. 1",
        turn: w.turn ?? "",
        schedule: w.schedule ?? "",
        restDays: w.rest_days ?? "",
      },
      withPay: det.with_pay,
      rangeLabel: rangeLabel(det.license_range_type),
      startDay: s.d,
      startMonth: s.m,
      startYear: s.y,
      endDay: e.d,
      endMonth: e.m,
      endYear: e.y,
      totalDays: det.total_days,
      isExtension: det.is_extension,
      reason: det.reason,
      proof: det.proof_description,
      phone: "",
      debtStatus: det.debt_certification_status === "certified" ? "Certificado" : "Pendiente de certificación",
    });
    await addCaseEvent(parsed.data.case_id, "document", "Excel de licencia generado", "Clave 1A74-009-036. Formato listo para revisión.");
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="licencia-${header.folio}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el Excel" }, { status: 500 });
  }
}
