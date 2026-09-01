import { describe, it, expect } from "vitest"
import {
  renderEscritoToPdf,
  generarNombreArchivoPdf,
  sanitizeFileName,
  renderEscritoToPdfFile,
} from "@/shared/lib/escrito-pdf-renderer"
import { createEmptyEscritoDraftV2, type EscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("escrito-pdf-renderer", () => {
  it("sanitiza nombres de archivo eliminando caracteres especiales y acentos", () => {
    expect(sanitizeFileName("Solicitud de Vacaciones (Urgente!) / 2026")).toBe(
      "Solicitud_de_Vacaciones_Urgente_2026"
    )
    expect(sanitizeFileName("Aclaración de nómina & bono")).toBe(
      "Aclaracion_de_nomina_y_bono"
    )
  })

  it("genera un nombre de archivo seguro con fecha y prefijo de tipo", () => {
    const draft: EscritoDraftV2 = {
      ...createEmptyEscritoDraftV2("user-1", undefined, {
        tipo: "solicitud",
        titulo: "Cambio de Adscripción a Morelia",
        fecha: "2026-08-31",
      }),
    }

    const filename = generarNombreArchivoPdf(draft)
    expect(filename).toMatch(/^Solicitud_Cambio_de_Adscripcion_a_Morelia_2026-08-31_\d+\.pdf$/)
  })

  it("renderEscritoToPdf genera un documento jsPDF con texto seleccionable en formato Carta", async () => {
    const draft: EscritoDraftV2 = {
      ...createEmptyEscritoDraftV2("user-1", undefined, {
        tipo: "solicitud",
        titulo: "Solicitud de Permiso",
        asunto: "Solicitud formal de permiso",
        destino: {
          cargo: "Jefe de Departamento",
          nombre: "Lic. Carlos Fuentes",
        },
        ciudad: "Morelia, Michoacán",
        fecha: "2026-08-31",
        cuerpo: "Por medio del presente documento me dirijo a usted...\n\nExpongo los hechos correspondientes.",
        atencion: [{ cargo: "Secretario", nombre: "Dr. Morales" }],
        copias: [{ cargo: "Delegado", nombre: "Enf. Solís" }],
      }),
    }

    const profile = {
      nombre: "María Elena García",
      matricula: "98765432",
      categoria: "Enfermera General 80",
      adscripcion: "HGZ No. 1 Morelia",
    }

    const doc = await renderEscritoToPdf(draft, profile)
    expect(doc).toBeDefined()
    expect(doc.internal.pageSize.getWidth()).toBe(612)
    expect(doc.internal.pageSize.getHeight()).toBe(792)
  })

  it("renderEscritoToPdfFile produce un objeto File idéntico con tipo application/pdf", async () => {
    const draft: EscritoDraftV2 = createEmptyEscritoDraftV2("user-1", undefined, {
      titulo: "Oficio Importante",
      cuerpo: "Texto del oficio",
      fecha: "2026-08-31",
    })

    const file = await renderEscritoToPdfFile(draft, { nombre: "Test Worker" })
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe("application/pdf")
    expect(file.name).toMatch(/\.pdf$/)
    expect(file.size).toBeGreaterThan(0)
  })
})
