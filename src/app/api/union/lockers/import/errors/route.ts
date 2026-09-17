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
    const batchId = url.searchParams.get("batch_id");
    let delegationId = url.searchParams.get("delegation_id");

    if (!batchId) {
      return noStore(
        NextResponse.json({ error: "Falta el identificador del lote (batch_id)." }, { status: 400 })
      );
    }

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
    const { data: rows, error } = await supabase
      .from("union_worker_import_rows")
      .select("row_number, matricula, full_name, row_status, action_taken, issues, diff")
      .eq("batch_id", batchId)
      .in("row_status", ["invalid", "conflict", "warning"])
      .order("row_number", { ascending: true })
      .limit(100);

    if (error) {
      throw error;
    }

    return noStore(NextResponse.json({ errors: rows ?? [] }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener errores de importación.";
    const status =
      message.includes("union_admin") || message.includes("autenticado") || message.includes("acceso")
        ? 403
        : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
