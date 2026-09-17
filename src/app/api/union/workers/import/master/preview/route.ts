import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin, getUnionMemberships } from "@/features/representacion/services/permissions";
import { parseAndPreviewMasterImport } from "@/features/representacion/services/worker-importer/batch-executor";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    let delegationId = formData.get("delegation_id") as string | null;

    if (!delegationId) {
      const memberships = await getUnionMemberships();
      const adminMembership = memberships.find((m) => m.role === "union_admin");
      delegationId = adminMembership?.delegation_id ?? null;
    }

    if (!delegationId) {
      return noStore(
        NextResponse.json({ error: "No se identificó la delegación sindical." }, { status: 400 })
      );
    }

    await requireUnionAdmin(delegationId);

    if (!file) {
      return noStore(
        NextResponse.json({ error: "No se proporcionó ningún archivo para procesar." }, { status: 400 })
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const preview = await parseAndPreviewMasterImport({
      fileBuffer: buffer,
      fileName: file.name,
      delegationId,
      userId: auth.user.id,
    });

    return noStore(NextResponse.json(preview));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar el archivo.";
    const status = message.includes("union_admin") || message.includes("autenticado") || message.includes("acceso")
      ? 403
      : 400;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
