/**
 * informative.ts
 *
 * Cliente y utilidades estrictamente informativas y referenciales para la Caja SNTSS.
 * Regla de Oro: Riesgo transaccional = 0 por construcción.
 * Solo expone peticiones GET y el logout liberador en servidor.
 * Ningún método PUT ni POST de operaciones financieras está importado ni implementado.
 */

import {
  CAJA_BASE_URL,
  CAJA_TIMEOUT_MS,
  type CajaApiError,
  type CajaEnvelope,
  type ValidateMatriculaPayload,
  type LoginPayload,
  type LoginRequest,
  type AccountProfile,
  type SaldoPayload,
  type DateItem,
} from "./lib/caja/models"

export interface CajaLoanInfo {
  abono_ahorro?: number
  abono_prestamo?: number
  importe_maximo?: number
  liquido_a_recibir?: number
  saldo_por_pagar?: number
  plazo_maximo?: number
  retencion_minima?: number
  periodo_retencion?: number | string
  [k: string]: unknown
}

export interface CajaFeeInfo {
  urlImagen?: string
  imagenTasa?: string
  [k: string]: unknown
}

export interface CajaInvoiceCurrents {
  periodo?: string
  url?: string
  urlRetiro?: string
  [k: string]: unknown
}

export interface CajaSnapshot {
  quincena: string
  fechaConsulta: string
  saldoTotal: number
  saldoAhorro: number
  saldoPrestamo: number
  prestamoOtorgado: number
  abonoAhorro: number
  abonoPrestamo: number
  saldoPorPagar: number
  timestamp: number
}

export type SemaforoNivel = "verde" | "amarillo" | "rojo"

export interface SemaforoResultado {
  nivel: SemaforoNivel
  ratio: number
  porcentaje: number
  label: string
  color: string
  descripcion: string
}

export interface ProyeccionResultado {
  saldoActual: number
  quincenas: number
  abonoQuincenal: number
  totalAportado: number
  rendimientoEstimado: number
  saldoEstimadoFinal: number
}

export interface ConciliacionConcepto {
  clave: string
  concepto: string
  importe: number
}

export interface ConciliacionResultado {
  coincide: boolean
  diferencia: number
  abonoCaja: number
  descuentoNomina: number
  detalle: string
}

export const SALDO_MINIMO_DEFAULT = 600

/**
 * Calcula el adeudo actual neto:
 * Adeudo = saldoPrestamo − (saldoAhorro − saldoMinimo)
 * Verificado con muestra real: 185,034.33 − (52,108.23 − 600) = 133,526.10 exacto.
 */
export function adeudoActual(
  saldoPrestamo: number,
  saldoAhorro: number,
  saldoMinimo = SALDO_MINIMO_DEFAULT,
): number {
  const prestamo = Math.max(0, saldoPrestamo || 0)
  const ahorroDisponible = Math.max(0, (saldoAhorro || 0) - saldoMinimo)
  const adeudo = prestamo - ahorroDisponible
  return Math.round(Math.max(0, adeudo) * 100) / 100
}

/**
 * Calcula el líquido a recibir estimado:
 * Líquido = Math.max(0, importeMaximo − adeudo)
 * Verificado con muestra real: 186,000 − 133,526.10 = 52,473.90 exacto.
 */
export function liquidoARecibir(importeMaximo: number, adeudo: number): number {
  const maximo = Math.max(0, importeMaximo || 0)
  const adeudoNeto = Math.max(0, adeudo || 0)
  return Math.round(Math.max(0, maximo - adeudoNeto) * 100) / 100
}

export const UMBRAL_RENOVACION_HIPOTESIS = 20

/**
 * Calcula la cobertura colateral estimada de ahorro sobre el préstamo:
 * Cobertura = floor((saldoAhorro - saldoMinimo) / prestamoOtorgado * 100)
 * Verificado con muestra: floor((52108.23 - 600) / 186000 * 100) = 27
 */
