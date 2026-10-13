"use client"

import { useState } from "react"
import { CurrencyDollar, CheckCircle, Info, Handshake } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { renewCajaLoan } from "../services/caja-service"
import type { SaldoPayload, AccountProfile } from "@/lib/caja/models"

interface CajaLoanCardProps {
  balance: SaldoPayload | null
  account: AccountProfile | null
  onRefresh: () => void
}

export function CajaLoanCard({ balance, account, onRefresh }: CajaLoanCardProps) {
  const [loading, setLoading] = useState(false)
  const [renewalSuccess, setRenewalSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saldoPrestamo = balance?.saldoPrestamo ?? 0
  const prestamoOtorgado = balance?.prestamoOtorgado ?? 0
  const mensajeRenovacion = account?.mensajeRenovacion || "Consulta las condiciones vigentes de renovación de préstamo ante tu delegación sindical."

  const handleRenew = async () => {
    setError(null)
    setLoading(true)
    try {
      await renewCajaLoan()
      setRenewalSuccess(true)
      onRefresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al procesar solicitud de renovación")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Card padding="1.5rem">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <CurrencyDollar size={22} color="var(--primary)" weight="bold" />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            Préstamos de Caja SNTSS
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ padding: "1rem", background: "var(--accent)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Saldo Pendiente</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: saldoPrestamo > 0 ? "var(--error, #ef4444)" : "var(--fg)", margin: "0.25rem 0" }}>
              {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(saldoPrestamo)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Descuento vía nómina IMSS</div>
          </div>

          <div style={{ padding: "1rem", background: "var(--accent)", borderRadius: "var(--radius-md)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Préstamo Otorgado</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--fg)", margin: "0.25rem 0" }}>
              {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(prestamoOtorgado)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Monto original concedido</div>
          </div>
        </div>

        <div
          style={{
            padding: "1rem",
            background: "rgba(37, 99, 235, 0.05)",
            border: "1px solid rgba(37, 99, 235, 0.15)",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.25rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}
        >
          <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Estado de Renovación
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
              {mensajeRenovacion}
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "0.75rem",
              background: "rgba(220, 38, 38, 0.08)",
              border: "1px solid rgba(220, 38, 38, 0.25)",
              borderRadius: "var(--radius-md)",
              color: "var(--error)",
              fontSize: "0.8125rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {renewalSuccess ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              background: "rgba(34, 197, 94, 0.1)",
              borderRadius: "var(--radius-md)",
              color: "var(--success, #22c55e)",
              fontSize: "0.8125rem",
              fontWeight: 600,
            }}
          >
            <CheckCircle size={18} weight="fill" />
            <span>Solicitud de renovación enviada con éxito. Será evaluada por el comité de Caja.</span>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="primary"
              size="md"
              onClick={handleRenew}
              loading={loading}
              leadingIcon={<Handshake size={18} />}
            >
              Solicitar Renovación de Préstamo
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
