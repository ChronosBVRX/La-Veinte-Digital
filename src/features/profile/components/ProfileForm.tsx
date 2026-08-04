"use client"

import { useActionState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Input } from "@/shared/components/ui/Input"
import { SearchableSelect } from "@/shared/components/ui/SearchableSelect"
import type { SearchableOption } from "@/shared/components/ui/SearchableSelect"
import { Button } from "@/shared/components/ui/Button"
import type { EditableProfileFields } from "@/shared/contracts/profile"

interface Profile {
  id: string
  full_name: string | null
  matricula: string | null
  adscripcion: string | null
  categoria: string | null
  antiguedad: string | null
  phone: string | null
}

interface Props {
  profile: Profile | null
  categoriaOptions: SearchableOption[]
  adscripcionOptions: SearchableOption[]
}

const MATRICULA_RE = /^[A-Za-z0-9]{5,12}$/
const PHONE_RE = /^\+?[0-9]{8,15}$/

export function ProfileForm({ profile, categoriaOptions, adscripcionOptions }: Props) {
  const router = useRouter()

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) => {
      const supabase = createClient()

      const fullName = String(formData.get("full_name") ?? "").trim()
      const matricula = String(formData.get("matricula") ?? "").trim()
      const adscripcion = String(formData.get("adscripcion") ?? "").trim()
      const categoria = String(formData.get("categoria") ?? "").trim()
      const antiguedad = String(formData.get("antiguedad") ?? "").trim()
      const phone = String(formData.get("phone") ?? "").trim()

      if (!fullName) return { error: "El nombre completo es obligatorio" }
      if (matricula && !MATRICULA_RE.test(matricula)) {
        return { error: "Matrícula inválida: usa solo letras y números (5-12 caracteres)" }
      }
      if (phone && !PHONE_RE.test(phone)) {
        return { error: "Teléfono inválido: usa solo dígitos (8-15)" }
      }
      if (categoria && !categoriaOptions.some((o) => o.value === categoria)) {
        return { error: "Selecciona una categoría de la lista; el texto escrito no coincide con ninguna opción" }
      }
      if (adscripcion && !adscripcionOptions.some((o) => o.value === adscripcion)) {
        return { error: "Selecciona una adscripción de la lista; el texto escrito no coincide con ninguna opción" }
      }

      // Recupera o crea el perfil faltante (usuarios OAuth sin fila en profiles).
      const { error: ensureError } = await supabase.rpc("ensure_profile_exists")
      if (ensureError) {
        console.error("[ProfileForm] ensure_profile_exists:", ensureError.message)
        return { error: "No se pudo preparar tu perfil. Inténtalo de nuevo." }
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error("[ProfileForm] getUser:", userError.message)
        return { error: "No se pudo identificar tu usuario. Inténtalo de nuevo." }
      }
      const userId = userData.user?.id
      if (!userId) return { error: "No se pudo identificar tu usuario" }

      const editableUpdates: EditableProfileFields = {
        full_name: fullName,
        matricula,
        adscripcion,
        categoria,
        antiguedad,
        phone,
      }
      const { error } = await supabase
        .from("profiles")
        .update(editableUpdates)
        .eq("id", userId)

      if (error) {
        console.error("[ProfileForm] update:", error.message)
        return { error: "No se pudo guardar tu perfil. Inténtalo de nuevo." }
      }
      router.refresh()
      return { success: true }
    },
    undefined
  )

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {state?.error && (
        <p role="alert" style={{ color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "0.5rem", borderRadius: "0.375rem" }}>
          {state.error}
        </p>
      )}
      {state?.success && (
        <p style={{ color: "#16a34a", fontSize: "0.875rem", background: "#f0fdf4", padding: "0.5rem", borderRadius: "0.375rem" }}>
          Perfil actualizado
        </p>
      )}
      <Input label="Nombre completo" name="full_name" defaultValue={profile?.full_name ?? ""} required />
      <Input label="Matrícula" name="matricula" defaultValue={profile?.matricula ?? ""} />
      <SearchableSelect label="Adscripción" name="adscripcion" defaultValue={profile?.adscripcion} options={adscripcionOptions} />
      <SearchableSelect label="Categoría" name="categoria" defaultValue={profile?.categoria} options={categoriaOptions} />
      <Input label="Antigüedad" name="antiguedad" defaultValue={profile?.antiguedad ?? ""} />
      <Input label="Teléfono" name="phone" defaultValue={profile?.phone ?? ""} type="tel" />
      <Button type="submit" loading={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  )
}
