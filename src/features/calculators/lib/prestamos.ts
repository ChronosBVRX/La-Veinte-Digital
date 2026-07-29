import type { PrestamoCategoriaRecord, PrestamoCalculado } from "./types"
import { roundCurrency } from "./money"

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function filterCategorias(records: PrestamoCategoriaRecord[], query: string): PrestamoCategoriaRecord[] {
  const normalized = normalizeSearch(query)
  if (!normalized) return records
  return records.filter((r) => {
    const cat = normalizeSearch(r.categoria)
    const desc = normalizeSearch(r.descripcionTC ?? "")
    return cat.includes(normalized) || desc.includes(normalized)
  })
}

export function calcularPrestamos(record: PrestamoCategoriaRecord): PrestamoCalculado[] {
  const base = (record.sueldoQuincenal ?? 0) + (record.concepto011 ?? 0)
  const smi = record.smi ?? 0

  const resultados: PrestamoCalculado[] = [
    { modalidad: "Cláusula 97 - 1 mes", formula: "Sueldo quincenal + Concepto 011", valor: base, valorOriginal: record.clausula97UnMes },
    { modalidad: "Cláusula 97 - 2 meses", formula: "(Sueldo quincenal + Concepto 011) × 2", valor: base * 2, valorOriginal: record.clausula97DosMeses },
    { modalidad: "Cláusula 97 - 3 meses", formula: "(Sueldo quincenal + Concepto 011) × 3", valor: base * 3, valorOriginal: record.clausula97TresMeses },
    { modalidad: "Concepto 160", formula: "(Sueldo quincenal + Concepto 011) × 10%", valor: base * 0.1, valorOriginal: record.concepto160 },
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
