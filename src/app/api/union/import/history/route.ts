import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership, getUnionMemberships } from "@/features/representacion/services/permissions";
import { getMasterImportHistory } from "@/features/representacion/services/worker-importer/batch-executor";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    let delegationId = searchParams.get("delegation_id");

    if (!delegationId) {
      const memberships = await getUnionMemberships();
      delegationId = memberships[0]?.delegation_id ?? null;
    }

    if (!delegationId) {
      return noStore(
        NextResponse.json({ error: "No se identificó la delegación sindical." }, { status: 400 })
      );
    }

    await requireUnionMembership(delegationId);

    const history = await getMasterImportHistory(delegationId);
    return noStore(NextResponse.json({ history }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener historial.";
    const status =
      message.includes("autenticado") || message.includes("acceso") ? 403 : 400;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
