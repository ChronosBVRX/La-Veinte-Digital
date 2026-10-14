"use client"

import { useState } from "react"
import {
  PiggyBank,
  CurrencyDollar,
  ArrowClockwise,
  CalendarBlank,
  TrendUp,
  Info,
  Calculator,
  CaretDown,
  CaretUp,
  WarningCircle,
  CalendarCheck,
} from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { proyectarAhorro, diagnosticoRenovacion, type CajaLoanInfo } from "@/informative"
import type { SaldoPayload } from "@/lib/caja/models"

interface CajaBalanceCardProps {
  balance: SaldoPayload | null
  loan?: CajaLoanInfo | null
  loading: boolean
  onRefresh: () => void
}

function formatMoney(amount?: number | null): string {
  if (amount === undefined || amount === null) return "$0.00"
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function CajaBalanceCard({ balance, loan, loading, onRefresh }: CajaBalanceCardProps) {
  const [proyQuincenas, setProyQuincenas] = useState(12)
  const [proyAbono, setProyAbono] = useState(500)
  const [showProyector, setShowProyector] = useState(false)

  if (!balance && !loading) {
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
              Información de saldos no sincronizada
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--muted)", maxWidth: "420px", lineHeight: 1.5, margin: "0 auto" }}>
              No se recibieron registros del servidor de la Caja SNTSS. Si tu sesión expiró por inactividad o hubo una interrupción de red, presiona sincronizar para reintentar.
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onRefresh} loading={loading}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
              <ArrowClockwise size={16} />
              <span>Sincronizar saldos</span>
            </span>
          </Button>
        </div>
      </Card>
    )
  }

  const saldoTotal = balance?.saldoTotal ?? balance?.saldo ?? 0
  const saldoAhorro = balance?.saldoAhorro ?? 0
  const saldoPrestamo = balance?.saldoPrestamo ?? 0
  const prestamoOtorgado = balance?.prestamoOtorgado ?? 0
  const retiroLaboral = balance?.retiroLaboral ?? 0

  const diag = diagnosticoRenovacion({
    saldoPrestamo,
    saldoAhorro,
    prestamoOtorgado,
    porcentajeActual: balance?.porcentaje,
    abonoAhorro: loan?.abono_ahorro,
    abonoPrestamo: loan?.abono_prestamo,
    importeMaximo: loan?.importe_maximo,
    quincenaActual: balance?.quincena,
  })

  const proyeccion = proyectarAhorro({
    saldoActual: saldoAhorro,
    abonoQuincenal: proyAbono,
    quincenas: proyQuincenas,
    tasaAnualEstimada: 8.0,
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* Tarjeta Principal de Saldo Total */}
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", width: "100%", minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: "1 1 200px" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Saldo Neto Registrado (Informativo)
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

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button variant="outline" size="sm" onClick={onRefresh} loading={loading} leadingIcon={<ArrowClockwise size={16} />}>
              Actualizar Saldos
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

        {/* Barra de Avance de Amortización (27% o dato del server) */}
        {typeof balance?.porcentaje === "number" && (
          <div style={{ marginTop: "1rem", padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem", flexWrap: "wrap", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--fg)" }}>
                Avance reportado por el servidor
              </span>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: balance.porcentaje >= 20 ? "var(--success, #16a34a)" : "var(--primary)" }}>
                {balance.porcentaje}% {balance.porcentaje >= 20 ? "(Umbral hipótesis ≥20%)" : ""}
              </span>
            </div>
            <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, balance.porcentaje))}%`,
                  background: balance.porcentaje >= 25 ? "var(--success, #16a34a)" : "var(--primary)",
                  borderRadius: "3px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}
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

      {/* Diagnóstico y Planificador de Renovación de Préstamo */}
      <Card padding="clamp(1rem, 3vw, 1.25rem)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CalendarCheck size={22} color="var(--primary)" weight="bold" />
            <div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
                Diagnóstico de Renovación de Préstamo
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Estimación de elegibilidad y líquido a recibir por quincena
              </div>
            </div>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.25rem 0.625rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: diag.elegibleHoy ? "rgba(22, 163, 74, 0.12)" : "rgba(37, 99, 235, 0.12)",
              color: diag.elegibleHoy ? "var(--success, #16a34a)" : "var(--primary)",
              border: `1px solid ${diag.elegibleHoy ? "rgba(22, 163, 74, 0.3)" : "rgba(37, 99, 235, 0.3)"}`,
            }}
          >
            {diag.elegibleHoy ? "✓ Elegible para renovar" : `Faltan ~${diag.quincenasParaElegibilidad} quincenas`}
          </span>
        </div>

        {/* Estatus principal */}
        <div
          style={{
            padding: "0.875rem 1rem",
            background: diag.elegibleHoy ? "rgba(22, 163, 74, 0.06)" : "var(--accent)",
            border: `1px solid ${diag.elegibleHoy ? "rgba(22, 163, 74, 0.2)" : "var(--border)"}`,
            borderRadius: "var(--radius-md)",
            marginBottom: "1rem",
          }}
        >
          {diag.elegibleHoy ? (
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
                ¡Ya puedes tramitar tu renovación de préstamo!
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.45 }}>
                Tu cobertura de ahorro actual es de <strong>{diag.porcentajeActual}%</strong> (supera el umbral estimado del 20%). En la quincena actual (<strong>{diag.quincenaActual} · {diag.quincenaActualTexto}</strong>), al liquidar tu adeudo anterior de {formatMoney(diag.adeudoHoy)}, tu líquido neto estimado a recibir es de:
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--success, #16a34a)", marginTop: "0.375rem" }}>
                {formatMoney(diag.liquidoHoy)}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
                En proceso de amortización y ahorro
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.45 }}>
                Llevas un <strong>{diag.porcentajeActual}%</strong> de cobertura. Para alcanzar el umbral de renovación estimado (≥20%), faltan aproximadamente <strong>{diag.quincenasParaElegibilidad} quincenas</strong> (~{Math.round(diag.quincenasParaElegibilidad / 2)} meses).
              </div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--primary)", marginTop: "0.375rem" }}>
                Quincena estimada para calificar: {diag.quincenaEstimadaElegibilidad} ({diag.quincenaEstimadaTexto})
              </div>
            </div>
          )}
        </div>

        {/* Tabla / Proyecciones Quincena por Quincena */}
        <div>
          <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.35rem" }}>
            ¿Cuánto líquido recibirías si renuevas en próximas quincenas?
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem", lineHeight: 1.4 }}>
            Con cada quincena transcurrida, tu ahorro sigue acumulándose y tu saldo de préstamo disminuye, incrementando el líquido que te depositan en cuenta:
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {diag.proyecciones.map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0.75rem",
                  background: p.quincenaOffset === 0 ? "rgba(37, 99, 235, 0.06)" : "var(--accent)",
                  border: p.quincenaOffset === 0 ? "1px solid rgba(37, 99, 235, 0.25)" : "1px solid transparent",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.8125rem",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                    {p.quincenaOffset === 0 ? `Hoy (${p.quincenaCodigo})` : `+${p.quincenaOffset} qnas (${p.quincenaCodigo})`}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.375rem" }}>
                    · {p.quincenaTexto}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: p.esElegible ? "var(--success, #16a34a)" : "var(--muted)" }}>
                    {formatMoney(p.liquidoEstimado)}
                  </div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                    Líquido neto estimado
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Proyector Referencial de Ahorro */}
      <Card padding="clamp(1rem, 3vw, 1.25rem)">
        <div
          onClick={() => setShowProyector(!showProyector)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calculator size={22} color="var(--primary)" weight="bold" />
            <div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
                Simulador de Ahorro y Metas
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Calcula cuánto crecerá tu fondo con aportaciones quincenales
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" type="button">
            {showProyector ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </Button>
        </div>

        {showProyector && (
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.375rem" }}>
                  Aportación quincenal
                </label>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {[300, 500, 1000, 1500].map((monto) => (
                    <button
                      key={monto}
                      type="button"
                      onClick={() => setProyAbono(monto)}
                      style={{
                        padding: "0.375rem 0.625rem",
                        borderRadius: "var(--radius-sm)",
                        border: proyAbono === monto ? "1px solid var(--primary)" : "1px solid var(--border)",
                        background: proyAbono === monto ? "var(--primary)" : "var(--accent)",
                        color: proyAbono === monto ? "#fff" : "var(--fg)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ${monto}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.375rem" }}>
                  Plazo de ahorro
                </label>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {[
                    { q: 6, label: "3 meses (6 Q)" },
                    { q: 12, label: "6 meses (12 Q)" },
                    { q: 24, label: "1 año (24 Q)" },
                  ].map((item) => (
                    <button
                      key={item.q}
                      type="button"
                      onClick={() => setProyQuincenas(item.q)}
                      style={{
                        padding: "0.375rem 0.625rem",
                        borderRadius: "var(--radius-sm)",
                        border: proyQuincenas === item.q ? "1px solid var(--primary)" : "1px solid var(--border)",
                        background: proyQuincenas === item.q ? "var(--primary)" : "var(--accent)",
                        color: proyQuincenas === item.q ? "#fff" : "var(--fg)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultados de proyección */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.75rem",
                padding: "0.875rem",
                background: "var(--accent)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 600 }}>Total a Aportar</div>
                <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--fg)" }}>
                  {formatMoney(proyeccion.totalAportado)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 600 }}>Rendimiento Estimado (~8% anual)</div>
                <div style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--success, #16a34a)" }}>
                  +{formatMoney(proyeccion.rendimientoEstimado)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontWeight: 600 }}>Saldo Final Estimado</div>
                <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "var(--primary)" }}>
                  {formatMoney(proyeccion.saldoEstimadoFinal)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", fontStyle: "italic" }}>
              * Cálculo orientativo proyectado a tasa anual referencial de dividendos (~8%). No sustituye cotizaciones contractuales de la Caja SNTSS.
            </div>
          </div>
        )}
      </Card>

      {/* Nota informativa y referencial */}
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
          <strong>Consulta sindical informativa:</strong> Esta sección refleja los saldos y acumulados reportados por el sistema de la Caja de Previsión y Ahorro SNTSS con propósitos de transparencia y consulta. Para trámites de retiro, aclaraciones o modificaciones patrimoniales, el trámite debe gestionarse directamente a través de tu delegación sindical o ventanillas oficiales de la Caja.
        </span>
      </div>
    </div>
  )
}
