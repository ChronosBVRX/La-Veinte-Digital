import {
  CAJA_BASE_URL,
  CAJA_TIMEOUT_MS,
  type CajaApiError,
  type CajaEnvelope,
  type LoginPayload,
  type LoginRequest,
  type RetiroBody,
  type SaldoPayload,
  type TokenPayload,
  type ValidateMatriculaPayload,
  type AccountProfile,
  type DateItem,
} from "./models"

export interface CajaClientOptions {
  baseUrl?: string
  timeoutMs?: number
  getToken?: () => string | undefined | Promise<string | undefined>
  fetchImpl?: typeof fetch
}

function makeError(httpStatus: number, body: CajaEnvelope<unknown> | null, fallback: string): CajaApiError {
  const err = new Error(body?.message || fallback) as CajaApiError
  err.httpStatus = httpStatus
  err.code = body?.code
  err.apiMessage = body?.message
  return err
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

function waitMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Cliente HTTP para el API de Caja de Previsión y Ahorro SNTSS.
 * Base: https://sicaapplw.cpaimss.com.mx/ws-cpa/api/v2/
 * Auth: header `authorization: Bearer <authToken>`
 */
export class CajaClient {
  private baseUrl: string
  private timeoutMs: number
  private getToken?: CajaClientOptions["getToken"]
  private fetchImpl: typeof fetch

  constructor(opts: CajaClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.CAJA_BASE_URL ?? CAJA_BASE_URL).replace(/\/?$/, "/")
    this.timeoutMs = opts.timeoutMs ?? CAJA_TIMEOUT_MS
    this.getToken = opts.getToken
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    opts: { body?: unknown; auth?: boolean; retries?: number } = {},
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

    let attempts = 0
    const maxRetries = opts.retries ?? 1

    while (attempts <= maxRetries) {
      attempts++
      let res: Response
      try {
        res = await fetchWithTimeout(
          this.fetchImpl,
          fullUrl,
          {
            method,
            headers,
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          },
          this.timeoutMs,
        )
      } catch (networkErr: unknown) {
        if (attempts <= maxRetries) {
          await waitMs(1000 * attempts)
          continue
        }
        const err = new Error(
          networkErr instanceof Error ? networkErr.message : "Error de red al consultar Caja SNTSS",
        ) as CajaApiError
        err.httpStatus = 503
        throw err
      }

      // Si el WAF o API responde 429 (Too Many Requests), esperar y reintentar una sola vez con backoff
      if (res.status === 429 && attempts <= maxRetries) {
        await waitMs(2000 * attempts)
        continue
      }

      // Códigos 401, 403, 404 NUNCA se reintentan en bucle para evitar baneo del WAF
      let json: CajaEnvelope<T> | null = null
      try {
        json = (await res.json()) as CajaEnvelope<T>
      } catch {
        json = null
      }

      if (!res.ok) {
        throw makeError(res.status, json, `HTTP ${res.status} en ${method} ${path}`)
      }

      return (json ?? { status: "ok" as const }) as CajaEnvelope<T>
    }

    throw new Error(`Excedido número de reintentos para ${method} ${path}`) as CajaApiError
  }

  // ---------- Auth / usuarios (sin token) ----------

  /** GET users/validate/{matricula} — verifica si la matrícula existe en la Caja */
  validateMatricula(matricula: string) {
    return this.request<ValidateMatriculaPayload>("GET", `users/validate/${encodeURIComponent(matricula.trim())}`, {
      auth: false,
      retries: 0,
    })
  }

  /** POST login — body {matricula, password}. Devuelve payload.authToken */
  login(body: LoginRequest) {
    return this.request<LoginPayload>("POST", "login", {
      body: {
        matricula: body.matricula.trim(),
        password: body.password,
      },
      auth: false,
      retries: 0,
    })
  }

  /** POST users/{matricula}/password?rfc={rfc} — recuperación con RFC */
  recoverWithRfc(matricula: string, rfc: string, body: unknown = {}) {
    return this.request<unknown>(
      "POST",
      `users/${encodeURIComponent(matricula.trim())}/password?rfc=${encodeURIComponent(rfc.trim().toUpperCase())}`,
      { body, auth: false, retries: 0 },
    )
  }

  /** POST users/{matricula}/token/{codigo} — valida código de verificación */
  verifyCode(matricula: string, codigo: string, body: unknown = {}) {
    return this.request<TokenPayload>(
      "POST",
      `users/${encodeURIComponent(matricula.trim())}/token/${encodeURIComponent(codigo.trim())}`,
      { body, auth: false, retries: 0 },
    )
  }

  // ---------- Cuenta (requiere token Bearer) ----------

  /** GET accounts/{id} — perfil del afiliado */
  getAccount(accountId: string) {
    return this.request<AccountProfile>("GET", `accounts/${encodeURIComponent(accountId)}`, { retries: 0 })
  }

  /** GET accounts/{id}/balance — saldos de ahorro y préstamos */
  getBalance(accountId: string) {
    return this.request<SaldoPayload>("GET", `accounts/${encodeURIComponent(accountId)}/balance`, { retries: 0 })
  }

  /** GET accounts/{id}/loan — estimación de préstamo */
  getLoanEstimate(accountId: string) {
    return this.request<unknown>("GET", `accounts/${encodeURIComponent(accountId)}/loan`, { retries: 0 })
  }

  /** POST accounts/{id}/loan/renewal — solicitud de renovación de préstamo */
  // TODO: verificar body exacto con captura mitmproxy (~/caja_captures/)
  renewLoan(accountId: string, body: unknown = {}) {
    return this.request<unknown>("POST", `accounts/${encodeURIComponent(accountId)}/loan/renewal`, { body, retries: 0 })
  }

  /** GET accounts/{id}/loan/renewal — consulta estado de renovación */
  getLoanRenewal(accountId: string) {
    return this.request<unknown>("GET", `accounts/${encodeURIComponent(accountId)}/loan/renewal`, { retries: 0 })
  }

  /** PUT accounts/{id}/balance/pwithdraw — retiro parcial */
  // TODO: verificar body exacto con captura mitmproxy (~/caja_captures/)
  withdrawPartial(accountId: string, body: RetiroBody) {
    return this.request<unknown>("PUT", `accounts/${encodeURIComponent(accountId)}/balance/pwithdraw`, { body, retries: 0 })
  }

  /** GET accounts/{id}/balance/pwithdraw — consulta retiro parcial */
  getWithdrawPartial(accountId: string) {
    return this.request<unknown>("GET", `accounts/${encodeURIComponent(accountId)}/balance/pwithdraw`, { retries: 0 })
  }

  /** PUT accounts/{id}/balance/withdraw — retención única / retiro total */
  // TODO: verificar body exacto con captura mitmproxy (~/caja_captures/)
  withdraw(accountId: string, body: RetiroBody) {
    return this.request<unknown>("PUT", `accounts/${encodeURIComponent(accountId)}/balance/withdraw`, { body, retries: 0 })
  }

  /** GET accounts/{id}/balance/withdraw — consulta */
  getWithdraw(accountId: string) {
    return this.request<unknown>("GET", `accounts/${encodeURIComponent(accountId)}/balance/withdraw`, { retries: 0 })
  }

  /** PUT accounts/{id}/balance/biweekly/withdraw — retención quincenal */
  // TODO: verificar body exacto con captura mitmproxy (~/caja_captures/)
  withdrawBiweekly(accountId: string, body: RetiroBody) {
    return this.request<unknown>("PUT", `accounts/${encodeURIComponent(accountId)}/balance/biweekly/withdraw`, {
      body,
      retries: 0,
    })
  }

  /** POST accounts/{id}/password — cambio de contraseña */
  changePassword(accountId: string, body: unknown) {
    return this.request<unknown>("POST", `accounts/${encodeURIComponent(accountId)}/password`, { body, retries: 0 })
  }

  /** POST accounts/{id}/survey — enviar respuesta a encuesta */
  sendSurvey(accountId: string, body: unknown) {
    return this.request<unknown>("POST", `accounts/${encodeURIComponent(accountId)}/survey`, { body, retries: 0 })
  }

  // ---------- Citas (requiere token Bearer) ----------

  /** PUT accounts/{id}/dates?delegacion={id} — solicitar cita */
  // TODO: verificar body exacto con captura mitmproxy (~/caja_captures/)
  requestDate(accountId: string, delegacionId: number | string, body: unknown = {}) {
    return this.request<unknown>(
      "PUT",
      `accounts/${encodeURIComponent(accountId)}/dates?delegacion=${encodeURIComponent(String(delegacionId))}`,
      { body, retries: 0 },
    )
  }

  /** DELETE accounts/{id}/dates/{dateId} — cancelar cita */
  cancelDate(accountId: string, dateId: string) {
    return this.request<unknown>(
      "DELETE",
      `accounts/${encodeURIComponent(accountId)}/dates/${encodeURIComponent(dateId)}`,
      { retries: 0 },
    )
  }

  /** GET accounts/{id}/dates — listar citas */
  listDates(accountId: string) {
    return this.request<DateItem[] | unknown>("GET", `accounts/${encodeURIComponent(accountId)}/dates`, { retries: 0 })
  }
}
