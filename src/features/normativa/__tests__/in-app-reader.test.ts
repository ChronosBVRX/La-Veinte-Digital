import { describe, it, expect } from "vitest"
import { NormativeCatalog } from "../services/catalog"
import { PREAMBULOS_NORMATIVOS, getPreambulo } from "../data/preambulos-normativos"
import { getOrSynthesizePreambulo, formatTipoDocumento } from "../lib/preambulo-helper"

describe("Biblioteca Normativa - Lector In-App y Prevención de Confusión CCT", () => {
  const catalog = new NormativeCatalog(process.cwd())
  const lib = catalog.libraryData()

  it("libraryData() incorpora todos los documentos de PREAMBULOS_NORMATIVOS", () => {
    expect(lib.available).toBe(true)
    expect(lib.documents.length).toBeGreaterThanOrEqual(PREAMBULOS_NORMATIVOS.length)

    // Verificar documentos clave solicitados por los trabajadores
    const enfermeria = lib.documents.find((d) => d.id === "IMSS-2610-003-017")
    expect(enfermeria).toBeDefined()
    expect(enfermeria?.title).toContain("Enfermería")
    expect(enfermeria?.category).toBe("flujos-clinicos")

    const auo = lib.documents.find((d) => d.id === "IMSS-1A74-003-AUO")
    expect(auo).toBeDefined()
    expect(auo?.title).toContain("Auxiliar Universal de Oficinas")
    expect(auo?.category).toBe("administrativos")

    const plantilla = lib.documents.find((d) => d.id === "IMSS-2900-B03-002")
    expect(plantilla).toBeDefined()
    expect(plantilla?.title.toLowerCase()).toContain("plantillas")

    const asistente = lib.documents.find((d) => d.id === "IMSS-2430-003-018")
    expect(asistente).toBeDefined()
    expect(asistente?.title).toContain("Asistente Médica")

    const radiologo = lib.documents.find((d) => d.id === "IMSS-2430-003-022")
    expect(radiologo).toBeDefined()
    expect(radiologo?.title).toContain("Radiodiagnóstico")
  })

  it("getPreambulo() localiza con precisión Enfermería y NO lo confunde con CCT", () => {
    const enf = getPreambulo("IMSS-2610-003-017")
    expect(enf).toBeDefined()
    expect(enf?.documentId).toBe("IMSS-2610-003-017")
    expect(enf?.tituloComun).toContain("Enfermería")
    expect(enf?.documentId).not.toBe("CCT-IMSS-SNTSS-2025-2027")
  })

  it("getPreambulo() localiza con precisión AUO y 2900-B03-002", () => {
    const auo = getPreambulo("IMSS-1A74-003-AUO")
    expect(auo).toBeDefined()
    expect(auo?.documentId).toBe("IMSS-1A74-003-AUO")
    expect(auo?.categoria).toBe("administrativos")

    const plantilla = getPreambulo("IMSS-2900-B03-002")
    expect(plantilla).toBeDefined()
    expect(plantilla?.claveOficial).toBe("2900-B03-002")
  })

  it("CCT::BOLSA y CCT::ESCALAFON son normativas independientes y no se confunden con el CCT general", () => {
    const bolsa = getPreambulo("CCT::BOLSA")
    expect(bolsa).toBeDefined()
    expect(bolsa?.tituloComun).toContain("Bolsa de Trabajo")
    expect(bolsa?.documentId).not.toBe("CCT-IMSS-SNTSS-2025-2027")

    const escalafon = getPreambulo("CCT::ESCALAFON")
    expect(escalafon).toBeDefined()
    expect(escalafon?.tituloComun).toContain("Escalafón")
    expect(escalafon?.documentId).not.toBe("CCT-IMSS-SNTSS-2025-2027")
  })

  it("formatTipoDocumento formatea correctamente categorías clínicas y administrativas", () => {
    expect(formatTipoDocumento("flujos-clinicos")).toBe("Procedimiento Clínico")
    expect(formatTipoDocumento("administrativos")).toBe("Procedimiento Administrativo")
    expect(formatTipoDocumento("procedure")).toBe("Procedimiento Institucional")
    expect(formatTipoDocumento("collective_agreement")).toBe("Contrato Colectivo")
    expect(formatTipoDocumento("union_statutes")).toBe("Estatutos Sindicales")
  })

  it("getOrSynthesizePreambulo devuelve el preámbulo exacto sin redirigir al CCT", () => {
    const docEnf = lib.documents.find((d) => d.id === "IMSS-2610-003-017")
    expect(docEnf).toBeDefined()
    if (docEnf) {
      const p = getOrSynthesizePreambulo(docEnf)
      expect(p.documentId).toBe("IMSS-2610-003-017")
      expect(p.tituloComun).toContain("Enfermería")
      expect(p.enUnaFrase).toContain("Enfermeras Generales")
      expect(p.documentId).not.toBe("CCT-IMSS-SNTSS-2025-2027")
    }
  })

  it("todos los 57 PREAMBULOS_NORMATIVOS tienen urlOficial verificada", () => {
    expect(PREAMBULOS_NORMATIVOS.length).toBe(57)
    for (const p of PREAMBULOS_NORMATIVOS) {
      expect(p.urlOficial, `Preámbulo ${p.documentId} debe tener urlOficial`).toBeDefined()
      expect(p.urlOficial).toMatch(/^https?:\/\//)
    }
  })

  it("openOriginalAtPage localiza facsímiles para contratos y reglamentos cuando están presentes", () => {
    const cctRes = catalog.openOriginalAtPage("CCT-IMSS-SNTSS-2025-2027", 1)
    expect(cctRes).not.toBeNull()
    expect(cctRes?.filePath.toLowerCase()).toMatch(/(cct|clausulas)/)

    const estatutosRes = catalog.openOriginalAtPage("SNTSS-ESTATUTOS-2022", 1)
    expect(estatutosRes).not.toBeNull()
    expect(estatutosRes?.filePath.toLowerCase()).toContain("estatutos")

    const auoRes = catalog.openOriginalAtPage("IMSS-1A74-003-AUO", 1)
    expect(auoRes).not.toBeNull()
    expect(auoRes?.filePath.toLowerCase()).toMatch(/(auo|profesiogramas)/)

    // Para procedimientos que no se incluyen en git por tamaño, openOriginalAtPage devuelve null o ruta válida sin arrojar error
    const enfermeriaRes = catalog.openOriginalAtPage("IMSS-2610-003-017", 1)
    if (enfermeriaRes) {
      expect(enfermeriaRes.filePath).toMatch(/\.(pdf|html)$/)
    }
  })
})

