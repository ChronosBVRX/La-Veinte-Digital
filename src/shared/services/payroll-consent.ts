import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import type { Json } from "@/lib/supabase/types"
import type { EmployeePayrollProfile } from "@/features/nomina/lib/types"

export interface PayrollConsentDeps {
  client: Pick<SupabaseClient, "from" | "auth" | "rpc">
  user: { id: string }
}

async function resolveContext(deps?: PayrollConsentDeps): Promise<{ client: PayrollConsentDeps["client"]; userId: string }> {
  if (deps) return { client: deps.client, userId: deps.user.id }
  const client = createClient()
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error("Sesión no disponible para registrar consentimiento.")
  return { client, userId: data.user.id }
}

export async function fetchPayrollConsent(deps?: PayrollConsentDeps): Promise<boolean> {
  const { client, userId } = await resolveContext(deps)
  const { data, error } = await client
    .from("payroll_contexts")
    .select("consent_given")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error
  return data?.consent_given === true
}

export async function grantPayrollConsent(deps?: PayrollConsentDeps): Promise<void> {
  const { client, userId } = await resolveContext(deps)
  const { error } = await client
    .from("payroll_contexts")
    .upsert({
      user_id: userId,
      consent_given: true,
      consent_given_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) throw error
}

/**
 * Sincroniza el perfil de nómina al servidor (payroll_contexts), la fuente de
 * verdad remota del prerrelleno normativo. Evita la doble fuente de verdad:
 * cada actualización local se replica para que el servidor quede al día.
 */
export async function savePayrollProfileRemote(profile: EmployeePayrollProfile, deps?: PayrollConsentDeps): Promise<void> {
  const { client, userId } = await resolveContext(deps)
  const { error } = await client
    .from("payroll_contexts")
    .upsert({
      user_id: userId,
      consent_given: true,
      consent_given_at: new Date().toISOString(),
      category_id: profile.categoryId ?? null,
      category_code: profile.categoryCode ?? null,
      category_name: profile.categoryName ?? null,
      workday_hours: profile.workdayHours,
      employment_type: profile.employmentType,
      effective_seniority_date: profile.effectiveSeniorityDate ?? null,
      occupational_conditions: (profile.occupationalConditions ?? []) as unknown as Json,
      payroll_facts: (profile.facts ?? []) as unknown as Json,
      recurring_concepts: (profile.recurringConcepts ?? []) as unknown as Json,
      siap_concept_marks: (profile.siapConceptMarks ?? []) as unknown as Json,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) throw error
}

export async function revokePayrollConsent(deps?: PayrollConsentDeps): Promise<void> {
  const { client, userId } = await resolveContext(deps)
  const { error } = await client
    .from("payroll_contexts")
    .update({ consent_given: false, consent_given_at: null })
    .eq("user_id", userId)

  if (error) throw error
}

/**
 * Borra tarjetones y contexto de nómina en una sola transacción remota
 * (RPC `erase_user_payroll_data`): sin borrado parcial si una request falla.
 */
export async function deletePayrollDataRemote(deps?: PayrollConsentDeps): Promise<void> {
  const { client } = await resolveContext(deps)
  const { error } = await client.rpc("erase_user_payroll_data")
  if (error) throw error
}
