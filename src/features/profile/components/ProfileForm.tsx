"use client"

import { useActionState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { FormField } from "@/shared/components/ui/FormField"
import { Alert } from "@/shared/components/ui/Alert"
import type { EditableProfileFields } from "@/shared/contracts/profile"

interface Profile {
  id: string
  full_name: string | null
  phone: string | null
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

      const editableUpdates: EditableProfileFields = { full_name: fullName, phone }
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
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {state?.error && (
        <Alert variant="error" title="No se pudo guardar">
          {state.error}
        </Alert>
      )}
      {state?.success && (
        <Alert variant="success" title="Perfil actualizado">
          Tus datos se guardaron correctamente.
        </Alert>
      )}

      <form action={formAction}>
        <div className="profile-form-grid" style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-5)",
        }}>
          <FormField label="Nombre completo" htmlFor="full_name" required>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile?.full_name ?? ""}
              required
            />
          </FormField>

          <FormField label="Teléfono" htmlFor="phone" hint="Opcional. Solo dígitos (8-15)">
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={profile?.phone ?? ""}
              inputMode="numeric"
            />
          </FormField>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Button type="submit" loading={pending}>
            {pending ? "Guardando cambios" : "Guardar cambios"}
          </Button>
        </div>
      </form>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "var(--space-5)" }}>
        <Link
          href="/profile/mi-informacion-laboral"
          style={{
            color: "var(--primary)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "var(--text-sm)",
          }}
        >
          Administrar mi información laboral →
        </Link>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .profile-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
