"use client"

import { useActionState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"

interface Profile {
  id: string
  full_name: string | null
  matricula: string | null
  adscripcion: string | null
  categoria: string | null
  antiguedad: string | null
  phone: string | null
}

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const router = useRouter()

  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) => {
      if (!profile?.id) return { error: "Perfil no encontrado" }
      const supabase = createClient()
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.get("full_name") as string,
          matricula: formData.get("matricula") as string,
          adscripcion: formData.get("adscripcion") as string,
          categoria: formData.get("categoria") as string,
          antiguedad: formData.get("antiguedad") as string,
          phone: formData.get("phone") as string,
        })
        .eq("id", profile.id)

      if (error) return { error: error.message }
      router.refresh()
      return { success: true }
    },
    undefined
  )

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {state?.error && (
        <p style={{ color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "0.5rem", borderRadius: "0.375rem" }}>
          {state.error}
        </p>
      )}
      {state?.success && (
        <p style={{ color: "#16a34a", fontSize: "0.875rem", background: "#f0fdf4", padding: "0.5rem", borderRadius: "0.375rem" }}>
          Perfil actualizado
        </p>
      )}
      <Input label="Nombre completo" name="full_name" defaultValue={profile?.full_name ?? ""} />
      <Input label="Matrícula" name="matricula" defaultValue={profile?.matricula ?? ""} />
      <Input label="Adscripción" name="adscripcion" defaultValue={profile?.adscripcion ?? ""} />
      <Input label="Categoría" name="categoria" defaultValue={profile?.categoria ?? ""} />
      <Input label="Antigüedad" name="antiguedad" defaultValue={profile?.antiguedad ?? ""} />
      <Input label="Teléfono" name="phone" defaultValue={profile?.phone ?? ""} type="tel" />
      <Button type="submit" loading={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  )
}
