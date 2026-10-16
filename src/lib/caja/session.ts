import "server-only"
import { cookies } from "next/headers"
import { createHmac, randomBytes, createCipheriv, createDecipheriv } from "node:crypto"

export interface CajaSessionData {
  authToken: string
  accountId: string
  matricula: string
  nombre?: string
  expiresAt: number
}

const COOKIE_NAME = "caja_session"
const DEFAULT_SESSION_MAX_AGE_SEC = 60 * 60 * 3 // 3 horas (acorde con sessionTime oficial)

function getSecretKey(): Buffer {
  const secret =
    process.env.CAJA_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "caja-secure-default-secret-key-32b!"

  // Generar clave fija de 32 bytes usando SHA-256 del secret
  const h = createHmac("sha256", "caja-salt")
  h.update(secret)
  return h.digest()
}

/**
 * Cifra la sesión en formato iv:tag:ciphertext (AES-256-GCM)
 */
function encryptSession(data: CajaSessionData): string {
  const key = getSecretKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const json = JSON.stringify(data)
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

/**
 * Descifra y valida la sesión
 */
function decryptSession(token: string): CajaSessionData | null {
  try {
    const parts = token.split(":")
    if (parts.length !== 3) return null

    const [ivHex, tagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, "hex")
    const tag = Buffer.from(tagHex, "hex")
    const encrypted = Buffer.from(encryptedHex, "hex")

    const key = getSecretKey()
    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    const parsed = JSON.parse(decrypted.toString("utf8")) as CajaSessionData

    if (typeof parsed.expiresAt === "number" && Date.now() > parsed.expiresAt) {
      return null // Expirada
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Extrae la expiración en milisegundos de un JWT estándar si está presente
 */
export function extractJwtExpiry(jwt: string): number | null {
  try {
    const parts = jwt.split(".")
    if (parts.length < 2) return null
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8")
    const payload = JSON.parse(payloadJson) as { exp?: number }
    if (typeof payload.exp === "number" && payload.exp > 0) {
      return payload.exp * 1000
    }
  } catch {
    // Si no es un JWT estándar o no tiene exp, omitir
  }
  return null
}

/**
 * Establece la cookie de sesión de Caja (HTTP-Only, Secure, SameSite: lax)
 */
export async function setCajaSession(data: Omit<CajaSessionData, "expiresAt">, sessionTimeSeconds?: number): Promise<void> {
  const cookieStore = await cookies()
  let maxAge = sessionTimeSeconds && sessionTimeSeconds > 0 ? sessionTimeSeconds : DEFAULT_SESSION_MAX_AGE_SEC

  // Si el token JWT tiene una expiración explícita anterior, acotar el tiempo de vida
  const jwtExpMs = extractJwtExpiry(data.authToken)
  if (jwtExpMs && jwtExpMs > Date.now()) {
    const jwtTtlSec = Math.floor((jwtExpMs - Date.now()) / 1000)
    if (jwtTtlSec > 0 && jwtTtlSec < maxAge) {
      maxAge = jwtTtlSec
    }
  }

  const expiresAt = Date.now() + maxAge * 1000

  const payload: CajaSessionData = {
    ...data,
    expiresAt,
  }

  const encrypted = encryptSession(payload)

  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  })
}

/**
 * Obtiene la sesión actual desde la cookie
 */
export async function getCajaSession(): Promise<CajaSessionData | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  if (!cookie?.value) return null

  return decryptSession(cookie.value)
}

/**
 * Limpia la cookie de sesión
 */
export async function clearCajaSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
