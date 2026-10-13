"use client"

import { useState, useEffect } from "react"
import { Globe, Lock, CheckCircle, WarningCircle } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"

export function CajaAdminVisibilityToggle() {
  const [isPublic, setIsPublic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/caja/visibility")
      .then((r) => r.json())
      .then((data: { public_enabled?: boolean }) => {
        setIsPublic(Boolean(data.public_enabled))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (nextValue: boolean) => {
    setError(null)
    setFeedback(null)
    setUpdating(true)
    try {
      const res = await fetch("/api/caja/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_enabled: nextValue }),
      })
      const data = (await res.json()) as { ok?: boolean; public_enabled?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo actualizar la visibilidad")
      }
      setIsPublic(Boolean(data.public_enabled))
      setFeedback(
        nextValue
          ? "Caja de Ahorro ahora está visible y abierta para todos los usuarios."
          : "Caja de Ahorro ahora está en modo de pruebas exclusivo para administradores.",
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cambiar visibilidad")
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return null

  return (
    <div style={{ width: "100%", boxSizing: "border-box", minWidth: 0, marginBottom: "1.25rem" }}>
      <Card padding="clamp(1rem, 3vw, 1.25rem)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", width: "100%", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", minWidth: 0, flex: "1 1 240px" }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "var(--radius-md)",
                background: isPublic ? "rgba(34, 197, 94, 0.12)" : "rgba(234, 179, 8, 0.12)",
                color: isPublic ? "var(--success, #16a34a)" : "var(--warning, #ca8a04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "0.125rem",
              }}
            >
              {isPublic ? <Globe size={24} weight="bold" /> : <Lock size={24} weight="bold" />}
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", wordBreak: "break-word" }}>
                  Visibilidad de Caja de Ahorro:
                </span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    padding: "0.2rem 0.5rem",
                    borderRadius: "var(--radius-pill)",
                    background: isPublic ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                    color: isPublic ? "var(--success, #16a34a)" : "var(--warning, #ca8a04)",
                    flexShrink: 0,
                  }}
                >
                  {isPublic ? "Abierto a Todos" : "Modo Pruebas (Solo Admins)"}
                </span>
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)", wordBreak: "break-word", lineHeight: 1.35 }}>
                {isPublic
                  ? "El enlace aparece en el menú lateral para todos los trabajadores afiliados y la sección /caja está disponible."
                  : "Aparece únicamente en el menú lateral de cuentas con rol administrador. El público general ve un aviso de pruebas."}
              </p>
            </div>
          </div>

          <div style={{ flex: "1 1 auto", display: "flex", justifyContent: "flex-end" }}>
            {isPublic ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggle(false)}
                loading={updating}
                leadingIcon={<Lock size={16} />}
              >
                Regresar a Modo Pruebas
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleToggle(true)}
                loading={updating}
                leadingIcon={<Globe size={16} />}
              >
                Abrir al Público General
              </Button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            style={{
              marginTop: "0.875rem",
              padding: "0.5rem 0.75rem",
              background: "rgba(34, 197, 94, 0.1)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8125rem",
              color: "var(--success, #16a34a)",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <CheckCircle size={16} weight="fill" />
            <span>{feedback}</span>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "0.875rem",
              padding: "0.5rem 0.75rem",
              background: "rgba(220, 38, 38, 0.1)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8125rem",
              color: "var(--error)",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <WarningCircle size={16} weight="fill" />
            <span>{error}</span>
          </div>
        )}
      </Card>
    </div>
  )
}
