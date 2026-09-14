import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export async function GET(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const url = new URL(req.url);
  try {
    const delegationId = url.searchParams.get("delegation_id");
    const memberships = await requireUnionMembership(delegationId ?? undefined);
    const depId = delegationId ?? memberships[0]?.delegation_id;
    if (!depId) return noStore(NextResponse.json({ error: "Sin delegación" }, { status: 403 }));
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("union_audit_log")
      .select("id, entity_type, entity_id, action, metadata, created_at")
      .eq("delegation_id", depId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return noStore(NextResponse.json({ events: data ?? [] }));
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo consultar auditoría" }, { status: 500 }));
  }
}