export function coberturaColateralEstimada(
  saldoAhorro: number,
  prestamoOtorgado: number,
  saldoMinimo = SALDO_MINIMO_DEFAULT,
): number {
  const ahorroDisp = Math.max(0, (saldoAhorro || 0) - saldoMinimo)
  const prestamo = Math.max(0, prestamoOtorgado || 0)
  if (prestamo === 0) return 0
  return Math.floor((ahorroDisp / prestamo) * 100)
}

export interface ElegibilidadRenovacionResultado {
  elegible: boolean
  verificado: boolean
  porcentaje: number
  motivo: string
}

/**
 * Evalúa la elegibilidad para renovación como estimación referencial.
 * Devuelve siempre verificado: false por diseño hasta calibrar con 3+ snapshots.
 */
export function elegibilidadRenovacionEstimada(
  porcentaje?: number | null,
  mensajeRenovacion?: string | null,
): ElegibilidadRenovacionResultado {
  const pct = Number(porcentaje ?? 0)
  const tieneMensaje = Boolean(mensajeRenovacion && /renov/i.test(mensajeRenovacion))
  const elegible = pct >= UMBRAL_RENOVACION_HIPOTESIS || tieneMensaje

  return {
    elegible,
    verificado: false,
    porcentaje: pct,
    motivo: elegible
      ? `Estimación referencial: Con ${pct}% de cobertura (umbral hipótesis ≥${UMBRAL_RENOVACION_HIPOTESIS}%), la cuenta parece calificar para trámite de renovación. Consulta con tu delegación sindical.`
      : `Estimación referencial: Con ${pct}% de cobertura, aún no alcanzaría el umbral de renovación estimado (≥${UMBRAL_RENOVACION_HIPOTESIS}%).`,
  }
}

/** Alias retrocompatible de elegibilidad */
export function esElegibleRenovacion(
  porcentaje?: number | null,
  mensajeRenovacion?: string | null,
): { elegible: boolean; porcentaje: number; motivo: string } {
  const res = elegibilidadRenovacionEstimada(porcentaje, mensajeRenovacion)
  return {
    elegible: res.elegible,
    porcentaje: res.porcentaje,
    motivo: res.motivo,
  }
}

export interface DesgloseDescuentoResultado {
  total: number
  capital: number | null
  interes: number | null
}

/**
 * Desglosa el descuento quincenal.
 * Exige capitalDelPeriodo para no asumir arbitrariamente número de pagos sin histórico verificado.
 */
export function desgloseDescuentoEstimado(
  abonoPrestamo: number,
  capitalDelPeriodo?: number,
): DesgloseDescuentoResultado {
  const total = Number(abonoPrestamo || 0)
  if (capitalDelPeriodo === undefined) {
    return {
      total,
      capital: null,
      interes: null,
    }
  }
  const capital = Math.max(0, capitalDelPeriodo)
  const interes = Math.round(Math.max(0, total - capital) * 100) / 100
  return {
    total,
    capital,
    interes,
  }
}

const MESES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

/**
 * Formatea una quincena en formato "AAAA/QQ" a texto legible.
 * Ej: "2026/09" -> "1ª de Mayo 2026"
 */
export function formatQuincena(quincenaStr?: string | null): string {
  if (!quincenaStr) return "Quincena actual"
  const parts = String(quincenaStr).trim().split("/")
  if (parts.length !== 2) return quincenaStr
  const anio = parseInt(parts[0], 10)
  const qNum = parseInt(parts[1], 10)
  if (Number.isNaN(anio) || Number.isNaN(qNum) || qNum < 1 || qNum > 24) return quincenaStr

  const mesIdx = Math.floor((qNum - 1) / 2)
  const mitad = qNum % 2 === 1 ? "1ª" : "2ª"
  const mesNombre = MESES_NOMBRES[mesIdx] || ""

  return `${mitad} de ${mesNombre} ${anio}`
}

