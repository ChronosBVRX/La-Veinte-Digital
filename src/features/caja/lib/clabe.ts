/**
 * Utilidades para validación y manejo seguro de CLABE interbancaria (18 dígitos).
 * Implementa el algoritmo estándar de Banco de México / ABM.
 */

const CLABE_WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7]

export const BANCOS_MEXICO: Record<string, string> = {
  "002": "Banamex",
  "012": "BBVA México",
  "014": "Santander",
  "021": "HSBC",
  "030": "Banco del Bajío",
  "036": "Inbursa",
  "042": "Mifel",
  "044": "Scotiabank",
  "058": "Banregio",
  "072": "Banorte",
  "127": "Banco Azteca",
  "137": "Bancoppel",
  "140": "Consubanco",
  "166": "Banco del Bienestar",
  "638": "Nu México",
  "646": "STP",
  "670": "Mercado Pago",
  "684": "Ualá",
}

export interface ClabeValidationResult {
  isValid: boolean
  error?: string
  bankCode?: string
  bankName?: string
}

/**
 * Valida una CLABE interbancaria de 18 dígitos según el estándar mexicano.
 */
export function validateClabe(clabe: string): ClabeValidationResult {
  const clean = clabe.trim().replace(/\s+/g, "")

  if (!clean) {
    return { isValid: false, error: "La CLABE no puede estar vacía" }
  }

  if (clean.length !== 18) {
    return { isValid: false, error: `La CLABE debe tener exactamente 18 dígitos (tiene ${clean.length})` }
  }

  if (!/^\d{18}$/.test(clean)) {
    return { isValid: false, error: "La CLABE debe contener únicamente números" }
  }

  // Calcular dígito verificador
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const digit = Number.parseInt(clean[i], 10)
    const product = (digit * CLABE_WEIGHTS[i]) % 10
    sum += product
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10
  const actualCheckDigit = Number.parseInt(clean[17], 10)

  if (expectedCheckDigit !== actualCheckDigit) {
    return { isValid: false, error: "Dígito verificador de CLABE inválido" }
  }

  const bankCode = clean.slice(0, 3)
  const bankName = BANCOS_MEXICO[bankCode] || "Institución bancaria"

  return {
    isValid: true,
    bankCode,
    bankName,
  }
}

/**
 * Enmascara una CLABE para logs y vistas, mostrando únicamente los últimos 4 dígitos.
 * Nunca exponer la CLABE completa en logs ni almacenamiento plano.
 */
export function maskClabe(clabe?: string): string {
  if (!clabe) return ""
  const clean = clabe.trim().replace(/\s+/g, "")
  if (clean.length < 4) return "••••"
  return "•".repeat(clean.length - 4) + clean.slice(-4)
}
