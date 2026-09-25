"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { ResponsiveDialog } from "@/shared/components/ui/ResponsiveDialog"
import type { WorkerProfileMode } from "@/shared/domain/worker"

export function ChangeMethodDialog({
  current,
  onConfirm,
  onCancel,
}: {
  current: WorkerProfileMode
  onConfirm: (m: WorkerProfileMode) => Promise<{ ok: boolean; message?: string }>
  onCancel: () => void
}) {
  const [selected, setSelected] = useState<WorkerProfileMode>(
    current === "manual" ? "payslip" : "manual"
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <ResponsiveDialog
      open={true}
      onClose={onCancel}
      title="Cambiar método"
      size="sm"
      closeOnOverlay={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            onClick={async () => {
              setLoading(true)
              setError(null)
              const r = await onConfirm(selected)
              setLoading(false)
              if (!r.ok) setError(r.message ?? "Error")
            }}
          >
            Cambiar
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <fieldset
          style={{
            border: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              color: "var(--fg)",
            }}
          >
            <input
              type="radio"
              name="changeMode"
              checked={selected === "manual"}
              onChange={() => setSelected("manual")}
              disabled={loading}
            />
            <span>Manual — capturaré mis datos a mano</span>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              color: "var(--fg)",
            }}
          >
            <input
              type="radio"
              name="changeMode"
              checked={selected === "payslip"}
              onChange={() => setSelected("payslip")}
              disabled={loading}
            />
            <span>Tarjetón — importaré un recibo</span>
          </label>
        </fieldset>

        {error && (
          <p style={{ color: "var(--error, #dc2626)", fontSize: "0.8125rem", margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    </ResponsiveDialog>
  )
}
