"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export type DeleteAccountState = { error?: string; success?: boolean } | undefined

/**
 * Deletes the current account irreversibly.
 *
 * SECURITY: the request carries NO user id. The `delete_my_account()` RPC derives the target user
 * from the authenticated session (`auth.uid()`), so a client can never delete someone else's account
 * by tampering with a body field. After the RPC succeeds the auth user no longer exists, so we sign
 * out locally and the proxy redirects to the login screen.
 */
export async function deleteAccountAction(
  _prevState: DeleteAccountState,
  _formData: FormData,
): Promise<DeleteAccountState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const { error } = await supabase.rpc("delete_my_account")

  if (error) {
    // The RPC can fail if data removal was blocked (e.g. a transient FK/network issue). Never
    // claim success. The user keeps their session so they can retry.
    return { error: "No se pudo eliminar la cuenta. Intenta de nuevo en unos minutos." }
  }

  // User no longer exists server-side. Clear the local session so the proxy stops treating this
  // browser as authenticated.
  await supabase.auth.signOut()
  redirect("/login")
}
