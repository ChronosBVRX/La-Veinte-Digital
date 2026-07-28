import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createBrowserClient } from "@/lib/supabase/client"

export async function signUp(email: string, password: string, fullName: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error

  if (data.user) {
    await supabase.from("profiles").insert({
      id: data.user.id,
      full_name: fullName,
    })
  }

  return data
}

export async function signIn(email: string, password: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
}

export async function getSession() {
  const supabase = await createServerClient()
  return supabase.auth.getSession()
}

export async function getUser() {
  const supabase = await createServerClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

export function getBrowserSession() {
  const supabase = createBrowserClient()
  return supabase.auth.getSession()
}

export function signInWithPassword(email: string, password: string) {
  const supabase = createBrowserClient()
  return supabase.auth.signInWithPassword({ email, password })
}
