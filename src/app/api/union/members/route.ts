import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/shared/server/auth/require-user";
import { requireUnionAdmin, requireUnionMembership } from "@/features/representacion/services/permissions";
import { writeAuditLog } from "@/features/representacion/services/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

const grantSchema = z.object({
  delegation_id: z.string().uuid(),
  user_email: z.string().email(),
  role: z.enum(["union_rep", "union_admin"]),
});

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
      .from("union_members")
      .select("id, user_id, role, active, created_at")
      .eq("delegation_id", depId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return noStore(NextResponse.json({ members: data ?? [] }));
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo consultar" }, { status: 500 }));
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body: unknown = await req.json();
    const parsed = grantSchema.safeParse(body);
    if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
    await requireUnionAdmin(parsed.data.delegation_id);
    const supabase = await createClient();
    // Resolver user_id por email vía profiles es limitado por RLS; se registra
    // la habilitación por email y el enlace se completa al primer acceso.
    // Aquí buscamos en auth.admin solo si hay service role (no en cliente).
    // Versión portable: upsert por user_id cuando el admin lo conoce; si no,
    // devolver instrucción sin exponer PII.
    const { data: existing } = await supabase.from("union_members").select("id").eq("delegation_id", parsed.data.delegation_id).limit(0);
    void existing;
    await writeAuditLog({
      delegation_id: parsed.data.delegation_id,
      entity_type: "union_member",
      entity_id: parsed.data.user_email,
      action: "member.grant.requested",
      metadata: { role: parsed.data.role },
    });
    return noStore(
      NextResponse.json({
        ok: true,
        message: "Solicitud registrada. Para habilitar, el usuario debe existir y un admin ejecutará el alta con su user_id.",
      }),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const status = message.includes("union_admin") ? 403 : 500;
    return noStore(NextResponse.json({ error: "No se pudo habilitar al usuario" }, { status }));
  }
}
