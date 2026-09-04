import type { SavedVacationSimulation, VacationSimulationInput, VacationSimulationResult } from "../domain/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { evaluateVacationRoleEligibility } from "../domain/role-eligibility";

export async function saveSimulation(
  supabase: SupabaseClient,
  input: VacationSimulationInput,
  result: VacationSimulationResult
): Promise<SavedVacationSimulation | { error: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Usuario no autenticado" };

    if (result.status === "BLOCKED") {
      return { error: "No se puede guardar una programación con opciones o roles bloqueados." };
    }

    if (input.selectedStartDate && input.dueDate) {
      const eligibility = evaluateVacationRoleEligibility({
        regime: input.regime,
        entitlementKind: input.regime === "EXTRAORDINARIO_V20" ? "V20" : "ORDINARY",
        dueDate: input.dueDate,
        roleStartDate: input.selectedStartDate,
        contractType: input.workerProfile?.contractType,
        contractEndDate: input.workerProfile?.contractEndDate,
      });

      if (eligibility.status === "BLOCKED") {
        return { error: `Rol bloqueado: ${eligibility.workerMessage}` };
      }
    }

    const { data, error } = await supabase.from("vacation_simulations").insert({
      user_id: user.id,
      calendar_id: input.calendarId,
      rule_version_id: result.ruleVersionId,
      input_snapshot: JSON.parse(JSON.stringify(input)),
      result_snapshot: JSON.parse(JSON.stringify(result)),
      status: "COMPLETED",
    }).select().single();

    if (error) return { error: error.message };

    return {
      id: data.id as string,
      userId: data.user_id as string,
      calendarId: data.calendar_id as string,
      ruleVersionId: data.rule_version_id as string,
      inputSnapshot: data.input_snapshot,
      resultSnapshot: data.result_snapshot,
      status: data.status as "DRAFT" | "COMPLETED" | "ARCHIVED",
      createdAt: data.created_at as string,
      updatedAt: data.updated_at as string,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export async function getMySimulations(supabase: SupabaseClient): Promise<SavedVacationSimulation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("vacation_simulations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return data.map((d) => ({
    id: d.id as string,
    userId: d.user_id as string,
    calendarId: d.calendar_id as string,
    ruleVersionId: d.rule_version_id as string,
    inputSnapshot: d.input_snapshot,
    resultSnapshot: d.result_snapshot,
    status: d.status as "DRAFT" | "COMPLETED" | "ARCHIVED",
    createdAt: d.created_at as string,
    updatedAt: d.updated_at as string,
  }));
}

export async function getSimulationById(supabase: SupabaseClient, id: string): Promise<SavedVacationSimulation | null> {
  const { data } = await supabase
    .from("vacation_simulations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    userId: data.user_id as string,
    calendarId: data.calendar_id as string,
    ruleVersionId: data.rule_version_id as string,
    inputSnapshot: data.input_snapshot,
    resultSnapshot: data.result_snapshot,
    status: data.status as "DRAFT" | "COMPLETED" | "ARCHIVED",
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export async function deleteSimulation(supabase: SupabaseClient, id: string): Promise<boolean> {
  const { error } = await supabase.from("vacation_simulations").delete().eq("id", id);
  return !error;
}
