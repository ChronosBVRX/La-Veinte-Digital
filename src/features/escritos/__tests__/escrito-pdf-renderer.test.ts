import { describe, it, expect } from "vitest"
import {
  renderEscritoToPdf,
  renderEscritoToPdfFile,
  generarNombreArchivoPdf,
  sanitizeFileName,
} from "@/shared/lib/escrito-pdf-renderer"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("Renderizador de PDF Vectorial Carta (escrito-pdf-renderer)", () => {
  it("sanitiza nombres de archivo para descarga segura", () => {
    expect(sanitizeFileName("Solicitud de Vacaciones 2026/08")).toBe("solicitud_de_vacaciones_2026_08")
    expect(sanitizeFileName("Dra. María Elena Ramos (Clínica 80)")).toBe("dra_maria_elena_ramos_clinica_80")
  })

  it("genera un nombre de archivo descriptivo y estandarizado", () => {
    const draft = createEmptyEscritoDraftV2("usr_1", "solicitud", {
      destino: { cargo: "Director", nombre: "Dr. Juan Pérez" },
      fecha: "2026-08-31",
    })
    const name = generarNombreArchivoPdf(draft)
    expect(name).toBe("escrito_solicitud_dr_juan_perez_2026-08-31.pdf")
  })

  it("renderEscritoToPdf genera un documento jsPDF en tamaño Carta con todas las secciones", async () => {
    const draft = createEmptyEscritoDraftV2("usr_1", "aclaracion", {
      asunto: "Aclaración sobre pago de estímulo de puntualidad",
      destino: { cargo: "Jefe de Personal", nombre: "Lic. Carlos Morales" },
      ciudad: "Morelia, Mich.",
      fecha: "2026-08-31",
      atencion: [
        { id: "at_1", cargo: "Representante Sindical", nombre: "C. Laura Gómez" },
        { id: "at_2", cargo: "Subdirector Médico", nombre: "Dr. Fernando Ruiz" },
      ],
      cuerpo:
        "Párrafo 1: En la primera quincena de agosto no se vio reflejado el estímulo de puntualidad correspondiente a la cláusula 97 del CCT.\n\n" +
        "Párrafo 2: Se anexa copia de los registros de checada biométrica donde consta mi asistencia puntual en todas las jornadas.\n\n" +
        "Párrafo 3: Por lo anterior, solicito la regularización y reintegro del concepto en la nómina inmediata.",
      copias: [
        { id: "cp_1", cargo: "Secretaría de Conflictos", nombre: "SNTSS Sección XX" },
        { id: "cp_2", cargo: "Archivo Personal", nombre: "Expediente del Trabajador" },
      ],
    })

    const pdfDoc = await renderEscritoToPdf(draft, {
      nombreTrabajador: "Mario Hernández Silva",
      matricula: "99182736",
      categoria: "Enfermero General",
      adscripcion: "HGZ No. 1 Charo",
    })

    expect(pdfDoc).toBeDefined()
    // Medidas de página Carta en pt: 612 x 792
    expect(pdfDoc.internal.pageSize.getWidth()).toBe(612)
    expect(pdfDoc.internal.pageSize.getHeight()).toBe(792)
    expect(pdfDoc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it("renderEscritoToPdfFile crea un archivo File válido para descarga o visor web", async () => {
    const draft = createEmptyEscritoDraftV2("usr_1", "libre", {
      titulo: "Oficio Libre de Comunicación",
      cuerpo: "Por este medio comunico el acuerdo alcanzado...",
    })

    const file = await renderEscritoToPdfFile(draft)
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe("application/pdf")
    expect(file.size).toBeGreaterThan(500)
  })
})
