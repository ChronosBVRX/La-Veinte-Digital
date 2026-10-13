export const CAJA_BASE_URL = "https://sicaapplw.cpaimss.com.mx/ws-cpa/api/v2/"
export const CAJA_TIMEOUT_MS = 30000

export interface CajaEnvelope<T> {
  status: "ok" | "error"
  code?: string
  message?: string
  payload?: T
  timestamp?: number
}

export interface ValidateMatriculaPayload {
  matricula?: string
  contrasenia?: boolean | string
  [k: string]: unknown
}

export interface LoginRequest {
  matricula: string
  password: string
}

export interface LoginPayload {
  authToken: string
  uiComponents?: unknown
  sessionTime?: number
  [k: string]: unknown
}

export interface TokenPayload {
  authToken: string
  [k: string]: unknown
}

export interface AccountProfile {
  nombre?: string
  paterno?: string
  materno?: string
  matricula?: string
  rfc?: string
  curp?: string
  celular?: string
  correo?: string
  delegacion?: string
  antiguedad?: string
  tipoCuenta?: string
  mensajeRenovacion?: string
  pantallas?: unknown
  hasInvoice?: boolean
  hasInvoiceUnread?: boolean
  [k: string]: unknown
}

export interface SaldoHistorico {
  mes?: string
  saldo?: number
}

export interface SaldoPayload {
  tipoCuenta?: string
  fechaConsultaSaldo?: string
  saldo?: number
  saldoAhorro?: number
  saldoPrestamo?: number
  saldoTotal?: number
  prestamoOtorgado?: number
  porcentaje?: number
  retiroLaboral?: number
  mes?: string
  quincena?: string
  historicos?: SaldoHistorico[]
  [k: string]: unknown
}

export type RetiroTipo = "TOTAL" | "PARCIAL" | "QUINCENAL"

export interface RetiroBody {
  monto?: number
  cuentaClabe?: string
  banco?: string
  concepto?: string
  [k: string]: unknown
}

export interface LoanEstimatePayload {
  montoMaximo?: number
  plazoQuincenas?: number
  pagoQuincenal?: number
  tasaInteres?: number
  [k: string]: unknown
}

export interface DateItem {
  id?: string | number
  fecha?: string
  hora?: string
  delegacion?: string
  motivo?: string
  estatus?: string
  [k: string]: unknown
}

export interface CajaApiError extends Error {
  httpStatus?: number
  code?: string
  apiMessage?: string
}
