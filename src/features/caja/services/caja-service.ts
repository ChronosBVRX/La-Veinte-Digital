import type { RetiroTipo, SaldoPayload, AccountProfile, DateItem } from "@/lib/caja/models"
import type { CajaLoanInfo } from "@/informative"

export interface CajaSessionStatus {
  authenticated: boolean
  matricula?: string
  accountId?: string
  nombre?: string
  expiresAt?: number
}

export interface WithdrawRequestParams {
  tipo: RetiroTipo
  monto: number
  cuentaClabe: string
  concepto?: string
}

export async function getCajaSessionStatus(): Promise<CajaSessionStatus> {
  const res = await fetch("/api/caja/session")
  if (!res.ok) return { authenticated: false }
  return (await res.json()) as CajaSessionStatus
}

export class CajaLoginError extends Error {
  code?: string
  isSessionActive?: boolean
  status?: number

  constructor(message: string, code?: string, isSessionActive?: boolean, status?: number) {
    super(message)
    this.name = "CajaLoginError"
    this.code = code
    this.isSessionActive = isSessionActive
    this.status = status
  }
}

export class CajaSessionExpiredError extends Error {
  code = "session_expired"
  constructor(message = "Tu sesión en la Caja de Ahorro ha expirado. Por favor ingresa nuevamente.") {
    super(message)
    this.name = "CajaSessionExpiredError"
  }
}

export function isCajaSessionExpired(err: unknown): boolean {
  if (!err) return false
  if (err instanceof CajaSessionExpiredError) return true
  const e = err as { code?: string; status?: number; message?: string }
  const msg = e.message || ""
  return (
    e.code === "session_expired" ||
    e.code === "unauthenticated" ||
    e.status === 401 ||
    /(sesi[oó]n|token).*(expirad|inv[aá]l|cerrad)/i.test(msg) ||
    /unauthorized/i.test(msg)
  )
}

export async function loginCaja(matricula: string, password: string) {
  const res = await fetch("/api/caja/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matricula, password }),
  })
  const data = (await res.json()) as {
    ok?: boolean
    error?: string
    code?: string
    isSessionActive?: boolean
    matricula?: string
    profile?: AccountProfile
  }
  if (!res.ok || !data.ok) {
    throw new CajaLoginError(
      data.error || "Error al iniciar sesión en Caja de Ahorro",
      data.code,
      data.isSessionActive,
      res.status
    )
  }
  return data
}

export async function logoutCaja() {
  await fetch("/api/caja/logout", { method: "POST" })
}

export async function getCajaBalance(): Promise<SaldoPayload> {
  const res = await fetch("/api/caja/balance")
  const data = (await res.json()) as { ok?: boolean; balance?: SaldoPayload; error?: string; code?: string }
  if (res.status === 401 || data.code === "session_expired" || data.code === "unauthenticated") {
    throw new CajaSessionExpiredError(data.error || "Tu sesión en la Caja de Ahorro ha expirado")
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo obtener el saldo")
  }
  return data.balance || {}
}

export async function getCajaAccount(): Promise<AccountProfile> {
  const res = await fetch("/api/caja/account")
  const data = (await res.json()) as { ok?: boolean; profile?: AccountProfile; error?: string; code?: string }
  if (res.status === 401 || data.code === "session_expired" || data.code === "unauthenticated") {
    throw new CajaSessionExpiredError(data.error || "Tu sesión en la Caja de Ahorro ha expirado")
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo obtener la información de la cuenta")
  }
  return data.profile || {}
}

export async function getCajaLoans(): Promise<{ estimate: CajaLoanInfo | null; renewal: unknown }> {
  const res = await fetch("/api/caja/loans")
  const data = (await res.json()) as { ok?: boolean; estimate?: CajaLoanInfo; renewal?: unknown; error?: string; code?: string }
  if (res.status === 401 || data.code === "session_expired" || data.code === "unauthenticated") {
    throw new CajaSessionExpiredError(data.error || "Tu sesión en la Caja de Ahorro ha expirado")
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo consultar préstamos")
  }
  return {
    estimate: data.estimate || null,
    renewal: data.renewal ?? null,
  }
}

export async function renewCajaLoan(body: unknown = {}) {
  const res = await fetch("/api/caja/loans/renewal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo procesar la renovación")
  }
  return data
}

export async function requestCajaWithdraw(params: WithdrawRequestParams) {
  const res = await fetch("/api/caja/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string; banco?: string; cuentaClabe?: string }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo procesar el retiro")
  }
  return data
}

export async function getCajaDates(): Promise<DateItem[]> {
  const res = await fetch("/api/caja/dates")
  const data = (await res.json()) as { ok?: boolean; dates?: DateItem[]; error?: string; code?: string }
  if (res.status === 401 || data.code === "session_expired" || data.code === "unauthenticated") {
    throw new CajaSessionExpiredError(data.error || "Tu sesión en la Caja de Ahorro ha expirado")
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudieron consultar las citas")
  }
  return (data.dates as DateItem[]) || []
}

export async function requestCajaDate(delegacionId: number | string, body: unknown = {}) {
  const res = await fetch(`/api/caja/dates?delegacion=${encodeURIComponent(String(delegacionId))}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo agendar la cita")
  }
  return data
}

export async function cancelCajaDate(dateId: string | number) {
  const res = await fetch(`/api/caja/dates?dateId=${encodeURIComponent(String(dateId))}`, {
    method: "DELETE",
  })
  const data = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "No se pudo cancelar la cita")
  }
  return data
}
