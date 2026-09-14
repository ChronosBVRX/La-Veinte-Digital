import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { buildLicenseLetterDocxDirect } from "@/features/representacion/services/license-word";
import { addCaseEvent } from "@/features/representacion/services/cases";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ case_id: z.string().uuid() });

const MONTHS_ES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

function fmtLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} DE ${MONTHS_ES[(m ?? 1) - 1]} DEL ${y}`;
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
      .select("first_name, paternal_surname, maternal_surname, employee_number, category, turn, rest_days")
      .eq("id", header.worker_id)
      .single();
    const w = ((wData ?? {}) as unknown) as Record<string, string>;
    const { data: detail } = await supabase.from("union_license_cases").select("*").eq("case_id", parsed.data.case_id).single();
    if (!detail) return NextResponse.json({ error: "Sin detalle de licencia" }, { status: 404 });
    const det = detail as { with_pay: boolean; start_date: string; end_date: string; total_days: number; reason: string };
    const { data: settings } = await supabase.from("union_settings").select("*").eq("delegation_id", header.delegation_id).single();
    const st = ((settings ?? {}) as unknown) as Record<string, string>;
    const opened = new Date(header.opened_at);
    const placeDate = `Charo, Michoacán a ${opened.getUTCDate()} DE ${MONTHS_ES[opened.getUTCMonth()]} del ${opened.getUTCFullYear()}`;
    const buf = buildLicenseLetterDocxDirect({
      section: "SECCIÓN XX MICHOACÁN",
      placeDate,
      recipientName: st.default_recipient_name || "C. Jefe de Personal H.G.R. No. 1",
      recipientRole: st.default_recipient_role || "Jefe de Personal H.G.R. No. 1",
      payKindLabel: det.with_pay ? "CON GOCE" : "SIN GOCE",
      workerFullName: `${w.paternal_surname ?? ""} ${w.maternal_surname ?? ""} ${w.first_name ?? ""}`.trim(),
      employeeNumber: w.employee_number ?? "",
      category: w.category ?? "",
      reason: det.reason || "—",
      periodLabel: `DEL ${fmtLong(det.start_date)} AL ${fmtLong(det.end_date)}`,
      turn: w.turn ?? "",
      restDays: w.rest_days ?? "",
      totalDays: det.total_days,
      committeeName: st.delegation_display_name || "COMITÉ DELEGACIONAL XXI",
      motto: st.institutional_motto || "Seguridad Social y Bienestar Económico de los Trabajadores",
      signerName: st.default_signer_name || "_______________________________________________",
      signerRole: st.default_signer_role || "Secretario del Interior XXI",
    });
    await addCaseEvent(parsed.data.case_id, "document", "Oficio Word generado", "Comité Delegacional XXI. Formato listo para revisión y firma.");
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="oficio-licencia-${header.folio}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el Word" }, { status: 500 });
  }
}
