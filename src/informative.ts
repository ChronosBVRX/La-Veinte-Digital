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

/**
 * Determina la elegibilidad para renovación de préstamo sindical:
 * Criterio preliminar: porcentaje de avance >= 25% o mensaje de renovación explícito.
 */
export function esElegibleRenovacion(
  porcentaje?: number | null,
  mensajeRenovacion?: string | null,
): { elegible: boolean; porcentaje: number; motivo: string } {
  const pct = Number(porcentaje ?? 0)
  const tieneMensaje = Boolean(mensajeRenovacion && /renov/i.test(mensajeRenovacion))
  const elegible = pct >= 25 || tieneMensaje

  return {
    elegible,
    porcentaje: pct,
    motivo: elegible
      ? `Ya puedes renovar: Has cubierto el ${pct}% del préstamo (requisito mínimo: 25%). Puedes iniciar el trámite presencial ante tu delegación sindical.`
      : `En amortización: Llevas ${pct}% de avance. Se requiere al menos 25% para solicitar una nueva renovación ante la Caja SNTSS.`,
  }
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
  const quincena = balance?.quincena || `${now.getFullYear()}/${String(Math.ceil((now.getMonth() + 1) * 2)).padStart(2, "0")}`
  const fechaConsulta = balance?.fechaConsultaSaldo || now.toISOString().split("T")[0]

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
