// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { CalendarioLaboral } from "../CalendarioLaboral"
import { clearLocal } from "@/features/agenda-laboral/services/commitments-local"

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      delete: () => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}))

describe("<CalendarioLaboral /> con Días de Descanso CCT y Guardias", () => {
  beforeEach(() => {
    clearLocal()
    window.localStorage.clear()
  })

  it("renderiza el filtro institucional 'Descanso CCT'", () => {
    render(<CalendarioLaboral fullPage />)
    const filters = screen.getAllByText(/Descanso CCT/i)
    expect(filters.length).toBeGreaterThanOrEqual(1)
  })

  it("ningún día de descanso obligatorio está marcado automáticamente como guardia personal", () => {
    render(<CalendarioLaboral fullPage />)
    expect(screen.queryByText("Mi guardia confirmada")).toBeNull()
  })

  it("al seleccionar el 16 de septiembre muestra la ficha normativa y el botón 'Tengo guardia'", async () => {
    const { container } = render(<CalendarioLaboral fullPage />)

    await waitFor(() => {
      expect(screen.getByText("Todos")).toBeDefined()
    })

    const buttons = container.querySelectorAll("button")
    let targetBtn: HTMLButtonElement | null = null
    buttons.forEach((b) => {
      const label = b.getAttribute("aria-label") || ""
      if (label.includes("16 de")) {
        targetBtn = b
      }
    })

    expect(targetBtn).not.toBeNull()

    await act(async () => {
      fireEvent.click(targetBtn!)
    })

    await waitFor(() => {
      expect(screen.getByText(/Cláusula 46-III/i)).toBeDefined()
      expect(screen.getByText(/Tengo guardia asignada/i)).toBeDefined()
    })
  })

  it("permite abrir el formulario de guardia, confirmar una guardia y luego desmarcarla", async () => {
    const { container } = render(<CalendarioLaboral fullPage />)

    await waitFor(() => {
      expect(screen.getByText("Todos")).toBeDefined()
    })

    const buttons = container.querySelectorAll("button")
    let targetBtn: HTMLButtonElement | null = null
    buttons.forEach((b) => {
      const label = b.getAttribute("aria-label") || ""
      if (label.includes("16 de")) {
        targetBtn = b
      }
    })

    expect(targetBtn).not.toBeNull()

    await act(async () => {
      fireEvent.click(targetBtn!)
    })

    const tengoGuardiaBtn = await screen.findByText(/Tengo guardia asignada/i)
    expect(tengoGuardiaBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(tengoGuardiaBtn)
    })

    expect(screen.getByText("Registrar horario de guardia")).toBeDefined()
    const confirmBtn = screen.getByText(/Confirmar mi guardia/i)

    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(screen.getByText(/Mi guardia confirmada/i)).toBeDefined()
    })

    const desmarcarBtn = await screen.findByText(/Desmarcar guardia/i)
    expect(desmarcarBtn).toBeDefined()

    await act(async () => {
      fireEvent.click(desmarcarBtn)
    })

    await waitFor(() => {
      expect(screen.getByText(/Tengo guardia asignada/i)).toBeDefined()
    })
  })
})