/**
 * Determina el código de quincena en formato "AAAA/QQ" a partir de una fecha.
 * Cada mes consta de 2 quincenas:
 * - Días 1 al 15: 1ª quincena (índice: (mes - 1) * 2 + 1)
 * - Días 16 en adelante: 2ª quincena (índice: mes * 2)
 *
 * Acepta strings en formato "DD/MM/AAAA", "AAAA-MM-DD", instancias de Date o vacío (usa fecha de hoy).
 */
export function getQuincenaFromDate(dateInput?: Date | string | null): string {
  let d = new Date()

  if (typeof dateInput === "string" && dateInput.trim().length > 0) {
    const trimmed = dateInput.trim()
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    const yyyymmdd = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/)

    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10)
      const month = parseInt(ddmmyyyy[2], 10) - 1
      const year = parseInt(ddmmyyyy[3], 10)
      d = new Date(year, month, day)
    } else if (yyyymmdd) {
      const year = parseInt(yyyymmdd[1], 10)
      const month = parseInt(yyyymmdd[2], 10) - 1
      const day = parseInt(yyyymmdd[3], 10)
      d = new Date(year, month, day)
    } else {
      const parsed = new Date(trimmed)
      if (!isNaN(parsed.getTime())) d = parsed
    }
  } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    d = dateInput
  }

  const anio = d.getFullYear()
  const mes = d.getMonth() + 1 // 1..12
  const dia = d.getDate()
  const qNum = dia <= 15 ? (mes - 1) * 2 + 1 : mes * 2

  return `${anio}/${String(qNum).padStart(2, "0")}`
}

/**
 * Suma un número de quincenas a una fecha de quincena "AAAA/QQ".
 */
export function sumarQuincenas(quincenaStr?: string | null, delta = 0): string {
  const parts = String(quincenaStr || "").trim().split("/")
  let anio = parseInt(parts[0], 10)
  let qNum = parseInt(parts[1], 10)

  if (Number.isNaN(anio) || Number.isNaN(qNum) || qNum < 1 || qNum > 24) {
    const qDefault = getQuincenaFromDate()
    const partsDef = qDefault.split("/")
    anio = parseInt(partsDef[0], 10)
    qNum = parseInt(partsDef[1], 10)
  }

  const totalQ = (anio * 24) + (qNum - 1) + delta
  const nuevoAnio = Math.floor(totalQ / 24)
  const modQ = ((totalQ % 24) + 24) % 24
  const nuevoQ = modQ + 1

  return `${nuevoAnio}/${String(nuevoQ).padStart(2, "0")}`
}

/**
 * Evalúa si una quincena corresponde a periodos de retención extraordinaria contractual SNTSS:
 * - Quincena 14 (2ª de Julio: retención semestral)
 * - Quincena 23 (1ª de Diciembre: Aguinaldo IMSS)
 */
export function esQuincenaRetencionExtraordinaria(quincenaCodigo: string): {
  aplica: boolean
  tipo?: "julio" | "aguinaldo"
  etiqueta?: string
} {
  const parts = String(quincenaCodigo || "").trim().split("/")
  if (parts.length !== 2) return { aplica: false }
  const qNum = parseInt(parts[1], 10)
  if (qNum === 14) {
    return { aplica: true, tipo: "julio", etiqueta: "2ª de Julio" }
  }
  if (qNum === 23) {
    return { aplica: true, tipo: "aguinaldo", etiqueta: "Aguinaldo" }
  }
  return { aplica: false }
}

export interface DiagnosticoRenovacionParams {
  saldoPrestamo: number
  saldoAhorro: number
  prestamoOtorgado: number
  porcentajeActual?: number | null
  abonoAhorro?: number | null
  abonoPrestamo?: number | null
  importeMaximo?: number | null
  retencionExtraordinaria?: number | null
  periodoRetencion?: string | number | null
  quincenaActual?: string | null
  quincenaOtorgamiento?: string | null
  fechaConsulta?: string | null
  saldoMinimo?: number
  horizonteQuincenas?: number
}

