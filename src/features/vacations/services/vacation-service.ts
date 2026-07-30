import type { SavedVacationSimulation, VacationSimulationInput, VacationSimulationResult, AnnualVacationCalendar } from "../domain/types";

export async function saveSimulation(
  supabase: any,
  input: VacationSimulationInput,
  result: VacationSimulationResult
): Promise<SavedVacationSimulation | { error: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Usuario no autenticado" };

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
      id: data.id,
      userId: data.user_id,
      calendarId: data.calendar_id,
      ruleVersionId: data.rule_version_id,
      inputSnapshot: data.input_snapshot,
      resultSnapshot: data.result_snapshot,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function getMySimulations(supabase: any): Promise<SavedVacationSimulation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("vacation_simulations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!data) return [];

  return data.map((d: any) => ({
    id: d.id,
    userId: d.user_id,
    calendarId: d.calendar_id,
    ruleVersionId: d.rule_version_id,
    inputSnapshot: d.input_snapshot,
    resultSnapshot: d.result_snapshot,
    status: d.status,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export async function getSimulationById(supabase: any, id: string): Promise<SavedVacationSimulation | null> {
  const { data } = await supabase
    .from("vacation_simulations")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    calendarId: data.calendar_id,
    ruleVersionId: data.rule_version_id,
    inputSnapshot: data.input_snapshot,
    resultSnapshot: data.result_snapshot,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteSimulation(supabase: any, id: string): Promise<boolean> {
  const { error } = await supabase.from("vacation_simulations").delete().eq("id", id);
  return !error;
}
