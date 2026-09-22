import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { createUnionPrintJob, getPrintQueueSummary } from "@/features/representacion/services/print-jobs";
import { getPrintableDocumentLabel } from "@/features/representacion/services/print-document-registry";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const createJobSchema = z.object({
  case_id: z.string().uuid(),
  copies: z.number().int().min(1).max(5).optional().default(1),
  duplex: z.boolean().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body: unknown = await req.json();
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "case_id inválido o cantidad de copias fuera de rango." }, { status: 400 });
    }

    const { job, station } = await createUnionPrintJob({
      caseId: parsed.data.case_id,
      userId: auth.user.id,
      copies: parsed.data.copies,
      duplex: parsed.data.duplex,
    });

    const docLabel = getPrintableDocumentLabel(job.document_type);

    return NextResponse.json({
      success: true,
      job,
      document: {
        type: job.document_type,
        label: docLabel,
      },
      station: {
        id: station.id,
        name: station.name,
        printer_name: station.printer_name,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear el trabajo de impresión.";
    let status = 500;
    if (message.includes("No hay ninguna estación") || message.includes("no cuenta con un documento PDF")) {
      status = 422;
    } else if (message.includes("no encontrado")) {
      status = 404;
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const delegationId = searchParams.get("delegation_id");

    const memberships = await requireUnionMembership(delegationId || undefined);
    const targetDelegationId = delegationId || memberships[0]?.delegation_id;

    if (!targetDelegationId) {
      return NextResponse.json({ error: "Delegación no especificada." }, { status: 400 });
    }

    const summary = await getPrintQueueSummary(targetDelegationId);
    return NextResponse.json({ success: true, ...summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al consultar la cola de impresión.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
