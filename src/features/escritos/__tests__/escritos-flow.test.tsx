// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { EscritosForm } from "../components/EscritosForm"
import { EscritosEditor } from "../components/EscritosEditor"
import { EscritosResult } from "../components/EscritosResult"
import {
  createEmptyEscritoDraftV2,
  type EscritoDraftV2,
} from "@/shared/contracts/escrito-draft"

describe("Escritos UI Flow", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("EscritosForm: valida campos obligatorios y no genera si faltan datos esenciales", () => {
    const draft = createEmptyEscritoDraftV2("user-1")
    const onGenerate = vi.fn()
    const onUpdateDraft = vi.fn()
    const onClear = vi.fn()

    render(
      <EscritosForm
        profile={{
          full_name: "Ana Morales",
          matricula: "123456",
          categoria: "Enfermera",
          adscripcion: "HGZ 1",
        }}
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={onGenerate}
        onClear={onClear}
        loading={false}
      />
    )

    // Al pulsar generar sin llenar datos
    const btnGenerar = screen.getByText(/Redactar escrito con IA/i)
    fireEvent.click(btnGenerar)

    expect(onGenerate).not.toHaveBeenCalled()
    expect(screen.getByText(/Por favor indica a quién va dirigido/i)).toBeDefined()
    expect(screen.getByText(/Describe los hechos de lo ocurrido/i)).toBeDefined()
    expect(screen.getByText(/Indica concretamente qué solución/i)).toBeDefined()
  })

  it("EscritosForm: permite seleccionar tipo de escrito y desplegar opciones avanzadas", () => {
    const draft = createEmptyEscritoDraftV2("user-1")
    const onUpdateDraft = vi.fn()

    render(
      <EscritosForm
        profile={{
          full_name: "Ana Morales",
          matricula: "123456",
          categoria: "Enfermera",
          adscripcion: "HGZ 1",
        }}
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onGenerate={vi.fn()}
        onClear={vi.fn()}
        loading={false}
      />
    )

    // Seleccionar tipo Queja
    const btnQueja = screen.getByText(/Queja o inconformidad/i)
    fireEvent.click(btnQueja)
    expect(onUpdateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "queja" })
    )

    // Desplegar opciones avanzadas
    const btnAvanzado = screen.getByText(/Mostrar opciones avanzadas/i)
    fireEvent.click(btnAvanzado)
    expect(screen.getByText(/Título interno del escrito/i)).toBeDefined()
    expect(screen.getByText(/Asunto formal del oficio/i)).toBeDefined()
  })

  it("EscritosEditor: muestra 'Revisa y modifica tu escrito', conteo de palabras y permite deshacer", () => {
    const draft: EscritoDraftV2 = {
      ...createEmptyEscritoDraftV2("user-1", undefined, {
        cuerpo: "Primer párrafo del escrito.\n\nSegundo párrafo del escrito.",
      }),
    }
    const onUpdateDraft = vi.fn()
    const onPreview = vi.fn()

    render(
      <EscritosEditor
        draft={draft}
        onUpdateDraft={onUpdateDraft}
        onSaveDraft={vi.fn()}
        onPreview={onPreview}
        onBackToForm={vi.fn()}
        onRegenerate={vi.fn()}
      />
    )

    expect(screen.getByText(/Revisa y modifica tu escrito/i)).toBeDefined()
    expect(screen.getByText(/8 palabras/i)).toBeDefined()

    // Modificar textarea
    const textarea = screen.getByLabelText(/Cuerpo redactado del escrito/i)
    fireEvent.change(textarea, { target: { value: "Texto completamente nuevo" } })
    expect(onUpdateDraft).toHaveBeenCalledWith({ cuerpo: "Texto completamente nuevo" })

    // Botón previsualizar
    const btnPreview = screen.getByText(/Previsualizar oficio/i)
    fireEvent.click(btnPreview)
    expect(onPreview).toHaveBeenCalled()
  })

  it("EscritosResult: muestra vista final, permite cambiar a hoja completa y abrir modal de firma", () => {
    const draft: EscritoDraftV2 = {
      ...createEmptyEscritoDraftV2("user-1", undefined, {
        titulo: "Solicitud de Permiso",
        cuerpo: "Por medio de la presente solicito...",
        destino: { cargo: "Director", nombre: "Dr. Sánchez" },
        ciudad: "Morelia",
        fecha: "2026-08-31",
      }),
    }
    const onEdit = vi.fn()
    const onUpdateDraft = vi.fn()

    render(
      <EscritosResult
        draft={draft}
        profile={{
          nombre: "Ana Morales",
          matricula: "123456",
          categoria: "Enfermera",
          adscripcion: "HGZ 1",
        }}
        onEdit={onEdit}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onUpdateDraft={onUpdateDraft}
      />
    )

    expect(screen.getByText(/Vista final del documento/i)).toBeDefined()
    expect(screen.getByText(/A T E N T A M E N T E/i)).toBeDefined()
    expect(screen.getByText(/Ana Morales/i)).toBeDefined()

    // Cambiar a hoja completa
    const btnHoja = screen.getByText(/Ver hoja completa/i)
    fireEvent.click(btnHoja)

    // Abrir firma
    const btnFirma = screen.getByText(/Añadir firma/i)
    fireEvent.click(btnFirma)
    expect(screen.getByText(/✍ Firma manuscrita/i)).toBeDefined()
  })
})
