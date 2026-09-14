// Helpers de casos: folio atómico + snapshot + eventos. Servidor únicamente.

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { casePrefix, type UnionCaseType } from "@/features/representacion/lib/folio";

export async function createUnionCase(params: {
  delegation_id: string;
  delegation_code: string;
  worker_id: string;
  worker_snapshot: Record<string, unknown>;
  case_type: UnionCaseType;
}): Promise<{ id: string; folio: string }> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const { data: folio, error: folioError } = await supabase.rpc("union_next_folio", {
    p_delegation_code: params.delegation_code,
    p_year: year,
    p_prefix: casePrefix(params.case_type),
  });
  if (folioError || !folio) throw new Error("No se pudo generar el folio interno.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("union_cases")
    .insert({
      delegation_id: params.delegation_id,
      worker_id: params.worker_id,
      case_type: params.case_type,
      folio: folio as string,
      status: "draft",
      worker_snapshot: params.worker_snapshot as unknown as Json,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    })
    .select("id, folio")
    .single();
  if (error || !data) throw new Error("No se pudo crear el expediente.");
  await supabase.from("union_case_events").insert({
    case_id: data.id,
    event_type: "created",
    title: "Expediente creado",
    detail: `Folio interno ${data.folio}. Formato listo para revisión.`,
    created_by: user?.id ?? null,
  });
  return { id: data.id as string, folio: data.folio as string };
}

export async function addCaseEvent(caseId: string, eventType: string, title: string, detail = ""): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("union_case_events").insert({
    case_id: caseId,
    event_type: eventType,
    title,
    detail,
    created_by: user?.id ?? null,
  });
}
