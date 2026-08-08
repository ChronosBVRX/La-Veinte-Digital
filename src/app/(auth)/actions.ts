"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

type AuthState = { error?: string } | undefined

export async function signInAction(_prev: AuthState, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: "Credenciales incorrectas. Verifica tu correo y contraseña." }
  }

  revalidatePath("/")
  redirect("/")
}

export async function signUpAction(_prev: AuthState, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("full_name") as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) {
    return { error: "No se pudo crear la cuenta. Intenta con otro correo." }
  }

  revalidatePath("/")
  redirect("/")
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/login")
  redirect("/login")
}
