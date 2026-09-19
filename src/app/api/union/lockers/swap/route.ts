import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership, requireUnionAdmin } from "@/features/representacion/services/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const swapSchema = z.object({
  locker_a_id: z.string().uuid("ID de locker A inválido"),
  locker_b_id: z.string().uuid("ID de locker B inválido"),
  swap_reason: z.string().max(500).default("Intercambio mutuo de casilleros"),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = swapSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 }));
  }

  const supabase = await createClient();

  const { data: lockerA } = await supabase
    .from("union_lockers")
    .select("delegation_id")
    .eq("id", parsed.data.locker_a_id)
    .single();

  if (!lockerA) {
    return noStore(NextResponse.json({ error: "Casillero A no encontrado" }, { status: 404 }));
  }

  await requireUnionMembership(lockerA.delegation_id);
  await requireUnionAdmin(lockerA.delegation_id);

  // Invocar RPC atómica de intercambio
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("union_swap_locker_assignments", {
    p_locker_a_id: parsed.data.locker_a_id,
    p_locker_b_id: parsed.data.locker_b_id,
    p_swap_reason: parsed.data.swap_reason,
    p_swapped_by: auth.user.id,
  });

  if (rpcError) {
    return noStore(NextResponse.json({ error: rpcError.message }, { status: 500 }));
  }

  if (rpcResult && !rpcResult.success) {
    return noStore(NextResponse.json({ error: rpcResult.error || "No se pudo intercambiar casilleros" }, { status: 400 }));
  }

  return noStore(NextResponse.json({ success: true, ...rpcResult }));
}
