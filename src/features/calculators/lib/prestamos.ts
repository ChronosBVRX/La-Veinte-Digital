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
      const queryWords = normalized.split(/\s+/).filter(w => w.length >= 2)
      for (const qw of queryWords) {
        if (catNorm.includes(qw)) { score += 15; continue }
        if (descNorm.includes(qw)) { score += 15; continue }
        const catWords = catNorm.split(/\s+/)
        for (const cw of catWords) {
          if (cw.includes(qw) || qw.includes(cw)) { score += 10; break }
        }
        for (const dw of descNorm.split(/\s+/)) {
          if (dw.includes(qw) || qw.includes(dw)) { score += 10; break }
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

  return scored.map(s => s.record)
}

export function filterCategorias(records: PrestamoCategoriaRecord[], query: string): PrestamoCategoriaRecord[] {
  return searchCategorias(records, query)
}

export function calcularPrestamos(record: PrestamoCategoriaRecord): PrestamoCalculado[] {
  const base = record.smtabMas011 ?? (record.sueldoQuincenal ?? 0) + (record.concepto011 ?? 0)
  const smi = record.smi ?? 0

  const resultados: PrestamoCalculado[] = [
    { modalidad: "Cláusula 97 - 1 mes", formula: "SMTAB + Concepto 011", valor: base, valorOriginal: record.clausula97UnMes },
    { modalidad: "Cláusula 97 - 2 meses", formula: "(SMTAB + Concepto 011) × 2", valor: base * 2, valorOriginal: record.clausula97DosMeses },
    { modalidad: "Cláusula 97 - 3 meses", formula: "(SMTAB + Concepto 011) × 3", valor: base * 3, valorOriginal: record.clausula97TresMeses },
    { modalidad: "Concepto 160", formula: "(SMTAB + Concepto 011) × 10%", valor: base * 0.1, valorOriginal: record.concepto160 },
    { modalidad: "Automóvil", formula: "SMI × 24", valor: smi * 24, valorOriginal: record.automovil },
    { modalidad: "Enganche", formula: "SMI × 15", valor: smi * 15, valorOriginal: record.enganche },
    { modalidad: "Mediano plazo", formula: "SMI × 35", valor: smi * 35, valorOriginal: record.medianoPlazo },
    { modalidad: "Hipotecario", formula: "SMI × 75", valor: smi * 75, valorOriginal: record.hipotecario },
  ]

  return resultados.map((r) => {
    const redondeado = roundCurrency(r.valor)
    const diff = r.valorOriginal !== undefined ? roundCurrency(Math.abs(redondeado - r.valorOriginal)) : undefined
    if (diff !== undefined && diff > 0.1) {
      console.warn(`Diferencia > $0.10 en ${r.modalidad}: calculado=${redondeado}, original=${r.valorOriginal}, diff=${diff}`)
    }
    return { ...r, valor: redondeado, diferencia: diff }
  })
}

export function mapJsonToPrestamoRecord(raw: Record<string, unknown>): PrestamoCategoriaRecord {
  return {
    categoria: String(raw["CATEGORIA"] ?? raw["categoria"] ?? ""),
    descripcionTC: String(raw["DESC TC"] ?? raw["descripcionTC"] ?? raw["DESCRIPCION TC"] ?? raw["descripcion_tc"] ?? ""),
    sueldoPlaza: Number(raw["SDO PLAZA"] ?? raw["sueldoPlaza"] ?? raw["SUELDO PLAZA"] ?? raw["sueldo_plaza"] ?? 0) || undefined,
    sueldoQuincenal: Number(raw["sdo qnal"] ?? raw["sueldoQuincenal"] ?? raw["SUELDO QUINCENAL"] ?? raw["sueldo_quincenal"] ?? 0) || undefined,
    concepto011: Number(raw["cpto 11"] ?? raw["concepto011"] ?? raw["CONCEPTO 011"] ?? raw["concepto_011"] ?? 0) || undefined,
    smtabMas011: Number(raw["SMTAB+11"] ?? raw["smtabMas011"] ?? raw["SMTAB + 011"] ?? raw["smtab_mas_011"] ?? 0) || undefined,
    smi: Number(raw["SMI"] ?? raw["smi"] ?? 0) || undefined,
    clausula97UnMes: Number(raw["C97 1 MES"] ?? raw["clausula97UnMes"] ?? raw["CLAUSULA 97 1 MES"] ?? raw["clausula_97_un_mes"] ?? 0) || undefined,
    clausula97DosMeses: Number(raw["C97 2 M"] ?? raw["clausula97DosMeses"] ?? raw["CLAUSULA 97 2 MESES"] ?? raw["clausula_97_dos_meses"] ?? 0) || undefined,
    clausula97TresMeses: Number(raw["C97 3 M"] ?? raw["clausula97TresMeses"] ?? raw["CLAUSULA 97 3 MESES"] ?? raw["clausula_97_tres_meses"] ?? 0) || undefined,
    concepto160: Number(raw["CPTO 160"] ?? raw["concepto160"] ?? raw["CONCEPTO 160"] ?? raw["concepto_160"] ?? 0) || undefined,
    automovil: Number(raw["AUTO"] ?? raw["automovil"] ?? raw["AUTOMOVIL"] ?? 0) || undefined,
    enganche: Number(raw["ENGANCHE"] ?? raw["enganche"] ?? 0) || undefined,
    medianoPlazo: Number(raw["MEDIANO"] ?? raw["medianoPlazo"] ?? raw["MEDIANO PLAZO"] ?? raw["mediano_plazo"] ?? 0) || undefined,
    hipotecario: Number(raw["HIPOTECARIO"] ?? raw["hipotecario"] ?? 0) || undefined,
  }
}
