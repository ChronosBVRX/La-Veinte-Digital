// Permisos del módulo sindical — BETA PRIVADA.
// El acceso depende EXCLUSIVAMENTE de union_members (union_rep/union_admin).
// profiles.role='admin' NO otorga acceso a expedientes sindicales.
// Nunca confía en IDs del navegador sin verificar delegación en servidor.

import { createClient } from "@/lib/supabase/server";

export type UnionRole = "union_rep" | "union_admin";

export interface UnionMembership {
  delegation_id: string;
  delegation_code: string;
  role: UnionRole;
}

export async function getUnionMemberships(): Promise<UnionMembership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: rows } = await supabase
    .from("union_members")
    .select("delegation_id, role")
    .eq("user_id", user.id)
    .eq("active", true);
  if (!rows) return [];
  const depIds = [...new Set(rows.map((r) => r.delegation_id))];
  let codeById = new Map<string, string>();
  if (depIds.length > 0) {
    const { data: deps } = await supabase.from("union_delegations").select("id, code").in("id", depIds);
    codeById = new Map((deps ?? []).map((d) => [d.id, d.code]));
  }
  return rows.map((r: { delegation_id: string; role: string }) => {
    return {
      delegation_id: r.delegation_id,
      delegation_code: codeById.get(r.delegation_id) ?? "",
      role: (r.role === "union_admin" ? "union_admin" : "union_rep") as UnionRole,
    };
  });
}

export async function requireUnionMembership(delegationId?: string): Promise<UnionMembership[]> {
  const memberships = await getUnionMemberships();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  if (memberships.length === 0) throw new Error("Sin acceso a Representación Sindical");
  if (delegationId && !memberships.some((m) => m.delegation_id === delegationId)) {
    throw new Error("Sin acceso a esta delegación");
  }
  return delegationId ? memberships.filter((m) => m.delegation_id === delegationId) : memberships;
}

export async function requireUnionAdmin(delegationId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data } = await supabase
    .from("union_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("delegation_id", delegationId)
    .eq("role", "union_admin")
    .eq("active", true)
    .limit(1);
  if (!data || data.length === 0) throw new Error("Se requiere rol union_admin");
}

export async function getDefaultDelegationId(): Promise<string | null> {
  const memberships = await getUnionMemberships();
  if (memberships.length > 0) return memberships[0].delegation_id;
  return null;
}
