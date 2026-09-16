import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin, getUnionMemberships } from "@/features/representacion/services/permissions";
import { applyMasterImportBatch } from "@/features/representacion/services/worker-importer/batch-executor";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const body = (await req.json()) as {
      batch_id?: string;
      delegation_id?: string;
      resolutions?: Record<string, unknown>;
    };
    const batchId = body.batch_id;
    let delegationId = body.delegation_id;
    const resolutions = body.resolutions ?? {};

    if (!batchId) {
      return noStore(
        NextResponse.json({ error: "Falta el identificador del lote (batch_id)." }, { status: 400 })
      );
    }

    if (!delegationId) {
      const memberships = await getUnionMemberships();
      const adminMembership = memberships.find((m) => m.role === "union_admin");
      delegationId = adminMembership?.delegation_id;
    }

    if (!delegationId) {
      return noStore(
        NextResponse.json({ error: "No se identificó la delegación sindical." }, { status: 400 })
      );
    }

    await requireUnionAdmin(delegationId);

    const result = await applyMasterImportBatch({
      batchId,
      delegationId,
      userId: auth.user.id,
      resolutions,
    });

    return noStore(NextResponse.json(result));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al aplicar la importación.";
    const status =
      message.includes("union_admin") || message.includes("autenticado") || message.includes("acceso")
        ? 403
        : 400;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