export interface ProyeccionQuincenaRenovacion {
  quincenaOffset: number
  quincenaCodigo: string
  quincenaTexto: string
  ahorroEstimado: number
  adeudoEstimado: number
  porcentajeEstimado: number
  liquidoEstimado: number
  esElegible: boolean
  esExtraordinaria?: boolean
  motivoExtraordinario?: string
  montoExtraordinario?: number
}

export interface DiagnosticoRenovacionResultado {
  elegibleHoy: boolean
  porcentajeActual: number
  quincenaActual: string
  quincenaActualTexto: string
  quincenaOtorgamiento?: string
  quincenaOtorgamientoTexto?: string
  quincenasParaElegibilidad: number
  quincenaEstimadaElegibilidad: string
  quincenaEstimadaTexto: string
  liquidoHoy: number
  adeudoHoy: number
  importeNuevoEstimado: number
  proyecciones: ProyeccionQuincenaRenovacion[]
}

/**
 * Genera el diagnóstico y proyección de renovación de préstamo sindical:
 * - Determina si la cuenta es elegible hoy (cobertura >= 20%).
 * - Si no es elegible, calcula en qué quincena y fecha aproximada alcanzará el umbral.
 * - Proyecta el monto líquido que recibirá en su cuenta bancaria hoy y en quincenas futuras.
 * - Integra las retenciones extraordinarias semestrales (2ª de Julio y Aguinaldo en Diciembre) si aplican.
 */
