import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

export interface PayrollConsentDeps {
  client: Pick<SupabaseClient, "from" | "auth">
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

export async function revokePayrollConsent(deps?: PayrollConsentDeps): Promise<void> {
  const { client, userId } = await resolveContext(deps)
  const { error } = await client
    .from("payroll_contexts")
    .update({ consent_given: false, consent_given_at: null })
    .eq("user_id", userId)

  if (error) throw error
}

export async function deletePayrollDataRemote(deps?: PayrollConsentDeps): Promise<void> {
  const { client, userId } = await resolveContext(deps)
  const { error } = await client
    .from("imported_payslips")
    .delete()
    .eq("user_id", userId)

  if (error) throw error

  const { error: ctxError } = await client
    .from("payroll_contexts")
    .delete()
    .eq("user_id", userId)

  if (ctxError) throw ctxError
}
