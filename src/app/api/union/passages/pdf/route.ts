import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { buildPassage026Pdf, buildPassage027Pdf } from "@/features/representacion/services/passage-pdf";
import {
  getActiveUnionDocumentTemplate,
  UnionTemplateError,
  type UnionDocumentTemplateKind,
} from "@/features/representacion/services/union-document-template-repository";
import { addCaseEvent } from "@/features/representacion/services/cases";
import { resolveUnionWorkerName } from "@/features/representacion/services/worker-name-resolver";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ case_id: z.string().uuid() });

type PassageRow = {
  concept: string;
  request_date: string;
  control_number: string | null;
  ooad: string;
  discontinuous_schedule: string;
  extramural_functions: string;
  transfer_period: string;
  worker_address: Record<string, string>;
  assignment_address: Record<string, string>;
  phone: string;
};

type WorkerRow = {
  first_name: string | null;
  paternal_surname: string | null;
  maternal_surname: string | null;
  siap_full_name: string | null;
  employee_number: string;
  category: string;
  assignment: string;
};

function splitISO(iso: string): { day: string; month: string; year: string } {
  const [y, m, d] = (iso || "").split("-");
  return { day: d ?? "", month: m ?? "", year: y ?? "" };
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
      .select("id, delegation_id, folio, case_type, worker_snapshot")
      .eq("id", parsed.data.case_id)
      .single();
    if (!c) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const typed = c as {
      delegation_id: string;
      folio: string;
      case_type: string;
      worker_snapshot?: Record<string, unknown> | null;
    };
    await requireUnionMembership(typed.delegation_id);
    const { data: detail } = await supabase.from("union_passage_cases").select("*").eq("case_id", parsed.data.case_id).single();
    if (!detail) return NextResponse.json({ error: "Sin detalle de pasaje" }, { status: 404 });
    const d = detail as PassageRow;
    const { data: w } = await supabase
      .from("union_cases")
      .select("union_workers(first_name, paternal_surname, maternal_surname, siap_full_name, employee_number, category, assignment)")
      .eq("id", parsed.data.case_id)
      .single();
    const worker = (((w as unknown as { union_workers: WorkerRow | WorkerRow[] } | null)?.union_workers ?? {}) as WorkerRow | WorkerRow[]);
    const wr: WorkerRow = Array.isArray(worker) ? worker[0] : (worker as WorkerRow);

    // Compatibilidad: preferencia snapshot con nombre resoluble -> fallback union_worker actual
    const snap = (typed.worker_snapshot ?? null) as Record<string, unknown> | null;
    const snapResolved = snap
      ? resolveUnionWorkerName({
          first_name: (snap.first_name as string | null) ?? null,
          paternal_surname: (snap.paternal_surname as string | null) ?? null,
          maternal_surname: (snap.maternal_surname as string | null) ?? null,
          siap_full_name: (snap.siap_full_name as string | null) ?? null,
        })
      : null;

    const wrResolved = resolveUnionWorkerName(wr);
    const resolvedName =
      snapResolved && snapResolved.paternalSurname && snapResolved.givenNames
        ? snapResolved
        : wrResolved;

    const employeeNumber =
      wr?.employee_number || (typeof snap?.employee_number === "string" ? snap.employee_number : "");
    const category =
      wr?.category || (typeof snap?.category === "string" ? snap.category : "");
    const assignment =
      wr?.assignment || (typeof snap?.assignment === "string" ? snap.assignment : "");

    const dt = splitISO(d.request_date);
    const control = d.control_number || "pendiente";

    // 1. Recuperar la plantilla oficial activa desde Supabase Storage
    const templateKind: UnionDocumentTemplateKind =
      d.concept === "026" ? "passage_026" : "passage_027";

    const template = await getActiveUnionDocumentTemplate({
      delegationId: typed.delegation_id,
      templateKind,
      supabase,
    });

    let pdf: Uint8Array;
    if (d.concept === "026") {
      pdf = await buildPassage026Pdf(
        {
          ooad: d.ooad,
          day: dt.day,
          month: dt.month,
          year: dt.year,
          controlNumber: control,
          worker: {
            paternalSurname: resolvedName.paternalSurname,
            maternalSurname: resolvedName.maternalSurname,
            firstName: resolvedName.givenNames,
            employeeNumber,
            category,
            assignment,
          },
          extramuralFunctions: d.extramural_functions,
          transferPeriod: d.transfer_period,
          folioLabel: typed.folio,
        },
        template.buffer,
      );
    } else {
      const addr = (a: Record<string, string>) => ({
        street: a.street ?? a.street ?? "",
        neighborhood: a.neighborhood ?? "",
        postalCode: a.postalCode ?? a.postal_code ?? "",
        municipality: a.municipality ?? "",
        state: a.state ?? "",
      });
      pdf = await buildPassage027Pdf(
        {
          ooad: d.ooad,
          day: dt.day,
          month: dt.month,
          year: dt.year,
          controlNumber: control,
          worker: {
            paternalSurname: resolvedName.paternalSurname,
            maternalSurname: resolvedName.maternalSurname,
            firstName: resolvedName.givenNames,
            employeeNumber,
            category,
            assignment,
          },
          discontinuousSchedule: d.discontinuous_schedule || "—",
          workerAddress: addr(d.worker_address ?? {}),
          assignmentAddress: addr(d.assignment_address ?? {}),
          phone: d.phone ?? "",
          folioLabel: typed.folio,
        },
        template.buffer,
      );
    }
    await addCaseEvent(parsed.data.case_id, "document", "PDF de pasaje generado", `Concepto 0${d.concept}. Formato oficial completado listo para revisión.`);
    const buf = Buffer.from(pdf);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pasaje-${d.concept}-${typed.folio}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    if (err instanceof UnionTemplateError) {
      if (err.code === "UNION_TEMPLATE_NOT_FOUND") {
        return NextResponse.json(
          { error: "No se encontró la plantilla oficial activa de este formato. Contacta al administrador sindical." },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "Error de integridad o descarga de la plantilla oficial. Contacta al administrador sindical." },
        { status: 500 },
      );
    }
    const msg = err instanceof Error ? err.message : "No se pudo generar el PDF";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
