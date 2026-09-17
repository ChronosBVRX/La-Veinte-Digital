import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import {
  completeLicenseCase,
  getLicenseCaseDetail,
} from "@/features/representacion/services/license-management";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const completeBodySchema = z.object({
  case_id: z.string().uuid(),
  worker_id: z.string().uuid(),
  with_pay: z.boolean(),
  start_date: z.string().min(1, "Fecha de inicio requerida"),
  end_date: z.string().min(1, "Fecha de término requerida"),
  is_extension: z.boolean().optional(),
  previous_start_date: z.string().optional().nullable(),
  previous_end_date: z.string().optional().nullable(),
  reason: z.string().min(1, "El motivo es indispensable"),
  proof_description: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const rawBody: unknown = await req.json();
    const parsed = completeBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return noStore(NextResponse.json({ error: "Datos incompletos para finalizar", issues: parsed.error.issues }, { status: 400 }));
    }

    const data = parsed.data;
    // Resolver delegación desde el expediente
    const detail = await getLicenseCaseDetail(data.case_id);
    await requireUnionMembership(detail.delegationId);

    const result = await completeLicenseCase({
      caseId: data.case_id,
      userId: auth.user.id,
      workerId: data.worker_id,
      withPay: data.with_pay,
      startDate: data.start_date,
      endDate: data.end_date,
      isExtension: data.is_extension,
      previousStartDate: data.previous_start_date,
      previousEndDate: data.previous_end_date,
      reason: data.reason,
      proofDescription: data.proof_description,
      notes: data.notes,
    });

    return noStore(NextResponse.json(result));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al finalizar el trámite";
    const status = message.includes("Sin acceso") ? 403 : message.includes("indispensable") || message.includes("no tiene") ? 422 : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
