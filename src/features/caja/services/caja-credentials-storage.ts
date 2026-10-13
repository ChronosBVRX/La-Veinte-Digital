import { scopedStorageKey } from "@/shared/services/scoped-storage"

export interface SavedCajaCredentials {
  matricula: string
  password: string
}

interface EncryptedPayload {
  v: 1
  iv: string
  ct: string
  ts: number
}

const STORAGE_BASE_KEY = "caja_saved_credentials"

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const matches = hex.match(/.{1,2}/g)
  if (!matches) return new Uint8Array(new ArrayBuffer(0))
  const buf = new ArrayBuffer(matches.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < matches.length; i++) {
    view[i] = parseInt(matches[i], 16)
  }
  return view
}

async function deriveAesKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const rawKeyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(`lvd_caja_vault_${userId}`),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  )

  const salt = enc.encode(`salt_caja_${userId.slice(0, 16)}`)

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 10000,
      hash: "SHA-256",
    },
    rawKeyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

/**
 * Guarda las credenciales de Caja de Ahorro cifradas localmente con AES-GCM,
 * aisladas por usuario autenticado (scopedStorageKey).
 */
export async function saveCajaCredentials(
  userId: string,
  creds: SavedCajaCredentials
): Promise<boolean> {
  if (typeof window === "undefined" || !userId?.trim()) return false
  if (!creds.matricula?.trim() || !creds.password) return false

  try {
    const key = scopedStorageKey(STORAGE_BASE_KEY, userId)
    const cryptoKey = await deriveAesKey(userId)

    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
    const enc = new TextEncoder()
    const encodedData = enc.encode(
      JSON.stringify({
        matricula: creds.matricula.trim(),
        password: creds.password,
      })
    )

    const cipherBuffer = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encodedData
    )

    const payload: EncryptedPayload = {
      v: 1,
      iv: bytesToHex(iv),
      ct: bytesToHex(new Uint8Array(cipherBuffer)),
      ts: Date.now(),
    }

    localStorage.setItem(key, JSON.stringify(payload))
    return true
  } catch (error) {
    console.error("[CajaStorage] Error al guardar credenciales en local:", error)
    return false
  }
}

/**
 * Lee y descifra las credenciales de Caja de Ahorro del usuario si existen.
 */
export async function loadCajaCredentials(
  userId: string
): Promise<SavedCajaCredentials | null> {
  if (typeof window === "undefined" || !userId?.trim()) return null

  try {
    const key = scopedStorageKey(STORAGE_BASE_KEY, userId)
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const parsed = JSON.parse(raw) as EncryptedPayload
    if (parsed.v !== 1 || !parsed.iv || !parsed.ct) {
      clearCajaCredentials(userId)
      return null
    }

    const cryptoKey = await deriveAesKey(userId)
    const iv = hexToBytes(parsed.iv)
    const cipherBytes = hexToBytes(parsed.ct)

    const decryptedBuffer = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      cipherBytes
    )

    const dec = new TextDecoder()
    const jsonStr = dec.decode(decryptedBuffer)
    const data = JSON.parse(jsonStr) as SavedCajaCredentials

    if (!data.matricula || !data.password) {
      clearCajaCredentials(userId)
      return null
    }

    return {
      matricula: data.matricula,
      password: data.password,
    }
  } catch (error) {
    console.warn("[CajaStorage] No se pudieron descifrar las credenciales locales:", error)
    return null
  }
}

/**
 * Elimina las credenciales guardadas de Caja de Ahorro para el usuario.
 */
export function clearCajaCredentials(userId: string): void {
  if (typeof window === "undefined" || !userId?.trim()) return
  try {
    const key = scopedStorageKey(STORAGE_BASE_KEY, userId)
    localStorage.removeItem(key)
  } catch {
    // noop
  }
}

/**
 * Comprueba si existen credenciales guardadas en local sin descifrar.
 */
export function hasSavedCajaCredentials(userId: string): boolean {
  if (typeof window === "undefined" || !userId?.trim()) return false
  try {
    const key = scopedStorageKey(STORAGE_BASE_KEY, userId)
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}
