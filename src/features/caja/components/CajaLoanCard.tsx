"use client"

import { CurrencyDollar, Info } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import type { SaldoPayload, AccountProfile } from "@/lib/caja/models"

interface CajaLoanCardProps {
  balance: SaldoPayload | null
  account: AccountProfile | null
  onRefresh: () => void
}

export function CajaLoanCard({ balance, account }: CajaLoanCardProps) {
  const saldoPrestamo = balance?.saldoPrestamo ?? 0
  const prestamoOtorgado = balance?.prestamoOtorgado ?? 0
  const mensajeRenovacion = account?.mensajeRenovacion || "Consulta las condiciones vigentes de renovación de préstamo ante tu delegación sindical."

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <CurrencyDollar size={22} color="var(--primary)" weight="bold" />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            Consulta de Préstamos (Informativo)
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: "0.75rem",
            marginBottom: "1.25rem",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Saldo Pendiente por Pagar</div>
            <div style={{ fontSize: "clamp(1.25rem, 5vw, 1.5rem)", fontWeight: 800, color: saldoPrestamo > 0 ? "var(--error, #ef4444)" : "var(--fg)", margin: "0.25rem 0", wordBreak: "break-word" }}>
              {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(saldoPrestamo)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Descuento vía nómina IMSS</div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Préstamo Otorgado</div>
            <div style={{ fontSize: "clamp(1.25rem, 5vw, 1.5rem)", fontWeight: 800, color: "var(--fg)", margin: "0.25rem 0", wordBreak: "break-word" }}>
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
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}
        >
          <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Estatus de Renovación
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>
              {mensajeRenovacion}
            </div>
          </div>
        </div>
      </Card>

      {/* Nota informativa */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          padding: "0.875rem 1rem",
          background: "var(--accent)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.8125rem",
          color: "var(--muted)",
          lineHeight: 1.45,
        }}
      >
        <Info size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
        <span>
          <strong>Información referencial:</strong> Esta vista es de carácter orientativo para consulta de saldos vigentes. Toda solicitud de préstamo, reestructuración o renovación se realiza por los canales oficiales presenciales o autorizados de la Caja SNTSS.
        </span>
      </div>
    </div>
  )
}
