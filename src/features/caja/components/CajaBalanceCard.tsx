"use client"

import { PiggyBank, HandCoins, CurrencyDollar, ArrowClockwise, CalendarBlank, TrendUp } from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import type { SaldoPayload } from "@/lib/caja/models"

interface CajaBalanceCardProps {
  balance: SaldoPayload | null
  loading: boolean
  onRefresh: () => void
  onOpenWithdraw: () => void
}

function formatMoney(amount?: number | null): string {
  if (amount === undefined || amount === null) return "$0.00"
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function CajaBalanceCard({ balance, loading, onRefresh, onOpenWithdraw }: CajaBalanceCardProps) {
  const saldoTotal = balance?.saldoTotal ?? balance?.saldo ?? 0
  const saldoAhorro = balance?.saldoAhorro ?? 0
  const saldoPrestamo = balance?.saldoPrestamo ?? 0
  const prestamoOtorgado = balance?.prestamoOtorgado ?? 0
  const retiroLaboral = balance?.retiroLaboral ?? 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* Tarjeta Principal de Saldo Total */}
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", width: "100%", minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: "1 1 200px" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Saldo Neto Disponible
            </div>
            <div style={{ fontSize: "clamp(1.75rem, 6vw, 2.25rem)", fontWeight: 800, color: "var(--fg)", margin: "0.25rem 0", letterSpacing: "-0.02em", wordBreak: "break-word" }}>
              {formatMoney(saldoTotal)}
            </div>
            {balance?.fechaConsultaSaldo && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--muted)", flexWrap: "wrap" }}>
                <CalendarBlank size={14} style={{ flexShrink: 0 }} />
                <span>Actualizado al: {balance.fechaConsultaSaldo}</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", width: "100%", maxWidth: "100%" }}>
            <Button variant="outline" size="sm" onClick={onRefresh} loading={loading} leadingIcon={<ArrowClockwise size={16} />} style={{ flex: "1 1 auto" }}>
              Actualizar
            </Button>
            <Button variant="primary" size="sm" onClick={onOpenWithdraw} leadingIcon={<HandCoins size={16} />} style={{ flex: "1 1 auto" }}>
              Solicitar Retiro
            </Button>
          </div>
        </div>

        {/* Desglose de saldos */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
            gap: "0.75rem",
            marginTop: "1.25rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border)",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
              <PiggyBank size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Saldo Ahorro</span>
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)", wordBreak: "break-word" }}>
              {formatMoney(saldoAhorro)}
            </div>
            {balance?.quincena && (
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                Periodo: {balance.quincena} {balance.mes || ""}
              </div>
            )}
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
              <CurrencyDollar size={16} color="var(--warning, #eab308)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Saldo Préstamo Activo</span>
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: saldoPrestamo > 0 ? "var(--error, #ef4444)" : "var(--fg)", wordBreak: "break-word" }}>
              {formatMoney(saldoPrestamo)}
            </div>
            {prestamoOtorgado > 0 && (
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                Otorgado: {formatMoney(prestamoOtorgado)}
              </div>
            )}
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
              <TrendUp size={16} color="var(--success, #22c55e)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Retiro Laboral Acumulado</span>
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)", wordBreak: "break-word" }}>
              {formatMoney(retiroLaboral)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              Fondo laboral sindicato
            </div>
          </div>
        </div>
      </Card>

      {/* Historial de saldos si existe */}
      {balance?.historicos && balance.historicos.length > 0 && (
        <Card padding="1.25rem">
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
            Historial de Saldos Mensuales
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {balance.historicos.map((h, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.75rem",
                  background: "var(--accent)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={{ color: "var(--muted)" }}>{h.mes || `Mes ${i + 1}`}</span>
                <span style={{ fontWeight: 600 }}>{formatMoney(h.saldo)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
