import { describe, expect, it } from "vitest"
import { parseStructure } from "@/features/normativa/services/structure"

function pagesFromText(full: string) {
  return full.split("@@PAGE@@").map((t, i) => ({ pageIndex: i + 1, printedPage: String(i + 1), text: t.trim() }))
}

const LEY_SAMPLE = `
TÍTULO PRIMERO
Disposiciones Generales
@@PAGE@@
CAPÍTULO I
Ámbito de aplicación
Artículo 1.- La presente Ley es de observancia general.
Artículo 2.- Se entiende por trabajo toda actividad humana.
@@PAGE@@
CAPÍTULO II
De la jornada
Artículo 67.- La jornada máxima será de ocho horas.
Artículo 68 Bis.- El tiempo extraordinario se pagará con un ciento por ciento más.
@@PAGE@@
TRANSITORIOS
PRIMERO.- La presente Ley entrará en vigor al día siguiente de su publicación.
Última Reforma DOF 14-05-2026
`

describe("parseStructure — leyes federales", () => {
  it("detecta títulos, capítulos, artículos, bis y transitorios", () => {
    const r = parseStructure({
      docId: "LFT",
      versionId: "V1",
      type: "federal_law",
      pages: pagesFromText(LEY_SAMPLE),
    })

    const kinds = r.sections.map((s) => `${s.kind}:${s.label}`)
    expect(kinds).toContain("titulo:TÍTULO PRIMERO")
    expect(kinds).toContain("articulo:Artículo 1")
    expect(kinds).toContain("articulo:Artículo 68 Bis")
    expect(kinds).toContain("transitorios:TRANSITORIOS")
    expect(r.lastReformDate).toBe("2026-05-14")
  })

  it("asocia cada fragmento con su artículo", () => {
    const r = parseStructure({
      docId: "LFT",
      versionId: "V1",
      type: "federal_law",
      pages: pagesFromText(LEY_SAMPLE),
    })
    const chunk68 = r.chunks.find((c) => c.text.includes("ciento por ciento"))
    expect(chunk68?.article).toBe("68 Bis")
    const chunk67 = r.chunks.find((c) => c.text.includes("ocho horas"))
    expect(chunk67?.article).toBe("67")
  })
})

const CCT_SAMPLE = `
CONTRATO COLECTIVO DE TRABAJO
@@PAGE@@
Capítulo I.- Definiciones
Cláusula 1.- Definiciones
Para la interpretación y aplicación de este Contrato se establecen las siguientes definiciones:
Acoso Laboral: Trato hostil o vejatorio.
@@PAGE@@
Cláusula 2.- De la jornada
La jornada de trabajo será de ocho horas.
@@PAGE@@
Cláusula 99.- Del cambio de residencia
El trabajador tendrá derecho al pago de 60 días de sueldo.
@@PAGE@@
REGLAMENTO DE BOLSA DE TRABAJO
@@PAGE@@
RÉGIMEN DE JUBILACIONES Y PENSIONES
`

describe("parseStructure — CCT", () => {
  it("detecta cláusulas, bis, bloques de reglamentos y régimen", () => {
    const r = parseStructure({
      docId: "CCT-IMSS-SNTSS-2025-2027",
      versionId: "2025-2027",
      type: "collective_agreement",
      pages: pagesFromText(CCT_SAMPLE),
    })
    const labels = r.sections.map((s) => s.label)
    expect(labels).toContain("Cláusula 1")
    expect(labels).toContain("Cláusula 99")
    expect(labels.some((l) => l.includes("REGLAMENTO DE BOLSA"))).toBe(true)
    expect(labels.some((l) => l.includes("RÉGIMEN DE JUBILACIONES"))).toBe(true)
  })

  it("no confunde el membrete CONTRATO COLECTIVO con una cláusula", () => {
    const r = parseStructure({
      docId: "CCT-IMSS-SNTSS-2025-2027",
      versionId: "2025-2027",
      type: "collective_agreement",
      pages: pagesFromText(CCT_SAMPLE),
    })
    expect(r.sections.filter((s) => s.label.includes("COLECTIVO DE TRABAJO") && s.kind !== "bloque")).toHaveLength(0)
  })
})

const PROC_SAMPLE = `
Procedimiento para la Dictaminación de los Accidentes de Trabajo
Clave: 3A21-003-010
@@PAGE@@
1. OBJETIVO
Dictaminar los accidentes de trabajo conforme al CCT.
@@PAGE@@
2. BASE NORMATIVA
Cláusula 94 del CCT, Artículo 67 de la LFT, Reglamento Interior de Trabajo.
@@PAGE@@
3. DESCRIPCIÓN DE ACTIVIDADES
El aviso ST-7 se presenta para calificar el probable accidente de trabajo.
Anexo ST-2, ST-3 y ST-8.
`

describe("parseStructure — procedimientos IMSS", () => {
  it("detecta clave, secciones y formatos ST", () => {
    const r = parseStructure({
      docId: "IMSS-3A21-003-010",
      versionId: "V1",
      type: "procedure",
      pages: pagesFromText(PROC_SAMPLE),
      expectedKey: "3A21-003-010",
    })
    expect(r.docKey).toBe("3A21-003-010")
    expect(r.keyMatch).toBe(true)
    expect(r.sections.map((s) => s.label)).toContain("1. OBJETIVO")
    expect(r.stFormats).toEqual(expect.arrayContaining(["ST-2", "ST-3", "ST-7", "ST-8"]))
  })

  it("marca SOURCE_MISMATCH cuando la clave no coincide", () => {
    const r = parseStructure({
      docId: "IMSS-1A74-003-031",
      versionId: "V1",
      type: "procedure",
      pages: pagesFromText(PROC_SAMPLE),
      expectedKey: "1A74-003-031",
    })
    expect(r.keyMatch).toBe(false)
    expect(r.docKey).toBe("3A21-003-010")
  })
})

const NOM_SAMPLE = `
1. Objetivo
Establecer los elementos para identificar y analizar los factores de riesgo psicosocial.
@@PAGE@@
2. Campo de aplicación
La presente Norma rige en todo el territorio nacional.
@@PAGE@@
4. Obligaciones del patrón
El patrón deberá identificar los factores de riesgo psicosocial.
@@PAGE@@
7. Vigilancia
La Secretaría del Trabajo vigilará el cumplimiento.
`

describe("parseStructure — NOM", () => {
  it("detecta secciones numeradas", () => {
    const r = parseStructure({
      docId: "NOM-035-STPS-2018",
      versionId: "V1",
      type: "NOM",
      pages: pagesFromText(NOM_SAMPLE),
    })
    const labels = r.sections.map((s) => s.label)
    expect(labels).toContain("1. Objetivo")
    expect(labels).toContain("4. Obligaciones del patrón")
  })
})
