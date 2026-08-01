"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signInAction(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)

  revalidatePath("/")
  redirect("/")
}

export async function signUpAction(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("full_name") as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw new Error(error.message)

  // El perfil lo crea el trigger handle_new_user (migración 006).
  // Este upsert solo complementa el nombre cuando el trigger aún no
  // registró el full_name, sin competir con él ni romper el flujo.
  if (data.user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: data.user.id, full_name: fullName }, { onConflict: "id" })
    if (profileError) {
      console.error("[signUp] perfil upsert:", profileError.message)
    }
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
