"use client"
import { useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { deleteWorkerDataAction } from "@/features/profile/actions/worker-profile-actions"

export function DeleteWorkerDataSection({ onDeleted }: { onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    const result = await deleteWorkerDataAction(confirmText)
    setLoading(false)
    if (result.ok) onDeleted()
    else setError(result.message)
  }

  return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0, color: "#991b1b" }}>Borrar mis datos laborales</h3>
      <p style={{ fontSize: "0.8125rem", color: "#7f1d1d", margin: 0 }}>
        Esto eliminará tu categoría, adscripción, antigüedad, contexto de nómina, tarjetones importados y preferencias.
        Tu cuenta permanecerá activa y volverás al modo básico.
      </p>
      <input
        type="text"
        placeholder='Escribe "BORRAR" para confirmar'
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        style={{ padding: "0.5rem", border: "1px solid #fca5a5", borderRadius: "0.25rem", fontSize: "0.875rem" }}
      />
      {error && <p style={{ color: "#dc2626", fontSize: "0.8125rem", margin: 0 }}>{error}</p>}
      <Button
        onClick={handleDelete}
        loading={loading}
        disabled={confirmText !== "BORRAR"}
        style={{ backgroundColor: "#dc2626", color: "white", border: "none", alignSelf: "flex-start" }}
      >
        Borrar mis datos laborales
      </Button>
    </div>
  )
}
