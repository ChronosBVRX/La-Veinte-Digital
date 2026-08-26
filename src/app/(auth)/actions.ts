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

export async function resetPasswordRequestAction(
  _prev: { error?: string; success?: boolean; message?: string } | undefined,
  formData: FormData
) {
  const supabase = await createClient()
  const email = (formData.get("email") as string)?.trim()

  if (!email) {
    return { error: "Ingresa tu correo electrónico." }
  }

  const { headers } = await import("next/headers")
  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") || headersList.get("host") || "localhost:3000"
  const proto = headersList.get("x-forwarded-proto") || "http"
  const origin = `${proto}://${host}`

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/callback?next=/restablecer-password`,
  })

  if (error) {
    return { error: "No pudimos enviar el enlace. Verifica que el correo sea correcto." }
  }

  return {
    success: true,
    message: "Te hemos enviado un correo con las instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.",
  }
}

export async function updatePasswordAction(
  _prev: { error?: string; success?: boolean } | undefined,
  formData: FormData
) {
  const supabase = await createClient()
  const password = formData.get("password") as string
  const confirmPassword = formData.get("confirm_password") as string

  if (!password || password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." }
  }

  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: "No se pudo actualizar la contraseña. El enlace puede haber expirado o ser inválido." }
  }

  revalidatePath("/")
  return { success: true }
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/login")
  redirect("/login")
}
