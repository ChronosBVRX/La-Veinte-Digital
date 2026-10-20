// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { BibliotecaNormativaPage } from "../BibliotecaNormativaPage"
import { backNavigationCoordinator } from "@/shared/navigation/back-navigation-coordinator"
import type { LibraryData, LibraryDocumentEntry } from "../../services/catalog"

const mockDocs = [
  {
    id: "CCT-IMSS-SNTSS-2025-2027",
    key: "CCT 2025-2027",
    title: "Contrato Colectivo de Trabajo 2025-2027",
    url: "https://www.imss.gob.mx/sites/all/statics/pdf/CCT-2025-2027.pdf",
    type: "collective_agreement",
    category: "cct",
    validity: "CURRENT",
    source: "IMSS",
    year: 2025,
    sizeBytes: 1000,
    pages: 100,
    sha256: "abc",
    officialName: "CCT",
    hasLocalCopy: true,
    summary: "El pacto supremo",
    sections: 10,
    versionStatus: "VERIFIED",
  },
  {
    id: "IMSS-2610-003-017",
    key: "2610-003-017",
    title: "Procedimiento para la atención médica y enfermería en unidades de segundo nivel",
    url: "https://reposipot.imss.gob.mx/normatividad/DNMR/Procedimiento/2610-003-017.pdf",
    type: "procedure",
    category: "flujos-clinicos",
    validity: "CURRENT",
    source: "IMSS",
    year: 2024,
    sizeBytes: 1000,
    pages: 50,
    sha256: "def",
    officialName: "Procedimiento Enfermería",
    hasLocalCopy: true,
    summary: "Guía de enfermería",
    sections: 5,
    versionStatus: "VERIFIED",
  },
] as unknown as LibraryDocumentEntry[]

const mockData = {
  available: true,
  health: {
    totalDocs: 2,
    verified: 2,
    pending: 0,
    historical: 0,
    totalChunks: 10,
    totalCitations: 10,
  },
  documents: mockDocs,
} as unknown as LibraryData

describe("BibliotecaNormativaPage - Flujo de apertura del lector", () => {
  it("abre el modal intermedio y luego pasa correctamente al lector fullscreen", async () => {
    render(<BibliotecaNormativaPage data={mockData} />)

    // Encontrar tarjeta en la cuadrícula de preámbulos
    const readBtns = screen.getAllByRole("button", { name: /leer/i })
    expect(readBtns.length).toBeGreaterThan(0)

    // Clic en la primera tarjeta
    await act(async () => {
      fireEvent.click(readBtns[0])
    })

    // Debe abrirse el modal intermedio
    const openReaderBtn = screen.getByTitle("Abrir documento en el lector oficial interactivo")
    expect(openReaderBtn).toBeTruthy()
    expect(screen.getByText("¿Qué contiene este documento?")).toBeTruthy()

    // Clic en 'Abrir documento en el lector'
    await act(async () => {
      fireEvent.click(openReaderBtn)
    })

    // Ahora debe estar montado el lector fullscreen (DocumentDetail)
    const backBtn = screen.getByTitle("Volver a la biblioteca")
    expect(backBtn).toBeTruthy()

    // El modal intermedio ya no debe estar
    expect(screen.queryByTitle("Abrir documento en el lector oficial interactivo")).toBeNull()

    // El coordinador tiene registrada la capa del visor
    expect(backNavigationCoordinator.hasLayers()).toBe(true)

    // Simular retroceso mediante el botón Atrás canónico (Android/iOS)
    await act(async () => {
      backNavigationCoordinator.back()
    })

    // Debe cerrarse el lector y volver a la cuadrícula de preámbulos
    expect(screen.queryByTitle("Volver a la biblioteca")).toBeNull()
    expect(screen.getAllByRole("button", { name: /leer/i }).length).toBeGreaterThan(0)
  })

  it("el botón Volver dentro del lector regresa al catálogo limpiamente", async () => {
    render(<BibliotecaNormativaPage data={mockData} />)

    const readBtns = screen.getAllByRole("button", { name: /leer/i })
    await act(async () => {
      fireEvent.click(readBtns[0])
    })

    const openReaderBtn = screen.getByTitle("Abrir documento en el lector oficial interactivo")
    await act(async () => {
      fireEvent.click(openReaderBtn)
    })

    const backBtn = screen.getByTitle("Volver a la biblioteca")
    expect(backBtn).toBeTruthy()

    // Clic en Volver
    await act(async () => {
      fireEvent.click(backBtn)
    })

    expect(screen.queryByTitle("Volver a la biblioteca")).toBeNull()
    expect(screen.getAllByRole("button", { name: /leer/i }).length).toBeGreaterThan(0)
  })
})