export function diagnosticoRenovacion(params: DiagnosticoRenovacionParams): DiagnosticoRenovacionResultado {
  const {
    saldoPrestamo,
    saldoAhorro,
    prestamoOtorgado,
    porcentajeActual,
    abonoAhorro,
    abonoPrestamo,
    importeMaximo,
    retencionExtraordinaria,
    quincenaActual,
    quincenaOtorgamiento,
    fechaConsulta,
    saldoMinimo = SALDO_MINIMO_DEFAULT,
    horizonteQuincenas,
  } = params

  const prestamoOriginal = Math.max(0, prestamoOtorgado || 0)
  const nuevoImporte = Math.max(0, importeMaximo || prestamoOriginal || 0)

  // Cobertura colateral base
  const coberturaCalculada = coberturaColateralEstimada(saldoAhorro, prestamoOriginal, saldoMinimo)
  const coberturaBase = typeof porcentajeActual === "number" && porcentajeActual > 0
    ? porcentajeActual
    : coberturaCalculada

  const adeudoHoy = adeudoActual(saldoPrestamo, saldoAhorro, saldoMinimo)
  const liquidoHoy = liquidoARecibir(nuevoImporte, adeudoHoy)

  const elegibleHoy = coberturaBase >= UMBRAL_RENOVACION_HIPOTESIS

  // Aportación quincenal al fondo de ahorro: por regla SNTSS es 2% del préstamo
  const ahorroPorQuincena = abonoAhorro && abonoAhorro > 0 ? abonoAhorro : Math.round(prestamoOriginal * 0.02)

  // Amortización estimada a capital por quincena (~67% del abono al préstamo en créditos amortizando)
  const capitalPorQuincena = abonoPrestamo && abonoPrestamo > 0 ? Math.round(abonoPrestamo * 0.67) : 0

  const montoExtraordinario = Math.max(0, Number(retencionExtraordinaria || 0))

  const qDefault = getQuincenaFromDate(fechaConsulta)
  const qActual = quincenaActual || qDefault
  const qOtorgamiento = quincenaOtorgamiento || undefined
  const qOtorgamientoTexto = qOtorgamiento ? formatQuincena(qOtorgamiento) : undefined

  // Calcular quincenas faltantes si no es elegible hoy
  let quincenasParaElegibilidad = 0
  if (!elegibleHoy && prestamoOriginal > 0) {
    const incrementoPctPorQuincena = (ahorroPorQuincena / prestamoOriginal) * 100
    const pctFaltante = Math.max(0, UMBRAL_RENOVACION_HIPOTESIS - coberturaBase)
    quincenasParaElegibilidad = incrementoPctPorQuincena > 0
      ? Math.ceil(pctFaltante / incrementoPctPorQuincena)
      : 0
  }

  const qElegible = sumarQuincenas(qActual, quincenasParaElegibilidad)

  // Horizonte de proyección quincenal (24 quincenas = 1 año completo por defecto)
  const maxHorizonte = horizonteQuincenas !== undefined ? Math.max(0, horizonteQuincenas) : 24
  const offsetsSet = new Set<number>()
  for (let delta = 0; delta <= maxHorizonte; delta++) {
    offsetsSet.add(delta)
  }
  if (quincenasParaElegibilidad > 0) {
    offsetsSet.add(quincenasParaElegibilidad)
  }

  // Si hay retención extraordinaria (ej. Jul-Dic), asegurar que cualquier quincena especial en el horizonte esté presente
  if (montoExtraordinario > 0) {
    for (let delta = 1; delta <= Math.max(24, maxHorizonte); delta++) {
      const q = sumarQuincenas(qActual, delta)
      const extra = esQuincenaRetencionExtraordinaria(q)
      if (extra.aplica) {
        offsetsSet.add(delta)
      }
    }
  }

  const offsets = Array.from(offsetsSet).sort((a, b) => a - b)

  const proyecciones: ProyeccionQuincenaRenovacion[] = offsets.map((offset) => {
    const qCod = sumarQuincenas(qActual, offset)

    // Sumar retenciones extraordinarias ocurridas estrictamente entre offset 1 y este offset
    let extraAcumulado = 0
    if (montoExtraordinario > 0) {
      for (let k = 1; k <= offset; k++) {
        const qPaso = sumarQuincenas(qActual, k)
        const check = esQuincenaRetencionExtraordinaria(qPaso)
        if (check.aplica) {
          extraAcumulado += montoExtraordinario
        }
      }
    }

    const checkActual = esQuincenaRetencionExtraordinaria(qCod)
    const esExtra = offset > 0 && checkActual.aplica && montoExtraordinario > 0
    const motivoExtra = esExtra
      ? `Retención ${checkActual.etiqueta} (+${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(montoExtraordinario)})`
      : undefined

    const capitalOrdinarioAcumulado = capitalPorQuincena * offset
    const reduccionCapitalTotal = capitalOrdinarioAcumulado + extraAcumulado

    const saldoPrestamoNeto = saldoPrestamo - reduccionCapitalTotal
    const prestamoFuturo = Math.max(0, Math.round(saldoPrestamoNeto * 100) / 100)
    const remanenteAhorro = saldoPrestamoNeto < 0 ? Math.abs(saldoPrestamoNeto) : 0
    const ahorroFuturo = Math.round((saldoAhorro + (ahorroPorQuincena * offset) + remanenteAhorro) * 100) / 100

    const adeudoFuturo = adeudoActual(prestamoFuturo, ahorroFuturo, saldoMinimo)
    const liquidoFuturo = liquidoARecibir(nuevoImporte, adeudoFuturo)
    const pctFuturo = coberturaColateralEstimada(ahorroFuturo, prestamoOriginal, saldoMinimo)

    return {
      quincenaOffset: offset,
      quincenaCodigo: qCod,
      quincenaTexto: formatQuincena(qCod),
      ahorroEstimado: ahorroFuturo,
      adeudoEstimado: adeudoFuturo,
      porcentajeEstimado: pctFuturo,
      liquidoEstimado: liquidoFuturo,
      esElegible: pctFuturo >= UMBRAL_RENOVACION_HIPOTESIS,
      esExtraordinaria: esExtra,
      motivoExtraordinario: motivoExtra,
      montoExtraordinario: esExtra ? montoExtraordinario : undefined,
    }
  })

  return {
    elegibleHoy,
    porcentajeActual: coberturaBase,
    quincenaActual: qActual,
    quincenaActualTexto: formatQuincena(qActual),
    quincenaOtorgamiento: qOtorgamiento,
    quincenaOtorgamientoTexto: qOtorgamientoTexto,
    quincenasParaElegibilidad,
    quincenaEstimadaElegibilidad: qElegible,
    quincenaEstimadaTexto: formatQuincena(qElegible),
    liquidoHoy,
    adeudoHoy,
    importeNuevoEstimado: nuevoImporte,
    proyecciones,
  }
}

