/**
 * Tratamiento de datos sensibles del tarjetón.
 *
 * El PDF se lee solo en el dispositivo. Del resultado estructurado se
 * eliminan RFC, CURP, NSS, cuenta bancaria, folio fiscal, códigos QR,
 * sellos y cadenas originales antes de enviarlo al servidor. En la
 * interfaz los valores se muestran enmascarados.
 */

const SENSITIVE_KEYS = new Set([
  "rfc",
  "curp",
  "nss",
  "cuenta",
  "cuentabancaria",
  "bancaria",
  "banco",
  "qr",
  "codigoqr",
  "sello",
  "sellodigital",
  "cadenas",
  "cadenoriginal",
  "cadenaoriginal",
  "foliofiscal",
  "norfc",
])

/** Rechaza cualquier clave cuyo nombre normalizado esté en la lista sensible. */
export function isSensitiveKey(key: string): boolean {
  const norm = key.toLowerCase().replace(/[\s_\-]/g, "")
  return SENSITIVE_KEYS.has(norm)
}

/**
 * Elimina recursivamente las claves sensibles del objeto (copiando el
 * resultado). Conserva `fiscalFolioHash` (es una huella, no el valor).
 */
export function stripSensitiveFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveFields(item)) as unknown as T
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(record)) {
      if (isSensitiveKey(key)) continue
      result[key] = stripSensitiveFields(item)
    }
    return result as T
  }
  return value
}

/** Enmascara un identificador conservando el inicio y el final: "ABC******X00". */
export function maskIdentifier(value: string | null | undefined, keepStart = 3, keepEnd = 4): string {
  if (!value) return ""
  if (value.length <= keepStart + keepEnd) {
    return `${value.slice(0, keepStart)}${"*".repeat(Math.max(2, value.length - keepStart))}`
  }
  return `${value.slice(0, keepStart)}${"*".repeat(value.length - keepStart - keepEnd)}${value.slice(-keepEnd)}`
}

/** "RFC" → "ABC******X00"; "Cuenta" → "************1234". */
export function maskSensitiveLabel(label: string | null | undefined, value: string | null | undefined): string {
  const v = (value ?? "").trim()
  if (!v) return ""
  const normLabel = (label ?? "").toLowerCase()
  if (normLabel.includes("rfc")) return maskIdentifier(v, 3, 2)
  if (normLabel.includes("cuenta") || normLabel.includes("banco")) return maskIdentifier(v, 0, 4)
  if (normLabel.includes("curp")) return maskIdentifier(v, 3, 2)
  if (normLabel.includes("nss")) return maskIdentifier(v, 3, 2)
  return maskIdentifier(v)
}
