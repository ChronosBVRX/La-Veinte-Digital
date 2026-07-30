"use client"

import { useActionState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"
import { Select } from "@/shared/components/ui/Input"

const ENTRY_TYPES = [
  "Tiempo extra",
  "Guardia festiva",
  "Cambio de turno",
  "Sustitución",
  "Comisión",
  "Jornada acumulada",
  "Falta justificada",
  "Incapacidad",
  "Vacaciones",
  "Pase de entrada o salida",
  "Día trabajado que no apareció pagado",
] as const

interface BitacoraFormProps {
  userId: string
  onSuccess: () => void
}

export function BitacoraForm({ userId, onSuccess }: BitacoraFormProps) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => {
      const supabase = createClient()
      const { error } = await supabase.from("bitacora_entries").insert({
        user_id: userId,
        entry_type: formData.get("entry_type") as string,
        description: formData.get("description") as string,
        entry_date: formData.get("entry_date") as string,
      })
      if (error) return { error: error.message }
      onSuccess()
      return undefined
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
      <Select label="Tipo de registro" name="entry_type" required>
        <option value="">Seleccionar tipo...</option>
        {ENTRY_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </Select>
      <Input label="Fecha" name="entry_date" type="date" required />
      <Input label="Descripción (opcional)" name="description" placeholder="Agrega detalles..." />
      <Button type="submit" loading={pending} style={{ alignSelf: "flex-end" }}>
        {pending ? "Guardando..." : "Guardar registro"}
      </Button>
    </form>
  )
}
