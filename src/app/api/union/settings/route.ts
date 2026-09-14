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

const settingsSchema = z.object({
  delegation_id: z.string().uuid(),
  delegation_display_name: z.string().max(120).optional(),
  center_name: z.string().max(120).optional(),
  center_address: z.string().max(200).optional(),
  default_recipient_name: z.string().max(160).optional(),
  default_recipient_role: z.string().max(160).optional(),
  general_secretary: z.string().max(160).optional(),
  interior_secretary: z.string().max(160).optional(),
  conflicts_secretary: z.string().max(160).optional(),
  admission_secretary: z.string().max(160).optional(),
  social_welfare_secretary: z.string().max(160).optional(),
  default_signer_name: z.string().max(160).optional(),
  default_signer_role: z.string().max(160).optional(),
  institutional_motto: z.string().max(200).optional(),
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
    const { data } = await supabase.from("union_settings").select("*").eq("delegation_id", depId).single();
    const { data: delegation } = await supabase.from("union_delegations").select("code, name, section, facility").eq("id", depId).single();
    return noStore(NextResponse.json({ settings: data, delegation }));
  } catch {
    return noStore(NextResponse.json({ error: "No se pudo consultar configuración" }, { status: 500 }));
  }
}

export async function PUT(req: Request): Promise<NextResponse> {
  const auth = await requireUser();
  if (auth.response) return auth.response;
  try {
    const body: unknown = await req.json();
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) return noStore(NextResponse.json({ error: "Datos inválidos" }, { status: 400 }));
    await requireUnionAdmin(parsed.data.delegation_id);
    const supabase = await createClient();
    const { delegation_id: depId, ...fields } = parsed.data;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === "string") clean[k] = v.trim();
    }
    const { error } = await supabase
      .from("union_settings")
      .update({ ...clean, updated_by: auth.user.id, updated_at: new Date().toISOString() })
      .eq("delegation_id", depId);
    if (error) throw error;
    await writeAuditLog({ delegation_id: depId, entity_type: "union_settings", entity_id: depId, action: "settings.updated", metadata: {} });
    return noStore(NextResponse.json({ ok: true }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    const status = message.includes("union_admin") ? 403 : 500;
    return noStore(NextResponse.json({ error: "No se pudo guardar configuración" }, { status: status }));
  }
}
