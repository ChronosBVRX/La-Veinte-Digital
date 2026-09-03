import type { PrestamoCategoriaRecord, PrestamoCalculado } from "./types"
import { roundCurrency } from "./money"

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  return dp[m][n]
}

export function searchCategorias(records: PrestamoCategoriaRecord[], query: string): PrestamoCategoriaRecord[] {
  const normalized = normalizeSearch(query)
  if (!normalized) return records

  const scored: { record: PrestamoCategoriaRecord; score: number }[] = []

  for (const record of records) {
    const catNorm = normalizeSearch(record.categoria)
    const descNorm = normalizeSearch(record.descripcionTC ?? "")
    let score = 0

    if (catNorm === normalized || descNorm === normalized) {
      score = 100
    } else if (catNorm.includes(normalized) || descNorm.includes(normalized)) {
      score = 70
    } else {
      const queryWords = normalized.split(/\s+/).filter((w) => w.length >= 2)
      for (const qw of queryWords) {
        if (catNorm.includes(qw)) {
          score += 15
          continue
        }
        if (descNorm.includes(qw)) {
          score += 15
          continue
        }
        const catWords = catNorm.split(/\s+/)
        for (const cw of catWords) {
          if (cw.includes(qw) || qw.includes(cw)) {
            score += 10
            break
          }
        }
        for (const dw of descNorm.split(/\s+/)) {
          if (dw.includes(qw) || qw.includes(dw)) {
            score += 10
            break
          }
        }
      }
    }

    if (score === 0) {
      const distCat = levenshtein(catNorm, normalized)
      const distDesc = descNorm ? levenshtein(descNorm, normalized) : Infinity
      const bestDist = Math.min(distCat, distDesc)
      const maxLen = Math.max(catNorm.length, normalized.length)
      const normalizedDist = bestDist / maxLen
      if (normalizedDist < 0.4) {
        score = Math.round((1 - normalizedDist) * 40)
      }
    }

    if (score > 0) {
      scored.push({ record, score })
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.record.categoria.localeCompare(b.record.categoria, "es")
  })

  return scored.map((s) => s.record)
}

export function filterCategorias(records: PrestamoCategoriaRecord[], query: string): PrestamoCategoriaRecord[] {
  return searchCategorias(records, query)
}

/**
 * Cálculo de modalidades de préstamos por categoría y SMI según CCT 2025-2027:
 * - Sueldo Mensual Integrado (SMI) = (Sueldo Tabular 002 + Concepto 011 mensual) + 20%
 * - Préstamo para Automóvil: SMI × 24 (elegibilidad: mínimo 5 años de antigüedad)
 * - Préstamo para Enganche: SMI × 15
 * - Préstamo a Mediano Plazo: SMI × 35
 * - Préstamo Hipotecario: SMI × 75 (y hasta 90 meses condicionado a capacidad de liquidez)
 */
