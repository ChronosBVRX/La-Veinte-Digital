import type { NormativaVigencia } from "./vigencias"
import { CCT_2025_2027, NORMA_1000_001_020, PROC_1A74_003_031 } from "./vigencias"

/**
 * Matriz declarativa de repercusiones entre conceptos.
 *
 * Semántica de una entrada: "el concepto `sourceConceptCode` integra la base
 * del concepto `targetConceptCode` según `sourceReference`".
 *
 * Reglas de integridad:
 * - Cada relación tiene evidencia individual (`sourceDocument` +
 *   `sourceReference`). NO se copian listas sin saber por qué cada concepto
 *   repercute.
 * - Solo las relaciones `regulation_verified` se integran en la base
 *   monetaria. Las `pending_validation` se separan en `pendingImpacts`.
 * - `weight` (por defecto 1) multiplica el monto del concepto origen al
 *   integrarse (p. ej. el SMI de 107/108/111/152 usa 1.25 para el grupo
 *   [002, 011-019, 057, 058], cláusula 107 del CCT).
 * - `effectiveFrom` no se inventa: por defecto "2025-01-01" expresa que no
 *   hay evidencia de un inicio posterior (inicio del periodo cubierto por los
 *   datos). Si existiera evidencia de vigencia concreta, se usa esa fecha.
 */
export interface ConceptImpactRule {
  sourceConceptCode: string
  targetConceptCode: string
  effectiveFrom: string
  effectiveTo?: string
  verificationStatus: "regulation_verified" | "pending_validation"
  /** Identificador del documento institucional (ver `vigencias.ts`). */
  sourceDocument: string
  /** Referencia concreta dentro del documento (cláusula, artículo, tabla). */
  sourceReference: string
  /** Peso del monto del origen al integrarse a la base del destino. */
  weight?: number
  notes?: string
}

/** Versión de la matriz. Crece con cada cambio de relaciones o vigencias. */
export const REPERCUSSION_MATRIX_VERSION = "repercussion-matrix-2.0.0"

const NO_EVIDENCE_DATE: string = "2025-01-01"

function verified(
  source: string,
  target: string,
  doc: NormativaVigencia,
  reference: string,
  notes?: string,
  weight?: number,
): ConceptImpactRule {
  return {
    sourceConceptCode: source,
    targetConceptCode: target,
    effectiveFrom: NO_EVIDENCE_DATE,
    verificationStatus: "regulation_verified",
    sourceDocument: doc.id,
    sourceReference: reference,
    weight,
    notes,
  }
}

function pending(
  source: string,
  target: string,
  doc: NormativaVigencia,
  reference: string,
  notes?: string,
): ConceptImpactRule {
  return {
    sourceConceptCode: source,
    targetConceptCode: target,
    effectiveFrom: NO_EVIDENCE_DATE,
    verificationStatus: "pending_validation",
    sourceDocument: doc.id,
    sourceReference: reference,
    notes,
  }
}

function verifiedTriples(doc: NormativaVigencia, ref: string, triples: [string, string, string][]): ConceptImpactRule[] {
  return triples.map(([source, target, specificRef]) =>
    verified(source, target, doc, specificRef || ref)
  )
}

function pairList(sources: string[], targets: string[], ref: string): [string, string, string][] {
  return sources.flatMap((s) => targets.map((t): [string, string, string] => [s, t, ref]))
}

/**
 * Conjunto de conceptos que integran el Salario Diario Integrado (SMI) según
 * la fórmula de SMI usada por 029/048 y por la cláusula 107.
 */
const SMI_GROUP = [
  "002", "011", "012", "013", "014", "015", "016", "017", "018", "019",
  "057", "058", "020", "022", "023", "050", "062", "063",
]

/** Grupo del SMI con sobrepeso de 1.25 (cláusula 107: [002, 011-019, 057, 058]). */
const SMI_GROUP_X1_25 = ["002", "011", "012", "013", "014", "015", "016", "017", "018", "019", "057", "058"]
/** Grupo del SMI sin sobrepeso. */
const SMI_GROUP_X1 = ["020", "022", "023", "050", "062", "063"]

