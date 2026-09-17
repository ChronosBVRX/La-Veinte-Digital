import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import {
  restoreLicenseCase,
  getLicenseCaseDetail,
} from "@/features/representacion/services/license-management";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const restoreBodySchema = z.object({
  case_id: z.string().uuid(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const rawBody: unknown = await req.json();
    const parsed = restoreBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return noStore(NextResponse.json({ error: "case_id requerido" }, { status: 400 }));
    }

    const detail = await getLicenseCaseDetail(parsed.data.case_id, { includeDeleted: true });
    await requireUnionMembership(detail.delegationId);

    const result = await restoreLicenseCase(parsed.data.case_id, auth.user.id);

    return noStore(NextResponse.json({ success: true, caseId: parsed.data.case_id, ...result }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al restaurar el expediente";
    const status = message.includes("Sin acceso") ? 403 : message.includes("no encontrado") ? 404 : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