export function calcularPrestamos(record: PrestamoCategoriaRecord): PrestamoCalculado[] {
  // SMTAB + 011 mensual = (002 quincenal + 011 quincenal) * 2
  const baseMensual = record.smtabMas011 ?? roundCurrency(((record.sueldoQuincenal ?? 0) + (record.concepto011 ?? 0)) * 2)
  const smi = record.smi ?? roundCurrency(baseMensual * 1.2)

  const unMesC97 = baseMensual
  const dosMesesC97 = roundCurrency(baseMensual * 2)
  const tresMesesC97 = roundCurrency(baseMensual * 3)

  const resultados: PrestamoCalculado[] = [
    {
      modalidad: "Cláusula 97 - 1 mes",
      formula: "1 mes de sueldo mensual (recuperación 10 qnas)",
      valor: unMesC97,
      valorOriginal: record.clausula97UnMes,
    },
    {
      modalidad: "Cláusula 97 - 2 meses",
      formula: "2 meses de sueldo mensual (recuperación 20 qnas)",
      valor: dosMesesC97,
      valorOriginal: record.clausula97DosMeses,
    },
    {
      modalidad: "Cláusula 97 - 3 meses",
      formula: "3 meses de sueldo mensual (recuperación 30 qnas)",
      valor: tresMesesC97,
      valorOriginal: record.clausula97TresMeses,
    },
    {
      modalidad: "Concepto 160",
      formula: "(Sueldo mensual base) × 10%",
      valor: roundCurrency(baseMensual * 0.1),
      valorOriginal: record.concepto160,
    },
    {
      modalidad: "Préstamo para Automóvil",
      formula: "SMI × 24 (elegibilidad: antigüedad ≥ 5 años de base)",
      valor: roundCurrency(smi * 24),
      valorOriginal: record.automovil,
    },
    {
      modalidad: "Préstamo para Enganche de Auto",
      formula: "SMI × 15",
      valor: roundCurrency(smi * 15),
      valorOriginal: record.enganche,
    },
    {
      modalidad: "Préstamo a Mediano Plazo",
      formula: "SMI × 35",
      valor: roundCurrency(smi * 35),
      valorOriginal: record.medianoPlazo,
    },
    {
      modalidad: "Préstamo Hipotecario (Base 75 meses)",
      formula: "SMI × 75 (hasta 90 meses condicionado a capacidad de pago)",
      valor: roundCurrency(smi * 75),
      valorOriginal: record.hipotecario,
    },
    {
      modalidad: "Préstamo Hipotecario (Máximo condicional 90 meses)",
      formula: "SMI × 90 (sujeto a liquidez y estudio socioeconómico)",
      valor: roundCurrency(smi * 90),
    },
  ]

  return resultados.map((r) => {
    const redondeado = roundCurrency(r.valor)
    const diff =
      r.valorOriginal !== undefined ? roundCurrency(Math.abs(redondeado - r.valorOriginal)) : undefined
    return { ...r, valor: redondeado, diferencia: diff }
  })
}

export function mapJsonToPrestamoRecord(raw: Record<string, unknown>): PrestamoCategoriaRecord {
  return {
    categoria: String(raw["CATEGORIA"] ?? raw["categoria"] ?? "").replace(/\s+/g, " ").trim(),
    descripcionTC: String(
      raw["DESC TC"] ?? raw["descripcionTC"] ?? raw["DESCRIPCION TC"] ?? raw["descripcion_tc"] ?? ""
    ).trim(),
    sueldoPlaza:
      Number(raw["SDO PLAZA"] ?? raw["sueldoPlaza"] ?? raw["SUELDO PLAZA"] ?? raw["sueldo_plaza"] ?? 0) ||
      undefined,
    sueldoQuincenal:
      Number(raw["sdo ap 16 1025"] ?? raw["sdo qnal"] ?? raw["sueldoQuincenal"] ?? raw["SUELDO QUINCENAL"] ?? 0) ||
      undefined,
    concepto011:
      Number(raw["cpto 11 ap 1610"] ?? raw["cpto 11"] ?? raw["concepto011"] ?? raw["CONCEPTO 011"] ?? 0) ||
      undefined,
    smtabMas011:
      Number(raw["SMTAB+11"] ?? raw["smtabMas011"] ?? raw["SMTAB + 011"] ?? raw["smtab_mas_011"] ?? 0) ||
      undefined,
    smi: Number(raw["SMI"] ?? raw["smi"] ?? 0) || undefined,
    clausula97UnMes:
      Number(raw["C97 1 MES"] ?? raw["clausula97UnMes"] ?? raw["CLAUSULA 97 1 MES"] ?? 0) || undefined,
    clausula97DosMeses:
      Number(raw["C97 2 M"] ?? raw["clausula97DosMeses"] ?? raw["CLAUSULA 97 2 MESES"] ?? 0) || undefined,
    clausula97TresMeses:
      Number(raw["C97 3 M"] ?? raw["clausula97TresMeses"] ?? raw["CLAUSULA 97 3 MESES"] ?? 0) || undefined,
    concepto160: Number(raw["CPTO 160"] ?? raw["concepto160"] ?? raw["CONCEPTO 160"] ?? 0) || undefined,
    automovil: Number(raw["AUTO"] ?? raw["automovil"] ?? raw["AUTOMOVIL"] ?? 0) || undefined,
    enganche: Number(raw["ENGANCHE"] ?? raw["enganche"] ?? 0) || undefined,
    medianoPlazo:
      Number(raw["MEDIANO"] ?? raw["medianoPlazo"] ?? raw["MEDIANO PLAZO"] ?? raw["mediano_plazo"] ?? 0) ||
      undefined,
    hipotecario: Number(raw["HIPOTECARIO"] ?? raw["hipotecario"] ?? 0) || undefined,
  }
}
