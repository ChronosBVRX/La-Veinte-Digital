import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin } from "@/features/representacion/services/permissions";
import {
  hardDeleteLicenseCase,
  getLicenseCaseDetail,
} from "@/features/representacion/services/license-management";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const hardDeleteBodySchema = z.object({
  case_id: z.string().uuid(),
  confirmation_text: z.string(),
});

export async function DELETE(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const rawBody: unknown = await req.json();
    const parsed = hardDeleteBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return noStore(NextResponse.json({ error: "Parámetros inválidos", issues: parsed.error.issues }, { status: 400 }));
    }

    const detail = await getLicenseCaseDetail(parsed.data.case_id, { includeDeleted: true });

    // Exclusivo para administradores sindicales de la delegación
    await requireUnionAdmin(detail.delegationId);

    await hardDeleteLicenseCase(parsed.data.case_id, auth.user.id, parsed.data.confirmation_text);

    return noStore(NextResponse.json({ success: true, caseId: parsed.data.case_id }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar definitivamente";
    const status =
      message.includes("Se requiere rol union_admin") || message.includes("Sin acceso")
        ? 403
        : message.includes("Confirmación inválida")
          ? 400
          : message.includes("no encontrado")
            ? 404
            : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
