"use client"

import { useActionState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import type { EditableProfileFields } from "@/shared/contracts/profile"

interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  matricula?: string | null
  adscripcion?: string | null
}

interface Props {
  profile: Profile | null
}

const PHONE_RE = /^\+?[0-9]{8,15}$/

export function ProfileForm({ profile }: Props) {
  const router = useRouter()

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) => {
      const supabase = createClient()
      const fullName = String(formData.get("full_name") ?? "").trim()
      const phone = String(formData.get("phone") ?? "").trim()
      const matricula = String(formData.get("matricula") ?? "").trim().toUpperCase().replace(/\s+/g, "")
      const adscripcion = String(formData.get("adscripcion") ?? "").trim()

      if (!fullName) return { error: "El nombre completo es obligatorio" }
      if (phone && !PHONE_RE.test(phone)) {
        return { error: "Teléfono inválido: usa solo dígitos (8-15)" }
      }

      const { error: ensureError } = await supabase.rpc("ensure_profile_exists")
      if (ensureError) {
        console.error("[ProfileForm] ensure_profile_exists:", ensureError.message)
        return { error: "No se pudo preparar tu perfil. Inténtalo de nuevo." }
      }

      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user?.id) {
        return { error: "No se pudo identificar tu usuario." }
      }
      const userId = userData.user.id

      const editableUpdates: EditableProfileFields = {
        full_name: fullName,
        phone: phone || null,
        matricula: matricula || null,
        adscripcion: adscripcion || null,
      }
      const { error } = await supabase.from("profiles").update(editableUpdates).eq("id", userId)
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
          <Input label="Matrícula IMSS" name="matricula" defaultValue={profile?.matricula ?? ""} placeholder="Ej. 12345678" maxLength={32} />
          <Input label="Adscripción" name="adscripcion" defaultValue={profile?.adscripcion ?? ""} placeholder="Ej. HGZ 32, UMF 1" maxLength={200} />
        </div>
        <Input label="Teléfono" name="phone" defaultValue={profile?.phone ?? ""} type="tel" />
        <Button type="submit" loading={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
        <Link href="/profile/mi-informacion-laboral" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}>
          Administrar mi información laboral →
        </Link>
      </div>
    </div>
  )
}
