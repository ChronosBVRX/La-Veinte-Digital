import { describe, expect, it } from "vitest"
import {
  classifyWorkerQueryIntent,
  getNormativePriority,
  rerankByNormativePriority,
  type RetrievedSource,
} from "../lib/retrieval-sources"

function mockSource(id: string, documentId: string, documento: string, score: number): RetrievedSource {
  return {
    id,
    chunkId: `${documentId}:chunk1`,
    documentId,
    documento,
    version: "V1",
    tipo: "clausula",
    numero: "1",
    paginaInicio: 1,
    paginaFin: 2,
    fragmento: "Texto normativo de prueba...",
    sourceUrl: null,
    validity: "CURRENT",
    pendingReview: false,
    score,
  }
}

describe("Chatbot RAG: Prioridad Normativa Estricta y Clasificación de Intención", () => {
  it("Caso 1: Permisos y licencias sindicales / asambleas prioriza Estatutos SNTSS y CCT sobre LFT", () => {
    const query = "¿Qué permiso o licencia tengo para asistir a una asamblea sindical del SNTSS?"
    const intent = classifyWorkerQueryIntent(query)
    expect(intent).toBe("SINDICAL")

    const lft = mockSource("S1", "LFT", "Ley Federal del Trabajo", 250)
    const cct = mockSource("S2", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 100)
    const estatutos = mockSource("S3", "SNTSS-ESTATUTOS-OCT2022", "Estatutos del SNTSS", 120)

    expect(getNormativePriority(cct.documentId, cct.documento, intent)).toBe(2)
    expect(getNormativePriority(estatutos.documentId, estatutos.documento, intent)).toBe(1)
    expect(getNormativePriority(lft.documentId, lft.documento, intent)).toBe(3)

    // Aunque la LFT tenga score inicial más alto por coincidencia de palabras, la prioridad sindical/contractual manda
    const reranked = rerankByNormativePriority([lft, cct, estatutos], query)
    expect(reranked[0].documentId).toBe("SNTSS-ESTATUTOS-OCT2022")
    expect(reranked[1].documentId).toBe("CCT-IMSS-SNTSS-2025-2027")
    expect(reranked[2].documentId).toBe("LFT")
  })

  it("Caso 2: Días de aguinaldo de trabajador IMSS prioriza CCT Cláusula 107 sobre LFT Art. 87", () => {
    const query = "¿Cuántos días de aguinaldo me corresponden como trabajador de base en el IMSS?"
    const intent = classifyWorkerQueryIntent(query)
    expect(intent).toBe("CONTRACTUAL")

    const lft = mockSource("S1", "LFT", "Ley Federal del Trabajo", 300)
    const cct = mockSource("S2", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 150)
    const lgs = mockSource("S3", "LGS", "Ley General de Salud", 80)

    expect(getNormativePriority(cct.documentId, cct.documento, intent)).toBe(1)
    expect(getNormativePriority(lft.documentId, lft.documento, intent)).toBe(3)
    expect(getNormativePriority(lgs.documentId, lgs.documento, intent)).toBe(3)

    const reranked = rerankByNormativePriority([lgs, lft, cct], query)
    expect(reranked[0].documentId).toBe("CCT-IMSS-SNTSS-2025-2027")
    expect(reranked[1].documentId).toBe("LFT")
    expect(reranked[2].documentId).toBe("LGS")
  })

  it("Caso 3: Procedimiento de investigación y sanciones disciplinarias prioriza CCT y RIT sobre leyes generales", () => {
    const query = "Procedimiento ante una investigación laboral de la Comisión Mixta Disciplinaria por acta administrativa"
    const intent = classifyWorkerQueryIntent(query)
    expect(intent).toBe("LABORAL")

    const lft = mockSource("S1", "LFT", "Ley Federal del Trabajo", 280)
    const rit = mockSource("S2", "IMSS-RIT-1988", "Reglamento Interior de Trabajo", 190)
    const cct = mockSource("S3", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 200)

    expect(getNormativePriority(cct.documentId, cct.documento, intent)).toBe(1)
    expect(getNormativePriority(rit.documentId, rit.documento, intent)).toBe(2)
    expect(getNormativePriority(lft.documentId, lft.documento, intent)).toBe(3)

    const reranked = rerankByNormativePriority([lft, rit, cct], intent)
    expect(reranked[0].documentId).toBe("CCT-IMSS-SNTSS-2025-2027")
    expect(reranked[1].documentId).toBe("IMSS-RIT-1988")
    expect(reranked[2].documentId).toBe("LFT")
  })

  it("Caso 4: Requisitos de escalafón y cambio de adscripción de categoría prioriza CCT y Reglamento de Escalafón", () => {
    const query = "¿Cuáles son los requisitos de escalafón para un cambio de adscripción en mi categoría del CCT?"
    const intent = classifyWorkerQueryIntent(query)
    expect(intent).toBe("CAMBIO_ADSCRIPCION")

    const cct = mockSource("S1", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 180)
    const escalafon = mockSource("S2", "IMSS-REGLAMENTO-ESCALAFON", "Reglamento de Escalafón", 160)
    const lft = mockSource("S3", "LFT", "Ley Federal del Trabajo", 290)

    expect(getNormativePriority(cct.documentId, cct.documento, intent)).toBe(1)
    expect(getNormativePriority(escalafon.documentId, escalafon.documento, intent)).toBe(1)
    expect(getNormativePriority(lft.documentId, lft.documento, intent)).toBe(3)

    const reranked = rerankByNormativePriority([lft, escalafon, cct], query)
    expect(["CCT-IMSS-SNTSS-2025-2027", "IMSS-REGLAMENTO-ESCALAFON"]).toContain(reranked[0].documentId)
    expect(["CCT-IMSS-SNTSS-2025-2027", "IMSS-REGLAMENTO-ESCALAFON"]).toContain(reranked[1].documentId)
    expect(reranked[2].documentId).toBe("LFT")
  })

  it("Caso 5: Riesgos de trabajo y equipo de protección prioriza NOMs y CCT sobre leyes generales", () => {
    const query = "¿Qué equipo de protección personal o incapacidad me corresponde por riesgo de trabajo en área médica con radiación?"
    const intent = classifyWorkerQueryIntent(query)
    expect(intent).toBe("SEGURIDAD_SALUD")

    const lgs = mockSource("S1", "LGS", "Ley General de Salud", 210)
    const nom = mockSource("S2", "NOM-017-STPS-2024", "NOM-017-STPS-2024 Equipo de Protección Personal", 180)
    const cct = mockSource("S3", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 195)
    const lft = mockSource("S4", "LFT", "Ley Federal del Trabajo", 230)

    expect(getNormativePriority(cct.documentId, cct.documento, intent)).toBe(1)
    expect(getNormativePriority(nom.documentId, nom.documento, intent)).toBe(1)
    expect(getNormativePriority(lgs.documentId, lgs.documento, intent)).toBe(3)
    expect(getNormativePriority(lft.documentId, lft.documento, intent)).toBe(3)

    const reranked = rerankByNormativePriority([lgs, lft, nom, cct], query)
    // CCT y NOM deben quedar arriba de LFT y LGS
    expect(["CCT-IMSS-SNTSS-2025-2027", "NOM-017-STPS-2024"]).toContain(reranked[0].documentId)
    expect(["CCT-IMSS-SNTSS-2025-2027", "NOM-017-STPS-2024"]).toContain(reranked[1].documentId)
    expect(["LFT", "LGS"]).toContain(reranked[2].documentId)
    expect(["LFT", "LGS"]).toContain(reranked[3].documentId)
  })

  it("Tabla de consultas requeridas: 5 intenciones con sus fuentes principales esperadas", () => {
    // 1. Derechos como trabajador del IMSS -> CCT y Estatutos
    const q1 = "Derechos como trabajador del IMSS"
    const i1 = classifyWorkerQueryIntent(q1)
    expect(i1).toBe("LABORAL")
    const cct1 = mockSource("S1", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 100)
    const est1 = mockSource("S2", "SNTSS-ESTATUTOS-OCT2022", "Estatutos SNTSS", 90)
    const lgs1 = mockSource("S3", "LGS", "Ley General de Salud", 200)
    expect(getNormativePriority(cct1.documentId, cct1.documento, i1)).toBe(1)
    expect(getNormativePriority(est1.documentId, est1.documento, i1)).toBe(1)
    expect(getNormativePriority(lgs1.documentId, lgs1.documento, i1)).toBe(3)
    const r1 = rerankByNormativePriority([lgs1, est1, cct1], q1)
    expect(["CCT-IMSS-SNTSS-2025-2027", "SNTSS-ESTATUTOS-OCT2022"]).toContain(r1[0].documentId)
    expect(["CCT-IMSS-SNTSS-2025-2027", "SNTSS-ESTATUTOS-OCT2022"]).toContain(r1[1].documentId)
    expect(r1[2].documentId).toBe("LGS")

    // 2. Prestaciones laborales -> CCT
    const q2 = "Prestaciones laborales"
    const i2 = classifyWorkerQueryIntent(q2)
    expect(i2).toBe("CONTRACTUAL")
    const cct2 = mockSource("S1", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 100)
    const lft2 = mockSource("S2", "LFT", "Ley Federal del Trabajo", 250)
    expect(getNormativePriority(cct2.documentId, cct2.documento, i2)).toBe(1)
    expect(getNormativePriority(lft2.documentId, lft2.documento, i2)).toBe(3)
    const r2 = rerankByNormativePriority([lft2, cct2], q2)
    expect(r2[0].documentId).toBe("CCT-IMSS-SNTSS-2025-2027")

    // 3. Impugnación sindical -> Estatutos
    const q3 = "Impugnación sindical"
    const i3 = classifyWorkerQueryIntent(q3)
    expect(i3).toBe("SINDICAL")
    const est3 = mockSource("S1", "SNTSS-ESTATUTOS-OCT2022", "Estatutos SNTSS", 100)
    const cct3 = mockSource("S2", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 150)
    const lft3 = mockSource("S3", "LFT", "Ley Federal del Trabajo", 200)
    expect(getNormativePriority(est3.documentId, est3.documento, i3)).toBe(1)
    expect(getNormativePriority(cct3.documentId, cct3.documento, i3)).toBe(2)
    expect(getNormativePriority(lft3.documentId, lft3.documento, i3)).toBe(3)
    const r3 = rerankByNormativePriority([lft3, cct3, est3], q3)
    expect(r3[0].documentId).toBe("SNTSS-ESTATUTOS-OCT2022")
    expect(r3[1].documentId).toBe("CCT-IMSS-SNTSS-2025-2027")
    expect(r3[2].documentId).toBe("LFT")

    // 4. Cambio de adscripción -> CCT y reglamentación laboral
    const q4 = "Cambio de adscripción"
    const i4 = classifyWorkerQueryIntent(q4)
    expect(i4).toBe("CAMBIO_ADSCRIPCION")
    const cct4 = mockSource("S1", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 100)
    const bolsa4 = mockSource("S2", "IMSS-REGLAMENTO-BOLSA-DE-TRABAJO", "Reglamento de Bolsa de Trabajo", 90)
    const lft4 = mockSource("S3", "LFT", "Ley Federal del Trabajo", 220)
    expect(getNormativePriority(cct4.documentId, cct4.documento, i4)).toBe(1)
    expect(getNormativePriority(bolsa4.documentId, bolsa4.documento, i4)).toBe(1)
    expect(getNormativePriority(lft4.documentId, lft4.documento, i4)).toBe(3)
    const r4 = rerankByNormativePriority([lft4, bolsa4, cct4], q4)
    expect(["CCT-IMSS-SNTSS-2025-2027", "IMSS-REGLAMENTO-BOLSA-DE-TRABAJO"]).toContain(r4[0].documentId)
    expect(["CCT-IMSS-SNTSS-2025-2027", "IMSS-REGLAMENTO-BOLSA-DE-TRABAJO"]).toContain(r4[1].documentId)
    expect(r4[2].documentId).toBe("LFT")

    // 5. Derechos como paciente -> Legislación sanitaria
    const q5 = "Derechos como paciente"
    const i5 = classifyWorkerQueryIntent(q5)
    expect(i5).toBe("PACIENTE_BENEFICIARIO")
    const lgs5 = mockSource("S1", "LGS", "Ley General de Salud", 100)
    const nomPac5 = mockSource("S2", "NOM-004-SSA3-2012", "Del expediente clínico de los pacientes", 90)
    const cct5 = mockSource("S3", "CCT-IMSS-SNTSS-2025-2027", "Contrato Colectivo de Trabajo IMSS-SNTSS", 250)
    expect(getNormativePriority(lgs5.documentId, lgs5.documento, i5)).toBe(1)
    expect(getNormativePriority(nomPac5.documentId, nomPac5.documento, i5)).toBe(1)
    expect(getNormativePriority(cct5.documentId, cct5.documento, i5)).toBe(3)
    const r5 = rerankByNormativePriority([cct5, nomPac5, lgs5], q5)
    expect(["LGS", "NOM-004-SSA3-2012"]).toContain(r5[0].documentId)
    expect(["LGS", "NOM-004-SSA3-2012"]).toContain(r5[1].documentId)
    expect(r5[2].documentId).toBe("CCT-IMSS-SNTSS-2025-2027")
  })
})
