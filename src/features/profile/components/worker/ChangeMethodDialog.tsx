"use client"
import { useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import type { WorkerProfileMode } from "@/shared/domain/worker"

export function ChangeMethodDialog({ current, onConfirm, onCancel }: { current: WorkerProfileMode; onConfirm: (m: WorkerProfileMode) => Promise<{ ok: boolean; message?: string }>; onCancel: () => void }) {
  const [selected, setSelected] = useState<WorkerProfileMode>(current === "manual" ? "payslip" : "manual")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}>
      <div style={{ background: "var(--card)", borderRadius: "var(--radius-lg)", padding: "1.5rem", maxWidth: "400px", width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }} role="dialog" aria-modal="true">
        <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>Cambiar método</h3>
        <fieldset style={{ border: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
            <input type="radio" name="changeMode" checked={selected === "manual"} onChange={() => setSelected("manual")} />
            <span>Manual — capturaré mis datos a mano</span>
          </label>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
            <input type="radio" name="changeMode" checked={selected === "payslip"} onChange={() => setSelected("payslip")} />
            <span>Tarjetón — importaré un recibo</span>
          </label>
        </fieldset>
        {error && <p style={{ color: "#dc2626", fontSize: "0.8125rem", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button loading={loading} onClick={async () => {
            setLoading(true)
            const r = await onConfirm(selected)
            setLoading(false)
            if (!r.ok) setError(r.message ?? "Error")
          }}>Cambiar</Button>
        </div>
      </div>
    </div>
  )
}
