import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionMembership } from "@/features/representacion/services/permissions";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const moveSchema = z.object({
  from_locker_id: z.string().uuid("ID de origen inválido"),
  to_locker_id: z.string().uuid("ID de destino inválido"),
  move_reason: z.string().max(500).default("Reubicación de casillero"),
});

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const body = await req.json().catch(() => ({}));
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) {
    return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 400 }));
  }

  const supabase = await createClient();

  // Validar delegación del casillero origen
  const { data: fromLocker } = await supabase
    .from("union_lockers")
    .select("delegation_id")
    .eq("id", parsed.data.from_locker_id)
    .single();

  if (!fromLocker) {
    return noStore(NextResponse.json({ error: "Casillero origen no encontrado" }, { status: 404 }));
  }

  await requireUnionMembership(fromLocker.delegation_id);

  // Invocar RPC atómica transaccional
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase as any).rpc("union_move_locker_assignment", {
    p_from_locker_id: parsed.data.from_locker_id,
    p_to_locker_id: parsed.data.to_locker_id,
    p_move_reason: parsed.data.move_reason,
    p_moved_by: auth.user.id,
  });

  if (rpcError) {
    return noStore(NextResponse.json({ error: rpcError.message }, { status: 500 }));
  }

  if (rpcResult && !rpcResult.success) {
    return noStore(NextResponse.json({ error: rpcResult.error || "No se pudo reubicar el casillero" }, { status: 400 }));
  }

  return noStore(NextResponse.json({ success: true, ...rpcResult }));
}
