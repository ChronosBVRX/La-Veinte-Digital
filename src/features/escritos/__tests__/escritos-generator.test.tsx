// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { EscritosGenerator } from "../components/EscritosGenerator"
import { guardarEscrito } from "../services/escritos-storage"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "usr_gen_123", email: "test@imss.gob.mx" } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { full_name: "Dr. Gabriel Soto", matricula: "123456" },
          }),
        }),
      }),
    }),
  }),
}))

describe("EscritosGenerator (Componente Principal)", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("renderiza el generador y muestra la lista de escritos guardados del usuario", async () => {
    const doc = createEmptyEscritoDraftV2("usr_gen_123", "solicitud", {
      titulo: "Solicitud de Permiso Económico",
      fecha: "2026-08-31",
    })
    guardarEscrito(doc, "usr_gen_123")

    render(<EscritosGenerator />)

    await waitFor(() => {
      expect(screen.getByText(/Generador de Escritos/i)).toBeDefined()
      expect(screen.getByText(/Solicitud de Permiso Económico/i)).toBeDefined()
    })
  })

  it("permite duplicar un escrito existente y agrega la copia a la lista", async () => {
    const doc = createEmptyEscritoDraftV2("usr_gen_123", "queja", {
      titulo: "Queja por turno extra",
    })
    guardarEscrito(doc, "usr_gen_123")

    render(<EscritosGenerator />)

    await waitFor(() => {
      expect(screen.getByText(/Queja por turno extra/i)).toBeDefined()
    })

    const duplicateBtn = screen.getByRole("button", { name: /Duplicar/i })
    fireEvent.click(duplicateBtn)

    await waitFor(() => {
      expect(screen.getByText(/Copia de Queja por turno extra/i)).toBeDefined()
    })
  })

  it("al pulsar 'Editar' abre el borrador en la etapa 2 de edición", async () => {
    const doc = createEmptyEscritoDraftV2("usr_gen_123", "solicitud", {
      titulo: "Oficio para editar",
      cuerpo: "Texto del oficio que se desea editar.",
    })
    guardarEscrito(doc, "usr_gen_123")

    render(<EscritosGenerator />)

    await waitFor(() => {
      expect(screen.getByText(/Oficio para editar/i)).toBeDefined()
    })

    const editBtn = screen.getByRole("button", { name: /✏ Editar/i })
    fireEvent.click(editBtn)

    await waitFor(() => {
      expect(screen.getByText(/Revisa y personaliza tu escrito/i)).toBeDefined()
      expect(screen.getByDisplayValue(/Texto del oficio que se desea editar./i)).toBeDefined()
    })
  })
})