/**
 * Grupo "en su caso" del aguinaldo (043/047/049):
 * "Sueldo tabular (002) + cpto. 011 (en su caso cpto. 019 + 054 + 057 + 058 + 061)".
 */
const AGUINALDO_EN_SU_CASO = ["002", "011", "019", "054", "057", "058", "061"]

/**
 * Base de los estímulos 032/033 REFUTADA empíricamente en su versión
 * extendida: el tarjetón real 2A-AGO-2026 (TÉCNICO RADIÓLOGO 80, con 054 y
 * 072 presentes) muestra base = 002 + 011 únicamente:
 *   032 = trunc2(7172.41 × 24%) = $1,721.37
 *   033 = trunc2(7172.41 × 16%) = $1,147.58
 * El grupo previo [002, 011, 019, 054, 057, 058, 061] habría producido una
 * base mayor. Se retiene solo la composición observada.
 */
const ESTIMULOS_BASE = ["002", "011"]

/** Grupo de base de tiempo extraordinario según las cláusulas 32-33. */
const TIEMPO_EXTRA_BASE = ["002", "011", "019", "023", "054", "063", "020", "050"]

/** Conceptos que percuten en tiempo extra según la Norma 1000-001-020. */
const TIEMPO_EXTRA_NORMA = ["02", "012", "013", "057", "058", "061"]

