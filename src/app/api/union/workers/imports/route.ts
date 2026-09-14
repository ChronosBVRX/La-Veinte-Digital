import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin, getUnionMemberships } from "@/features/representacion/services/permissions";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  try {
    const url = new URL(req.url);
    let delegationId = url.searchParams.get("delegation_id");

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

    const supabase = await createClient();
    const { data: batches, error } = await supabase
      .from("union_worker_import_batches")
      .select("*")
      .eq("delegation_id", delegationId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      throw error;
    }

    return noStore(NextResponse.json({ batches: batches ?? [] }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener historial de importaciones.";
    const status = message.includes("union_admin") || message.includes("autenticado") || message.includes("acceso")
      ? 403
      : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
