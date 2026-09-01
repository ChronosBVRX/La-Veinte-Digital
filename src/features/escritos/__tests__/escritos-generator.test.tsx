// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { EscritosGenerator } from "../components/EscritosGenerator"
import { guardarEscrito, getEscritosGuardados } from "../services/escritos-storage"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: {
              id: "user-gen-123",
              email: "test@example.com",
            },
          },
        }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: "user-gen-123",
                full_name: "Rosa Elena Medina",
                matricula: "99887766",
                categoria: "Enfermera General",
                adscripcion: "HGZ No. 1",
              },
            }),
        }),
      }),
    }),
  }),
}))

describe("EscritosGenerator component integration", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it(
    "renderiza el generador con perfil y lista los escritos guardados del usuario",
    async () => {
      const userId = "user-gen-123"
      const draft = createEmptyEscritoDraftV2(userId, undefined, {
        id: "esc-test-1",
        titulo: "Solicitud de Vacaciones Extraordinarias",
        cuerpo: "Por medio de la presente...",
        fecha: "2026-08-31",
      })
      guardarEscrito(draft, userId)

      render(<EscritosGenerator />)

      // Esperar a que cargue el perfil y el escrito
      await waitFor(
        () => {
          expect(screen.getByText("Rosa Elena Medina")).toBeDefined()
          expect(screen.getByText(/Solicitud de Vacaciones Extraordinarias/i)).toBeDefined()
        },
        { timeout: 8000 }
      )

      // Botones de acción en la lista
      expect(screen.getByTitle("Editar escrito")).toBeDefined()
      expect(screen.getByTitle("Ver e imprimir documento")).toBeDefined()
      expect(screen.getByTitle("Duplicar como nuevo borrador")).toBeDefined()
    },
    15000
  )

  it(
    "permite duplicar un escrito existente y agrega la copia a la lista",
    async () => {
      const userId = "user-gen-123"
      const draft = createEmptyEscritoDraftV2(userId, undefined, {
        id: "esc-test-orig",
        titulo: "Petición Original",
        cuerpo: "Cuerpo original",
      })
      guardarEscrito(draft, userId)

      render(<EscritosGenerator />)

      await waitFor(
        () => {
          expect(screen.getByText("Petición Original")).toBeDefined()
        },
        { timeout: 8000 }
      )

      const btnDuplicar = screen.getByTitle("Duplicar como nuevo borrador")
      fireEvent.click(btnDuplicar)

      await waitFor(
        () => {
          const list = getEscritosGuardados(userId)
          expect(list.length).toBe(2)
          expect(screen.getByText(/Copia de Petición Original/i)).toBeDefined()
        },
        { timeout: 8000 }
      )
    },
    15000
  )

  it(
    "al pulsar 'Editar' abre el borrador en el editor sin perder datos",
    async () => {
      const userId = "user-gen-123"
      const draft = createEmptyEscritoDraftV2(userId, undefined, {
        id: "esc-test-edit",
        titulo: "Escrito para Editar",
        cuerpo: "Texto largo para edición en la etapa 2",
      })
      guardarEscrito(draft, userId)

      render(<EscritosGenerator />)

      await waitFor(
        () => {
          expect(screen.getByText("Escrito para Editar")).toBeDefined()
        },
        { timeout: 8000 }
      )

      const btnEditar = screen.getByTitle("Editar escrito")
      fireEvent.click(btnEditar)

      await waitFor(
        () => {
          expect(screen.getByText(/Revisa y modifica tu escrito/i)).toBeDefined()
          expect(screen.getByDisplayValue("Texto largo para edición en la etapa 2")).toBeDefined()
        },
        { timeout: 8000 }
      )
    },
    15000
  )
})