/**
 * Proyecta la renovación de préstamo para un número específico de quincenas hacia adelante.
 */
export function proyectarRenovacionParaQuincena(
  params: DiagnosticoRenovacionParams,
  offsetQuincenas: number,
): ProyeccionQuincenaRenovacion {
  const diag = diagnosticoRenovacion({
    ...params,
    horizonteQuincenas: Math.max(offsetQuincenas, 24),
  })
  return (
    diag.proyecciones.find((p) => p.quincenaOffset === offsetQuincenas) ||
    diag.proyecciones[0]
  )
}

/**
 * Evalúa si un error devuelto por invoices/{mat}/currents corresponde
 * a la ausencia de estados de cuenta vigentes (404 o código 1401) y no a un fallo real.
 */
export function isEmptyCurrents(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { httpStatus?: number; code?: string; message?: string; apiMessage?: string }
  if (e.httpStatus === 404 || e.code === "1401" || e.code === "404") return true
  const msg = (e.apiMessage || e.message || "").toLowerCase()
  return msg.includes("no se encontraron") || msg.includes("sin registros") || msg.includes("no existe")
}

/**
 * Semáforo de salud financiera sindical.
 * Compara el saldo de préstamo contra el saldo de ahorro:
 * - Verde: ratio < 0.3 (Menos del 30% comprometido)
 * - Amarillo: ratio < 0.6 (Entre 30% y 60% comprometido)
 * - Rojo: ratio >= 0.6 (Más del 60% comprometido)
 */
export function semaforo(saldoPrestamo: number, saldoAhorro: number): SemaforoResultado {
  const ahorro = Math.max(0, saldoAhorro || 0)
  const prestamo = Math.max(0, saldoPrestamo || 0)

  let ratio = 0
  if (ahorro > 0) {
    ratio = prestamo / ahorro
  } else if (prestamo > 0) {
    ratio = 1
  }

  const porcentaje = Math.round(ratio * 100)

  if (ratio < 0.3) {
    return {
      nivel: "verde",
      ratio,
      porcentaje,
      label: "Saludable",
      color: "#16a34a",
      descripcion: "Excelente balance. Menos del 30% de tu fondo de ahorro está comprometido en deuda.",
    }
  }

  if (ratio < 0.6) {
    return {
      nivel: "amarillo",
      ratio,
      porcentaje,
      label: "Moderado",
      color: "#ca8a04",
      descripcion: "Compromiso moderado. Entre el 30% y el 60% de tu ahorro respalda saldos por pagar.",
    }
  }

  return {
    nivel: "rojo",
    ratio,
    porcentaje,
    label: "Atención",
    color: "#dc2626",
    descripcion: "Compromiso alto. Más del 60% de tu patrimonio en Caja se encuentra comprometido.",
  }
}

/**
 * Construye una instantánea (snapshot) estructurada a partir del balance y los datos de préstamo.
 */
