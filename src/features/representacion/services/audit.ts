// Auditoría sanitizada: nunca guarda contraseñas, domicilios completos,
// teléfonos, matrículas completas ni motivos médicos.

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export function sanitizeAuditMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const redactedKeys = new Set([
    "password",
    "pass",
    "token",
    "phone",
    "telefono",
    "address",
    "domicilio",
    "diagnosis",
    "diagnostico",
    "motivo_detalle",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (redactedKeys.has(k.toLowerCase())) {
      out[k] = "[redactado]";
      continue;
    }
    if (k === "employee_number" && typeof v === "string" && v.length > 4) {
      out[k] = `***${v.slice(-4)}`;
      continue;
    }
    if (typeof v === "string" && v.length > 500) {
      out[k] = `${v.slice(0, 500)}…`;
      continue;
    }
    out[k] = v;
  }
  return out;
}

export async function writeAuditLog(params: {
  delegation_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("union_audit_log").insert({
    delegation_id: params.delegation_id,
    user_id: user?.id ?? null,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action: params.action,
    metadata: sanitizeAuditMetadata(params.metadata ?? {}) as unknown as Json,
  });
}
