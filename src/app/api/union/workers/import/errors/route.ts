import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin, getUnionMemberships } from "@/features/representacion/services/permissions";
import { maskRfc, maskCurp, maskNss } from "@/features/representacion/services/worker-importer/row-parser";

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
      .select("id, row_number, matricula, full_name, row_status, action_taken, issues, diff, parsed_data")
      .eq("batch_id", batchId)
      .in("row_status", ["conflict", "invalid", "warning"])
      .order("row_number", { ascending: true })
      .limit(500);

    if (error) {
      throw error;
    }

    // Mask PII before returning to client
    const sanitizedRows = (rows ?? []).map((r) => {
      const parsed = (r.parsed_data ?? {}) as Record<string, unknown>;
      return {
        id: r.id,
        row_number: r.row_number,
        matricula: r.matricula,
        full_name: r.full_name,
        row_status: r.row_status,
        action_taken: r.action_taken,
        issues: r.issues,
        diff: r.diff,
        masked_rfc: maskRfc(String(parsed.rfc ?? "")),
        masked_curp: maskCurp(String(parsed.curp ?? "")),
        masked_nss: maskNss(String(parsed.nss ?? "")),
      };
    });

    return noStore(NextResponse.json({ error_rows: sanitizedRows }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al obtener errores de importación.";
    const status = message.includes("union_admin") || message.includes("autenticado") || message.includes("acceso")
      ? 403
      : 500;
    return noStore(NextResponse.json({ error: message }, { status }));
  }
}