export function buildSnapshot(balance?: SaldoPayload | null, loan?: CajaLoanInfo | null): CajaSnapshot {
  const now = new Date()
  const fechaConsulta = balance?.fechaConsultaSaldo || now.toISOString().split("T")[0]
  const quincena = balance?.quincena || getQuincenaFromDate(fechaConsulta)

  return {
    quincena,
    fechaConsulta,
    saldoTotal: balance?.saldoTotal ?? balance?.saldo ?? 0,
    saldoAhorro: balance?.saldoAhorro ?? 0,
    saldoPrestamo: balance?.saldoPrestamo ?? 0,
    prestamoOtorgado: balance?.prestamoOtorgado ?? 0,
    abonoAhorro: Number(loan?.abono_ahorro ?? 0),
    abonoPrestamo: Number(loan?.abono_prestamo ?? 0),
    saldoPorPagar: Number(loan?.saldo_por_pagar ?? balance?.saldoPrestamo ?? 0),
    timestamp: Date.now(),
  }
}

/**
 * Simula la proyección de ahorro futuro con base en aportaciones quincenales y tasa anual de dividendos.
 */
export function proyectarAhorro(params: {
  saldoActual: number
  abonoQuincenal: number
  quincenas: number
  tasaAnualEstimada?: number
}): ProyeccionResultado {
  const { saldoActual, abonoQuincenal, quincenas, tasaAnualEstimada = 8.0 } = params
  const tasaQuincenal = tasaAnualEstimada / 100 / 24

  let saldo = Math.max(0, saldoActual)
  const totalAportado = Math.max(0, abonoQuincenal) * quincenas

  for (let i = 0; i < quincenas; i++) {
    saldo += abonoQuincenal
    saldo += saldo * tasaQuincenal
  }

  const saldoEstimadoFinal = Math.round(saldo * 100) / 100
  const rendimientoEstimado = Math.round(Math.max(0, saldoEstimadoFinal - saldoActual - totalAportado) * 100) / 100

  return {
    saldoActual,
    quincenas,
    abonoQuincenal,
    totalAportado,
    rendimientoEstimado,
    saldoEstimadoFinal,
  }
}

/**
 * Concilia el abono registrado en Caja contra los conceptos de deducción del tarjetón de nómina IMSS.
 */
export function conciliarConTarjeton(
  snapshot: CajaSnapshot,
  conceptosNomina: ConciliacionConcepto[] = [],
): ConciliacionResultado {
  // Claves comunes de Caja / Fondo de Ahorro en tarjetón IMSS (ej. 011, 050, 063)
  const match = conceptosNomina.find(
    (c) =>
      c.clave === "011" ||
      c.clave === "050" ||
      /caja.*ahorro/i.test(c.concepto) ||
      /fondo.*ahorro/i.test(c.concepto),
  )

  const descuentoNomina = match ? match.importe : 0
  const abonoCaja = snapshot.abonoAhorro
  const diferencia = Math.abs(abonoCaja - descuentoNomina)

  if (!match) {
    return {
      coincide: false,
      diferencia: abonoCaja,
      abonoCaja,
      descuentoNomina: 0,
      detalle: "No se localizó concepto de deducción de Caja de Ahorro en el último tarjetón importado.",
    }
  }

  const coincide = diferencia < 1.0 // Tolerancia de redondeo de $1 MXN
  return {
    coincide,
    diferencia,
    abonoCaja,
    descuentoNomina,
    detalle: coincide
      ? `Conciliación exacta: Descuento en tarjetón ($${descuentoNomina.toFixed(2)}) coincide con tu abono en Caja ($${abonoCaja.toFixed(2)}).`
      : `Discrepancia detectada: Descuento en nómina ($${descuentoNomina.toFixed(2)}) difiere de aportación en Caja ($${abonoCaja.toFixed(2)}).`,
  }
}

/**
 * Cliente de lectura estricta y exclusiva para la Caja SNTSS (CajaReadOnly).
 * Garantiza por diseño cero operaciones de modificación financiera (sin PUT/POST transaccionales).
 */
