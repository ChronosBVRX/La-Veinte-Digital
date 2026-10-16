"use client"

import { useState } from "react"
import {
  PiggyBank,
  CurrencyDollar,
  ArrowClockwise,
  CalendarBlank,
  Info,
  Calculator,
  CaretDown,
  CaretUp,
  CaretLeft,
  CaretRight,
  WarningCircle,
  CalendarCheck,
  Target,
  Sparkle,
  Lightbulb,
  Hourglass,
} from "@phosphor-icons/react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import {
  proyectarAhorro,
  diagnosticoRenovacion,
  getQuincenaFromDate,
  formatQuincena,
  type CajaLoanInfo,
} from "@/informative"
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
  const [selectedOffset, setSelectedOffset] = useState<number>(0)
  const [mostrarMenuQuincenas, setMostrarMenuQuincenas] = useState(false)
  const [mostrarTodasLasQuincenas, setMostrarTodasLasQuincenas] = useState(false)

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

  const saldoAhorro = balance?.saldoAhorro ?? 0
  const saldoPrestamo = balance?.saldoPrestamo ?? 0
  const prestamoOtorgado = balance?.prestamoOtorgado ?? 0

  const quincenaHoy = getQuincenaFromDate(balance?.fechaConsultaSaldo)

  const diag = diagnosticoRenovacion({
    saldoPrestamo,
    saldoAhorro,
    prestamoOtorgado,
    porcentajeActual: balance?.porcentaje,
    abonoAhorro: loan?.abono_ahorro,
    abonoPrestamo: loan?.abono_prestamo,
    importeMaximo: loan?.importe_maximo,
    retencionExtraordinaria: loan?.retencion_minima,
    periodoRetencion: loan?.periodo_retencion,
    quincenaActual: quincenaHoy,
    quincenaOtorgamiento: balance?.quincena,
    fechaConsulta: balance?.fechaConsultaSaldo,
  })

  const proySeleccionada =
    diag.proyecciones.find((p) => p.quincenaOffset === selectedOffset) ||
    diag.proyecciones[0] || {
      quincenaOffset: 0,
      quincenaCodigo: quincenaHoy,
      quincenaTexto: formatQuincena(quincenaHoy),
      ahorroEstimado: saldoAhorro,
      adeudoEstimado: diag.adeudoHoy,
      porcentajeEstimado: diag.porcentajeActual,
      liquidoEstimado: diag.liquidoHoy,
      esElegible: diag.elegibleHoy,
    }

  const gananciaVsHoy = Math.max(0, proySeleccionada.liquidoEstimado - diag.liquidoHoy)

  const proyeccion = proyectarAhorro({
    saldoActual: saldoAhorro,
    abonoQuincenal: proyAbono,
    quincenas: proyQuincenas,
    tasaAnualEstimada: 8.0,
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", width: "100%", minWidth: 0, boxSizing: "border-box" }}>
      {/* Tarjeta Principal de Saldos */}
      <Card padding="clamp(1rem, 3vw, 1.5rem)">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", width: "100%", minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: "1 1 200px" }}>
            <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>
              Resumen de Cuenta en Caja SNTSS
            </div>
            {balance?.fechaConsultaSaldo && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", flexWrap: "wrap" }}>
                <CalendarBlank size={14} style={{ flexShrink: 0 }} />
                <span>Corte de saldos al: {balance.fechaConsultaSaldo}</span>
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
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
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
              <span style={{ fontWeight: 600 }}>Tu Fondo de Ahorro</span>
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)", wordBreak: "break-word" }}>
              {formatMoney(saldoAhorro)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              {balance?.fechaConsultaSaldo ? `Corte al: ${balance.fechaConsultaSaldo}` : `Quincena actual: ${quincenaHoy}`}
            </div>
          </div>

          <div style={{ padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.25rem" }}>
              <CurrencyDollar size={16} color="var(--warning, #eab308)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Préstamo por Pagar</span>
            </div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: saldoPrestamo > 0 ? "var(--error, #ef4444)" : "var(--fg)", wordBreak: "break-word" }}>
              {formatMoney(saldoPrestamo)}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.15rem" }}>
              {prestamoOtorgado > 0 && (
                <span>Monto prestado original: {formatMoney(prestamoOtorgado)}</span>
              )}
              {balance?.quincena && (
                <span>Fecha de solicitud: {balance.quincena} ({formatQuincena(balance.quincena)})</span>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Respaldo de Ahorro para Renovación */}
        {typeof balance?.porcentaje === "number" && (
          <div style={{ marginTop: "1rem", padding: "0.875rem", background: "var(--accent)", borderRadius: "var(--radius-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem", flexWrap: "wrap", gap: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--fg)" }}>
                Respaldo de ahorro para solicitar renovación
              </span>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: balance.porcentaje >= 20 ? "var(--success, #16a34a)" : "var(--primary)" }}>
                {balance.porcentaje}% {balance.porcentaje >= 20 ? "· Ya cumples con el 20% mínimo" : "· Necesitas al menos el 20%"}
              </span>
            </div>
            <div style={{ height: "6px", background: "var(--border)", borderRadius: "3px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, balance.porcentaje))}%`,
                  background: balance.porcentaje >= 20 ? "var(--success, #16a34a)" : "var(--primary)",
                  borderRadius: "3px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.35rem" }}>
              La Caja de Ahorro SNTSS solicita tener acumulado al menos el 20% del valor de tu préstamo en tu fondo de ahorro para poder tramitar una renovación.
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
                ¿Cuándo y cuánto puedes renovar de tu préstamo?
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Calcula en qué quincena te conviene solicitarlo y cuánto dinero libre llegará a tu cuenta bancaria
                {diag.quincenaOtorgamiento && (
                  <span> · Tu crédito actual inició en: {diag.quincenaOtorgamiento} ({diag.quincenaOtorgamientoTexto})</span>
                )}
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
            {diag.elegibleHoy ? "✓ Ya puedes renovar hoy" : `Faltan ~${diag.quincenasParaElegibilidad} quincenas`}
          </span>
        </div>

        {/* Estatus principal al día de hoy */}
        <div
          style={{
            padding: "0.875rem 1rem",
            background: diag.elegibleHoy ? "rgba(22, 163, 74, 0.06)" : "var(--accent)",
            border: `1px solid ${diag.elegibleHoy ? "rgba(22, 163, 74, 0.2)" : "var(--border)"}`,
            borderRadius: "var(--radius-md)",
            marginBottom: "1.25rem",
          }}
        >
          {diag.elegibleHoy ? (
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
                ¡Buenas noticias! Ya cumples los requisitos para renovar tu préstamo
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Tu fondo de ahorro cubre el <strong>{diag.porcentajeActual}%</strong> del valor de tu préstamo (la Caja pide al menos el 20%). En la quincena actual (<strong>{diag.quincenaActual} · {diag.quincenaActualTexto}</strong>), al liquidar lo que resta por pagar de tu crédito anterior ({formatMoney(diag.adeudoHoy)}), recibirías en mano:
              </div>
              <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--success, #16a34a)", marginTop: "0.35rem" }}>
                {formatMoney(diag.liquidoHoy)}
              </div>
              <div style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                Dinero libre depositado directamente en tu cuenta de nómina
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.25rem" }}>
                En camino a alcanzar tu renovación
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Tu ahorro actual cubre el <strong>{diag.porcentajeActual}%</strong> de tu préstamo. Para poder renovar, la Caja solicita un respaldo mínimo del 20%. Con tus aportaciones quincenales habituales, alcanzarás este requisito en aproximadamente <strong>{diag.quincenasParaElegibilidad} quincenas</strong> (~{Math.round(diag.quincenasParaElegibilidad / 2)} meses).
              </div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--primary)", marginTop: "0.4rem" }}>
                Quincena estimada en la que podrás solicitarlo: {diag.quincenaEstimadaElegibilidad} ({diag.quincenaEstimadaTexto})
              </div>
            </div>
          )}
        </div>

        {/* Selector de Quincena Interactivo */}
        <div
          style={{
            padding: "1rem",
            background: "var(--accent)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Calculator size={20} color="var(--primary)" weight="bold" />
              <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
                Simulador de Préstamo por Quincena
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMostrarMenuQuincenas(!mostrarMenuQuincenas)}
              style={{ fontSize: "0.75rem", height: "auto", padding: "0.25rem 0.625rem" }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                <span>Elegir de lista</span>
                {mostrarMenuQuincenas ? <CaretUp size={14} /> : <CaretDown size={14} />}
              </span>
            </Button>
          </div>

          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.875rem", lineHeight: 1.45 }}>
            Usa las flechas <strong>◄ ►</strong>, desliza la barra o pulsa los accesos directos para ver cómo crece el dinero que recibirás:
          </div>

          {/* Tarjeta de Control Tipo Stepper (Flechas ◄ y ►) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--card)",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "0.625rem 0.75rem",
              gap: "0.5rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
              marginBottom: "0.75rem",
            }}
          >
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedOffset <= 0}
              onClick={() => setSelectedOffset((prev) => Math.max(0, prev - 1))}
              style={{ padding: "0.4rem 0.6rem", minWidth: "38px" }}
              aria-label="Quincena anterior"
            >
              <CaretLeft size={18} weight="bold" />
            </Button>

            <div
              onClick={() => setMostrarMenuQuincenas(!mostrarMenuQuincenas)}
              style={{
                textAlign: "center",
                flex: 1,
                minWidth: 0,
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--fg)", wordBreak: "break-word" }}>
                {proySeleccionada.quincenaTexto}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.15rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>Quincena {proySeleccionada.quincenaCodigo}</span>
                <span>•</span>
                <span>{selectedOffset === 0 ? "Quincena actual (Hoy)" : `En ${selectedOffset} quincena${selectedOffset > 1 ? "s" : ""} (~${Math.round(selectedOffset / 2)} meses)`}</span>
              </div>
              {proySeleccionada.esExtraordinaria && (
                <div style={{ marginTop: "0.35rem" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "9999px",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      background: "rgba(22, 163, 74, 0.12)",
                      color: "var(--success, #16a34a)",
                      border: "1px solid rgba(22, 163, 74, 0.3)",
                    }}
                  >
                    ★ {proySeleccionada.motivoExtraordinario}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              size="sm"
              disabled={selectedOffset >= (diag.proyecciones[diag.proyecciones.length - 1]?.quincenaOffset ?? 24)}
              onClick={() => {
                const maxO = diag.proyecciones[diag.proyecciones.length - 1]?.quincenaOffset ?? 24
                setSelectedOffset((prev) => Math.min(maxO, prev + 1))
              }}
              style={{ padding: "0.4rem 0.6rem", minWidth: "38px" }}
              aria-label="Quincena siguiente"
            >
              <CaretRight size={18} weight="bold" />
            </Button>
          </div>

          {/* Slider de Quincenas */}
          <div style={{ marginBottom: "1rem", padding: "0 0.25rem" }}>
            <input
              type="range"
              min={0}
              max={diag.proyecciones[diag.proyecciones.length - 1]?.quincenaOffset ?? 24}
              step={1}
              value={selectedOffset}
              onChange={(e) => setSelectedOffset(Number(e.target.value))}
              style={{
                width: "100%",
                accentColor: "var(--primary)",
                cursor: "pointer",
                height: "6px",
              }}
              aria-label="Deslizador de quincenas"
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              <span>Hoy ({diag.quincenaActual})</span>
              <span>+6 meses</span>
              <span>+1 año</span>
            </div>
          </div>

          {/* Menú Desplegable Personalizado In-App (Si abren "Elegir de lista") */}
          {mostrarMenuQuincenas && (
            <div
              style={{
                marginBottom: "1rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                maxHeight: "280px",
                overflowY: "auto",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.08)",
              }}
            >
              <div style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid var(--border)", fontSize: "0.6875rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
                Selecciona una quincena:
              </div>
              {diag.proyecciones.map((p) => {
                const isItem = p.quincenaOffset === selectedOffset
                return (
                  <div
                    key={p.quincenaOffset}
                    onClick={() => {
                      setSelectedOffset(p.quincenaOffset)
                      setMostrarMenuQuincenas(false)
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.625rem 0.75rem",
                      borderBottom: "1px solid var(--border)",
                      background: isItem ? "rgba(37, 99, 235, 0.08)" : "transparent",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          border: isItem ? "5px solid var(--primary)" : "2px solid var(--border)",
                          background: "#fff",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: isItem ? 700 : 500, color: isItem ? "var(--primary)" : "var(--fg)" }}>
                          {p.quincenaOffset === 0 ? "Hoy" : `En ${p.quincenaOffset} qnas`} · {p.quincenaTexto}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                          Quincena {p.quincenaCodigo} {p.esExtraordinaria ? `· ★ ${p.motivoExtraordinario}` : ""}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: p.esElegible ? "var(--success, #16a34a)" : "var(--muted)" }}>
                        {formatMoney(p.liquidoEstimado)}
                      </div>
                      <div style={{ fontSize: "0.625rem", color: "var(--muted)" }}>
                        libre
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Accesos rápidos de selección */}
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <button
              type="button"
              onClick={() => setSelectedOffset(0)}
              style={{
                padding: "0.25rem 0.625rem",
                borderRadius: "9999px",
                border: selectedOffset === 0 ? "1px solid var(--primary)" : "1px solid var(--border)",
                background: selectedOffset === 0 ? "rgba(37, 99, 235, 0.12)" : "var(--card)",
                color: selectedOffset === 0 ? "var(--primary)" : "var(--muted)",
                fontSize: "0.6875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hoy ({diag.quincenaActual})
            </button>
            {diag.quincenasParaElegibilidad > 0 && (
              <button
                type="button"
                onClick={() => setSelectedOffset(diag.quincenasParaElegibilidad)}
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "9999px",
                  border: selectedOffset === diag.quincenasParaElegibilidad ? "1px solid var(--success, #16a34a)" : "1px solid var(--border)",
                  background: selectedOffset === diag.quincenasParaElegibilidad ? "rgba(22, 163, 74, 0.12)" : "var(--card)",
                  color: selectedOffset === diag.quincenasParaElegibilidad ? "var(--success, #16a34a)" : "var(--muted)",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  <Target size={13} weight="bold" />
                  Primera quincena que calificas ({diag.quincenaEstimadaTexto})
                </span>
              </button>
            )}
            {diag.proyecciones
              .filter((p) => p.esExtraordinaria)
              .map((p) => (
                <button
                  key={p.quincenaCodigo}
                  type="button"
                  onClick={() => setSelectedOffset(p.quincenaOffset)}
                  style={{
                    padding: "0.25rem 0.625rem",
                    borderRadius: "9999px",
                    border: selectedOffset === p.quincenaOffset ? "1px solid var(--success, #16a34a)" : "1px solid var(--border)",
                    background: selectedOffset === p.quincenaOffset ? "rgba(22, 163, 74, 0.12)" : "var(--card)",
                    color: selectedOffset === p.quincenaOffset ? "var(--success, #16a34a)" : "var(--fg)",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ★ {p.motivoExtraordinario || p.quincenaTexto}
                </button>
              ))}
          </div>

          {/* Tarjeta Destacada con el Resultado de la Estimación Seleccionada */}
          <div
            style={{
              padding: "1rem",
              background: "var(--card)",
              border: `1.5px solid ${proySeleccionada.esElegible ? "rgba(22, 163, 74, 0.35)" : "rgba(37, 99, 235, 0.35)"}`,
              borderRadius: "var(--radius-md)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div>
                <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  Estimación para la quincena:
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--fg)" }}>
                  {proySeleccionada.quincenaTexto} ({proySeleccionada.quincenaCodigo})
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  {proySeleccionada.quincenaOffset === 0 ? "Quincena de corte actual" : `En ${proySeleccionada.quincenaOffset} quincenas (~${Math.round(proySeleccionada.quincenaOffset / 2)} meses)`}
                </div>
              </div>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.25rem 0.625rem",
                  borderRadius: "9999px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  background: proySeleccionada.esElegible ? "rgba(22, 163, 74, 0.12)" : "rgba(37, 99, 235, 0.12)",
                  color: proySeleccionada.esElegible ? "var(--success, #16a34a)" : "var(--primary)",
                  border: `1px solid ${proySeleccionada.esElegible ? "rgba(22, 163, 74, 0.3)" : "rgba(37, 99, 235, 0.3)"}`,
                }}
              >
                {proySeleccionada.esElegible ? (
                  `✓ Calificas (Ahorro al ${proySeleccionada.porcentajeEstimado}%)`
                ) : (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                    <Hourglass size={12} weight="bold" />
                    En proceso (Ahorro al {proySeleccionada.porcentajeEstimado}%)
                  </span>
                )}
              </span>
            </div>

            {/* Monto principal que te entregan */}
            <div style={{ padding: "0.875rem 1rem", background: "var(--accent)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", marginBottom: "0.875rem" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>
                Dinero libre que recibirás en tu cuenta:
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                <div style={{ fontSize: "1.65rem", fontWeight: 800, color: proySeleccionada.esElegible ? "var(--success, #16a34a)" : "var(--fg)" }}>
                  {formatMoney(proySeleccionada.liquidoEstimado)}
                </div>
                {selectedOffset > 0 && gananciaVsHoy > 0 && (
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--success, #16a34a)", background: "rgba(22, 163, 74, 0.12)", padding: "0.15rem 0.5rem", borderRadius: "9999px" }}>
                    +{formatMoney(gananciaVsHoy)} más que hoy
                  </span>
                )}
              </div>
            </div>

            {/* Desglose paso a paso */}
            <div style={{ fontSize: "0.8125rem", color: "var(--fg)", background: "var(--accent)", padding: "0.75rem 0.875rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", marginBottom: "0.75rem" }}>
              <div style={{ fontWeight: 700, fontSize: "0.6875rem", color: "var(--muted)", marginBottom: "0.5rem", textTransform: "uppercase" }}>
                ¿Cómo se calcula este monto?
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0" }}>
                <span>1. Nuevo préstamo que solicitas a la Caja:</span>
                <strong style={{ color: "var(--fg)" }}>+{formatMoney(diag.importeNuevoEstimado)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0", color: "var(--error, #ef4444)" }}>
                <span>2. Menos lo que aún debes a esa quincena:</span>
                <strong>-{formatMoney(proySeleccionada.adeudoEstimado)}</strong>
              </div>
              <div style={{ height: "1px", background: "var(--border)", margin: "0.35rem 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.25rem 0", fontWeight: 800 }}>
                <span>= Dinero libre depositado en tu cuenta:</span>
                <span style={{ color: "var(--success, #16a34a)", fontSize: "0.9375rem" }}>
                  {formatMoney(proySeleccionada.liquidoEstimado)}
                </span>
              </div>
            </div>

            {/* Explicación en lenguaje natural */}
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.5 }}>
              {selectedOffset === 0 ? (
                <span>
                  <Lightbulb size={14} weight="fill" color="var(--primary)" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "0.25rem" }} />
                  <strong>En palabras sencillas:</strong> Si tramitas tu renovación hoy, la Caja utiliza tu nuevo préstamo para liquidar tu crédito anterior ({formatMoney(diag.adeudoHoy)}) y te entrega directamente la diferencia de <strong>{formatMoney(diag.liquidoHoy)}</strong> en tu cuenta bancaria.
                </span>
              ) : (
                <span>
                  <Lightbulb size={14} weight="fill" color="var(--primary)" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "0.25rem" }} />
                  <strong>En palabras sencillas:</strong> Si esperas a esta quincena ({proySeleccionada.quincenaTexto}), habrás dado <strong>{selectedOffset} abonos de nómina</strong>, con lo que tu ahorro crecerá a <strong>{formatMoney(proySeleccionada.ahorroEstimado)}</strong> y tu deuda bajará a <strong>{formatMoney(proySeleccionada.adeudoEstimado)}</strong>. Por eso te quedarán <strong>{formatMoney(gananciaVsHoy)} más</strong> de dinero libre que si renuevas hoy.
                  {proySeleccionada.esExtraordinaria && (
                    <span style={{ display: "block", marginTop: "0.35rem", color: "var(--success, #16a34a)", fontWeight: 600 }}>
                      <Sparkle size={13} weight="fill" color="var(--success, #16a34a)" style={{ display: "inline-block", verticalAlign: "middle", marginRight: "0.25rem" }} />
                      ¡Beneficio especial! En esta quincena se aplica tu {proySeleccionada.motivoExtraordinario}, el cual abona directamente a capital, bajando notablemente tu deuda y aumentando tu dinero libre a cobrar.
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Comparativa rápida quincena por quincena */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.35rem" }}>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)" }}>
              Comparativa rápida de próximas quincenas
            </div>
            <button
              type="button"
              onClick={() => setMostrarTodasLasQuincenas(!mostrarTodasLasQuincenas)}
              style={{
                background: "none",
                border: "none",
                color: "var(--primary)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {mostrarTodasLasQuincenas ? "Ver menos quincenas" : "Ver todas las quincenas del año"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {(mostrarTodasLasQuincenas
              ? diag.proyecciones
              : diag.proyecciones.filter((p) => [0, 1, 2, 4, 6, 8, 12, 18, 24].includes(p.quincenaOffset) || p.esExtraordinaria || p.quincenaOffset === diag.quincenasParaElegibilidad)
            ).map((p, idx) => {
              const isSelected = p.quincenaOffset === selectedOffset
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedOffset(p.quincenaOffset)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.5rem 0.75rem",
                    background: isSelected
                      ? "rgba(37, 99, 235, 0.12)"
                      : p.quincenaOffset === 0
                      ? "rgba(37, 99, 235, 0.05)"
                      : p.esExtraordinaria
                      ? "rgba(22, 163, 74, 0.05)"
                      : "var(--accent)",
                    border: isSelected
                      ? "1.5px solid var(--primary)"
                      : p.quincenaOffset === 0
                      ? "1px solid rgba(37, 99, 235, 0.25)"
                      : p.esExtraordinaria
                      ? "1px solid rgba(22, 163, 74, 0.25)"
                      : "1px solid transparent",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8125rem",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, color: "var(--fg)" }}>
                      {p.quincenaOffset === 0 ? `Hoy (${p.quincenaCodigo})` : `+${p.quincenaOffset} qnas (${p.quincenaCodigo})`}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      · {p.quincenaTexto}
                    </span>
                    {p.esExtraordinaria && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          background: "rgba(22, 163, 74, 0.12)",
                          color: "var(--success, #16a34a)",
                          border: "1px solid rgba(22, 163, 74, 0.3)",
                        }}
                      >
                        <Sparkle size={11} weight="fill" style={{ marginRight: "0.25rem" }} />
                        {p.motivoExtraordinario}
                      </span>
                    )}
                    {isSelected && (
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--primary)" }}>
                        (Seleccionada)
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: p.esElegible ? "var(--success, #16a34a)" : "var(--muted)" }}>
                      {formatMoney(p.liquidoEstimado)}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                      Dinero libre
                    </div>
                  </div>
                </div>
              )
            })}
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
