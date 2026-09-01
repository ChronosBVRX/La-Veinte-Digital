// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import "fake-indexeddb/auto"
import {
  renderStoredEscritoToPdfFile,
  generarNombreArchivoPdf,
  sanitizeFileName,
} from "@/shared/lib/escrito-pdf-renderer"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"
import { saveBlobResource } from "../services/escritos-indexeddb"

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

  it("renderStoredEscritoToPdfFile genera un documento PDF Carta con firma, atenciones, copias y anexos panorámicos y verticales", async () => {
    const userId = "usr_pdf_test"
    const dummyBlob = new Blob(["image_bytes"], { type: "image/png" })

    const sigRef = await saveBlobResource(userId, "doc_1", "firma", "sig", dummyBlob)
    const widePhotoRef = await saveBlobResource(userId, "doc_1", "anexo", "wide", dummyBlob)
    const tallPhotoRef = await saveBlobResource(userId, "doc_1", "anexo", "tall", dummyBlob)

    const draft = createEmptyEscritoDraftV2(userId, "aclaracion", {
      id: "doc_1",
      asunto: "Aclaración sobre pago de estímulo de puntualidad",
      destino: { cargo: "Jefe de Personal", nombre: "Lic. Carlos Morales" },
      ciudad: "Morelia, Mich.",
      fecha: "2026-08-31",
      atencion: [
        { id: "at_1", cargo: "Representante Sindical", nombre: "C. Laura Gómez" },
        { id: "at_2", cargo: "Subdirector Médico", nombre: "Dr. Fernando Ruiz" },
      ],
      cuerpo:
        "Párrafo 1: En la primera quincena de agosto no se vio reflejado el estímulo de puntualidad.\n\n" +
        "Párrafo 2: Se anexa copia de los registros de checada biométrica donde consta mi asistencia puntual en todas las jornadas.\n\n" +
        "Párrafo 3: Por lo anterior, solicito la regularización y reintegro del concepto en la nómina inmediata.",
      copias: [
        { id: "cp_1", cargo: "Secretaría de Conflictos", nombre: "SNTSS Sección XX" },
        { id: "cp_2", cargo: "Archivo Personal", nombre: "Expediente del Trabajador" },
      ],
      firmaRef: sigRef,
      anexos: [
        {
          id: "anx_wide",
          nombre: "Captura panorámica checador",
          descripcion: "Foto horizontal del reloj checador",
          tipo: "image/png",
          size: 2048,
          storageRef: widePhotoRef,
        },
        {
          id: "anx_tall",
          nombre: "Oficio vertical de solicitud",
          descripcion: "Foto vertical del comprobante",
          tipo: "image/png",
          size: 4096,
          storageRef: tallPhotoRef,
        },
      ],
    })

    const pdfFile = await renderStoredEscritoToPdfFile(draft, userId, {
      nombreTrabajador: "Mario Hernández Silva",
      matricula: "99182736",
      categoria: "Enfermero General",
      adscripcion: "HGZ No. 1 Charo",
    })

    expect(pdfFile).toBeDefined()
    expect(pdfFile).toBeInstanceOf(File)
    expect(pdfFile.type).toBe("application/pdf")
    expect(pdfFile.size).toBeGreaterThan(1000)
  })
})
