"use client"

import {
  CurrencyDollar,
  Info,
  CheckCircle,
  CalendarBlank,
  ArrowClockwise,
  Receipt,
  HandCoins,
  Clock,
  WarningCircle,
} from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import {
  adeudoActual,
  liquidoARecibir,
  coberturaColateralEstimada,
  elegibilidadRenovacionEstimada,
  type CajaLoanInfo,
} from "@/informative"
import type { SaldoPayload, AccountProfile } from "@/lib/caja/models"

interface CajaLoanCardProps {
  balance: SaldoPayload | null
  account: AccountProfile | null
  loan?: CajaLoanInfo | null
  onRefresh: () => void
  loading?: boolean
}

function formatMoney(amount?: number | null): string {
  if (amount === undefined || amount === null) return "$0.00"
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function CajaLoanCard({ balance, account, loan, onRefresh, loading }: CajaLoanCardProps) {
  if (!balance && !loan && !loading) {
    return (
      <Card padding="clamp(1.5rem, 4vw, 2.25rem)">
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <WarningCircle size={30} weight="duotone" color="var(--muted)" />
          </div>
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.35rem" }}>
              Información de préstamos no sincronizada
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--muted)", maxWidth: "420px", lineHeight: 1.5, margin: "0 auto" }}>
              No se recibieron registros de préstamos del servidor de la Caja SNTSS. Presiona sincronizar para reintentar la consulta.
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onRefresh} loading={loading}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
              <ArrowClockwise size={16} />
              <span>Sincronizar información</span>
            </span>
          </Button>
        </div>
      </Card>
    )
  }

  const saldoPrestamo = balance?.saldoPrestamo ?? 0
  const saldoAhorro = balance?.saldoAhorro ?? 0
  const prestamoOtorgado = balance?.prestamoOtorgado ?? 0
  const porcentaje = balance?.porcentaje
  const quincena = balance?.quincena
  const fechaConsulta = balance?.fechaConsultaSaldo

  // Datos de estimación (GET accounts/{mat}/loan o fórmulas réplica)
  const importeMaximo = Number(loan?.importe_maximo ?? 0)
  const adeudo = Number(
    loan?.saldo_por_pagar ?? (saldoPrestamo > 0 ? adeudoActual(saldoPrestamo, saldoAhorro) : 0),
  )
  const liquido = Number(
    loan?.liquido_a_recibir ?? (importeMaximo > 0 ? liquidoARecibir(importeMaximo, adeudo) : 0),
  )
  const plazoMaximo = loan?.plazo_maximo
  const abonoPrestamo = Number(loan?.abono_prestamo ?? 0)
  const abonoAhorro = Number(loan?.abono_ahorro ?? 0)
  const retencionMinima = loan?.retencion_minima ? Number(loan.retencion_minima) : null
  const periodoRetencion = loan?.periodo_retencion ? String(loan.periodo_retencion) : null

  // Cobertura colateral estimada y elegibilidad referencial
  const cobertura = coberturaColateralEstimada(saldoAhorro, prestamoOtorgado)
  const renovacion = elegibilidadRenovacionEstimada(porcentaje, account?.mensajeRenovacion)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* 1. Tarjeta Principal: Préstamo Vigente y Amortización */}
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CurrencyDollar size={22} color="var(--primary)" weight="bold" />
            <div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                Consulta de Préstamo Vigente
              </h2>
              {fechaConsulta && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                  <CalendarBlank size={14} />
                  <span>Actualizado al: {fechaConsulta}</span>
                </div>
              )}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={onRefresh} loading={loading} leadingIcon={<ArrowClockwise size={16} />}>
            Actualizar
          </Button>
        </div>

        {/* Métricas clave */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
            gap: "0.75rem",
            marginBottom: "1rem",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Saldo Pendiente por Pagar</div>
            <div style={{ fontSize: "clamp(1.2rem, 4.5vw, 1.45rem)", fontWeight: 800, color: saldoPrestamo > 0 ? "var(--error, #ef4444)" : "var(--fg)", margin: "0.25rem 0", wordBreak: "break-word" }}>
              {formatMoney(saldoPrestamo)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Descuento vía nómina IMSS</div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Préstamo Otorgado</div>
            <div style={{ fontSize: "clamp(1.2rem, 4.5vw, 1.45rem)", fontWeight: 800, color: "var(--fg)", margin: "0.25rem 0", wordBreak: "break-word" }}>
              {formatMoney(prestamoOtorgado)}
            </div>
            {quincena && (
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Quincena solicitud: {quincena}</div>
            )}
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Adeudo Actual Neto</div>
            <div style={{ fontSize: "clamp(1.2rem, 4.5vw, 1.45rem)", fontWeight: 800, color: "var(--fg)", margin: "0.25rem 0", wordBreak: "break-word" }}>
              {formatMoney(adeudo)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Fórmula: saldo − (ahorro − $600)</div>
          </div>
        </div>

        {/* Barra de Avance */}
        {typeof porcentaje === "number" && (
          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem", flexWrap: "wrap", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--fg)" }}>
                Avance del servidor: {porcentaje}% {cobertura > 0 ? `· Cobertura colateral: ${cobertura}%` : ""}
              </span>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: renovacion.elegible ? "var(--success, #16a34a)" : "var(--muted)" }}>
                {renovacion.elegible ? "✓ Posible renovación" : "Umbral estimado ≥20%"}
              </span>
            </div>
            <div style={{ height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden", position: "relative" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, porcentaje))}%`,
                  background: porcentaje >= 25 ? "var(--success, #16a34a)" : "var(--primary)",
                  borderRadius: "4px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Estatus de Elegibilidad de Renovación */}
        <div
          style={{
            padding: "0.875rem 1rem",
            background: renovacion.elegible ? "rgba(22, 163, 74, 0.08)" : "rgba(37, 99, 235, 0.05)",
            border: `1px solid ${renovacion.elegible ? "rgba(22, 163, 74, 0.25)" : "rgba(37, 99, 235, 0.15)"}`,
            borderRadius: "var(--radius-md)",
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}
        >
          {renovacion.elegible ? (
            <CheckCircle size={22} color="var(--success, #16a34a)" weight="fill" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          ) : (
            <Clock size={22} color="var(--primary)" weight="bold" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          )}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>
                {renovacion.elegible ? "Estatus: Posiblemente Elegible para Renovación" : "Estatus: En Proceso de Amortización"}
              </span>
              <span style={{ fontSize: "0.6875rem", padding: "0.15rem 0.4rem", borderRadius: "4px", background: "var(--border)", color: "var(--muted)", fontWeight: 600 }}>
                Estimación referencial
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.45 }}>
              {renovacion.motivo}
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Tarjeta de Estimación Referencial de Préstamo (GET accounts/{mat}/loan) */}
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Receipt size={22} color="var(--primary)" weight="bold" />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
            Estimación Referencial de Crédito
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
            gap: "0.75rem",
            marginBottom: "1rem",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Estimación de Préstamo</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--primary)", margin: "0.25rem 0", wordBreak: "break-word" }}>
              {formatMoney(importeMaximo > 0 ? importeMaximo : prestamoOtorgado)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Importe máximo evaluado</div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Líquido a Recibir</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--success, #16a34a)", margin: "0.25rem 0", wordBreak: "break-word" }}>
              {formatMoney(liquido)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Fórmula: estimación − adeudo</div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>Plazo Máximo</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--fg)", margin: "0.25rem 0", wordBreak: "break-word" }}>
              {plazoMaximo ? `${plazoMaximo} Q` : "240 Q"}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>Quincenas de amortización</div>
          </div>
        </div>

        {/* Desglose de Retenciones Quincenales */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
            gap: "0.75rem",
            padding: "0.875rem",
            background: "var(--accent)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 600 }}>Retención Quincenal Préstamo</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
              {formatMoney(abonoPrestamo)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 600 }}>Retención Quincenal Ahorro</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
              {formatMoney(abonoAhorro)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 600 }}>Retención Adicional</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
              {retencionMinima ? `${formatMoney(retencionMinima)} (${periodoRetencion || "Semestral"})` : "Sin retención extra"}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Tarjeta Informativa de Política de Retención / Ahorro */}
      <Card padding="clamp(1rem, 3vw, 1.25rem)">
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
          <HandCoins size={22} color="var(--primary)" weight="bold" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
              Política de Retención Quincenal ({formatMoney(abonoAhorro)})
            </div>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.45 }}>
              {saldoPrestamo > 0 ? (
                <>
                  Al contar con un <strong>préstamo activo</strong> de la Caja SNTSS, tu aportación quincenal de ahorro permanece establecida por contrato para garantizar la amortización de la cuenta. No es posible modificar esta retención mientras exista saldo pendiente.
                </>
              ) : (
                <>
                  Tu cuenta no tiene préstamo pendiente. La retención quincenal de ahorro se puede gestionar o actualizar acudiendo a tu delegación sindical correspondiente.
                </>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Nota informativa de trámite oficial */}
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