const MATRIX: ConceptImpactRule[] = [
  // ── 055 Fondo de Ahorro (régimen ordinario, Cláusula 144 + Cláusula 63 Bis inc. b) ──
  // Base = sueldo tabular (002) + ayuda renta (011 por repercusión de Cl. 63 Bis inc. b).
  verified("002", "055", CCT_2025_2027, "Cláusula 144 CCT (base sueldo tabular)"),
  verified("011", "055", CCT_2025_2027, "Cláusula 63 Bis inc. b (repercusión en prestaciones con base sueldo tabular)"),

  // ── 022 Ayuda de Renta por Antigüedad (Cláusula 63 Bis, inciso c) ────────────
  ...verifiedTriples(CCT_2025_2027, "Cláusula 63 Bis, inciso c", [
    ["002", "022", ""],
    ["011", "022", ""],
    ["013", "022", "Cláusula 63 Bis, inciso c (en su caso)"],
    ["057", "022", "Cláusula 63 Bis, inciso c (en su caso)"],
    ["058", "022", "Cláusula 63 Bis, inciso c (en su caso)"],
    ["061", "022", "Cláusula 63 Bis, inciso c (en su caso)"],
  ]),

  // ── 029 Prima Vacacional y 048 Ayuda Cultural (Salario Diario Integrado) ─────
  // Fórmula: SMI ÷ 30 × días (Cláusula 47).
  ...pairList(SMI_GROUP, ["029"], "Cláusula 47 (prima vacacional, SMI/30)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r)),
  ...pairList(SMI_GROUP, ["048"], "Cláusula 47 (ayuda cultural, SMI/30)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r)),

  // ── 107/108/111/152 Aguinaldo y compensaciones (fórmula propia de SMI) ───────
  // [002, 011-019, 057, 058] se multiplican por 1.25; [020, 022, 023, 050, 062,
  // 063] no se multiplican (Cláusula 107 del CCT).
  ...pairList(SMI_GROUP_X1_25, ["107"], "Cláusula 107 (SMI con factor 1.25)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r, undefined, 1.25)),
  ...pairList(SMI_GROUP_X1, ["107"], "Cláusula 107 (SMI sin factor 1.25)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r)),
  ...pairList(SMI_GROUP_X1_25, ["108", "111", "152"], "Cláusula 107 (misma composición de SMI, factor 1.25)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r, undefined, 1.25)),
  ...pairList(SMI_GROUP_X1, ["108", "111", "152"], "Cláusula 107 (misma composición de SMI, sin factor)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r)),

  // ── 030 Prima Dominical (Cláusula 46, fracción II) ───────────────────────────
  // "002 + 011 + (012…016 + 022 + 023 + 054 + 057 + 058 + 061 + 063) + 020 + 050".
  ...pairList(
    ["002", "011", "012", "013", "014", "015", "016", "022", "023", "054", "057", "058", "061", "063", "020", "050"],
    ["030"],
    "Cláusula 46, fracción II (prima dominical)",
  ).map(([s, t, r]) => verified(s, t, CCT_2025_2027, r)),

  // ── 032 Estímulo a la Asistencia (Art. 91 RIT) y 033 Puntualidad (Art. 93 RIT) ──
  // Base = 002 + 011 (composición observada en tarjetón real; grupo extendido
  // previo refutado empíricamente — ver ESTIMULOS_BASE).
  ...pairList(ESTIMULOS_BASE, ["032"], "Art. 91 del RIT (estímulo asistencia)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r)),
  ...pairList(ESTIMULOS_BASE, ["033"], "Art. 93 del RIT (estímulo puntualidad)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r)),

  // ── 043/047/049 Aguinaldo (Cláusula 107 del CCT) ─────────────────────────────
  ...pairList(AGUINALDO_EN_SU_CASO, ["043", "047", "049"], "Cláusula 107 (aguinaldo)")
    .map(([s, t, r]) => verified(s, t, CCT_2025_2027, r)),

  // ── 037 Tiempo Extraordinario ────────────────────────────────────────────────
  // Repercusión de sobresueldos documentada en la Norma 1000-001-020.
  ...pairList(TIEMPO_EXTRA_NORMA, ["037"], "Norma 1000-001-020 (sobresueldos que repercuten)")
    .map(([s, t, r]) => verified(s, t, NORMA_1000_001_020, r)),
  // Base documentada en la transcripción de la fórmula (Cláusulas 32-33).
  ...pairList(TIEMPO_EXTRA_BASE, ["037"], "Cláusulas 32-33 (base de tiempo extraordinario)")
    .map(([s, t, r]) => verified(s, t, PROC_1A74_003_031, r)),

  // ── 035 Quebranto de jornada (pendiente de evidencia individual) ─────────────
  ...pairList(["012", "013", "057", "058", "061"], ["035"], "Pendiente de evidencia individual")
    .map(([s, t, r]) => pending(s, t, NORMA_1000_001_020, r)),

  // ── 129/155/164/175/177 (pendientes de evidencia individual) ─────────────────
  ...pairList(["012", "013", "057", "058", "061"], ["129", "155", "164", "175", "177"], "Pendiente de evidencia individual")
    .map(([s, t, r]) => pending(s, t, NORMA_1000_001_020, r)),

  // ── 072 → aguinaldo/compensaciones (integración individual pendiente) ────────
  ...["107", "108", "111", "152", "155", "164"].map((t) =>
    pending("072", t, CCT_2025_2027, "Grupo de compensaciones [072, 083, 020, 050, 112] — integración individual pendiente"),
  ),

  // ── Bases usadas por reglas sin evidencia documental individual ─────────────
  // Las reglas derivadas calculan base = 002 + 011 (algunas solo 002) y lo
  // muestran explícitamente en sus calculationSteps. La composición está
  // DECLARADA por la regla pero PENDIENTE de evidencia documental individual;
  // al integrarse dinero solo cuando hay regulation_verified, estas filas no
  // alteran cálculos: existen para hacer visible la deuda de evidencia.
  ...pairList(["002", "011"], ["02", "012", "013", "051", "054", "057", "058", "061", "062", "072", "078"], "Base declarada por la regla; evidencia documental individual pendiente")
    .map(([s, t, r]) => pending(s, t, CCT_2025_2027, r)),
]

export function getImpactMatrixEffectiveAt(date: string): ConceptImpactRule[] {
  return MATRIX.filter(
    (i) => date >= i.effectiveFrom && (!i.effectiveTo || date <= i.effectiveTo)
  )
}

export function getRepercussionMatrixVersion(): string {
  return REPERCUSSION_MATRIX_VERSION
}