export class CajaReadOnly {
  private baseUrl: string
  private timeoutMs: number
  private getToken?: () => string | undefined | Promise<string | undefined>
  private fetchImpl: typeof fetch

  constructor(opts: {
    baseUrl?: string
    timeoutMs?: number
    getToken?: () => string | undefined | Promise<string | undefined>
    fetchImpl?: typeof fetch
  } = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.CAJA_BASE_URL ?? CAJA_BASE_URL).replace(/\/?$/, "/")
    this.timeoutMs = opts.timeoutMs ?? CAJA_TIMEOUT_MS
    this.getToken = opts.getToken
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    opts: { body?: unknown; auth?: boolean } = {},
  ): Promise<CajaEnvelope<T>> {
    const headers: Record<string, string> = { accept: "application/json" }
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    if (opts.auth !== false && this.getToken) {
      const tok = await this.getToken()
      if (tok) {
        headers["authorization"] = `Bearer ${tok}`
      }
    }

    const cleanPath = path.replace(/^\//, "")
    const fullUrl = this.baseUrl + cleanPath

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)

    try {
      const res = await this.fetchImpl(fullUrl, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      })

      let json: CajaEnvelope<T> | null = null
      try {
        json = (await res.json()) as CajaEnvelope<T>
      } catch {
        json = null
      }

      if (!res.ok) {
        const err = new Error(json?.message || `HTTP ${res.status} en ${method} ${path}`) as CajaApiError
        err.httpStatus = res.status
        err.code = json?.code
        err.apiMessage = json?.message
        throw err
      }

      return (json ?? { status: "ok" as const }) as CajaEnvelope<T>
    } finally {
      clearTimeout(timer)
    }
  }

  // 1. Preflight sin auth
  validateMatricula(matricula: string) {
    return this.request<ValidateMatriculaPayload>("GET", `users/validate/${encodeURIComponent(matricula.trim())}`, {
      auth: false,
    })
  }

  // 2. Login para obtener token
  login(body: LoginRequest) {
    return this.request<LoginPayload>("POST", "login", {
      body: {
        matricula: body.matricula.trim(),
        password: body.password,
      },
      auth: false,
    })
  }

  // 3. Consultas con Bearer token
  getAccount(matricula: string) {
    return this.request<AccountProfile>("GET", `accounts/${encodeURIComponent(matricula.trim())}`)
  }

  getBalance(matricula: string) {
    return this.request<SaldoPayload>("GET", `accounts/${encodeURIComponent(matricula.trim())}/balance`)
  }

  getLoan(matricula: string) {
    return this.request<CajaLoanInfo>("GET", `accounts/${encodeURIComponent(matricula.trim())}/loan`)
  }

  getFee(matricula: string) {
    return this.request<CajaFeeInfo>("GET", `accounts/${encodeURIComponent(matricula.trim())}/fee`)
  }

  getDistricts(matricula: string) {
    return this.request<unknown>("GET", `accounts/${encodeURIComponent(matricula.trim())}/dates/districts`)
  }

  getDates() {
    return this.request<{ agendadas?: DateItem[]; [k: string]: unknown }>("GET", "dates")
  }

  async getCurrentInvoices(matricula: string): Promise<CajaInvoiceCurrents | null> {
    try {
      const res = await this.request<CajaInvoiceCurrents>("GET", `invoices/${encodeURIComponent(matricula.trim())}/currents`)
      return res.payload || null
    } catch (err: unknown) {
      if (isEmptyCurrents(err)) {
        return null
      }
      throw err
    }
  }

  getNoticeCount(noticeId: string) {
    return this.request<{ count?: number; unread?: number }>("GET", `notices/${encodeURIComponent(noticeId)}/count`)
  }

  // 4. Logout en servidor para liberar sesión
  logoutServer(matricula: string) {
    return this.request<unknown>("GET", `logout/${encodeURIComponent(matricula.trim())}`)
  }
}
