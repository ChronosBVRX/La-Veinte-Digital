// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { WelcomeCard } from "@/shared/components/app/WelcomeCard"

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  }),
}))

vi.mock("@/features/agenda-laboral/lib/agenda-bus", () => ({
  useCommitmentsListener: vi.fn(),
}))

describe("WelcomeCard - Bloque de Próximo Pago", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("el 27 de septiembre de 2026: BBVA/otros apunta al 13 de octubre y Cheque al 29 de septiembre de forma separada", async () => {
    // 27 de septiembre 2026 a las 12:00
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 27, 12, 0, 0))

    await act(async () => {
      render(
        <WelcomeCard
          fullName="Axel Rosete"
          greeting="Buenas tardes"
          dateLabel="Domingo, 27 de septiembre"
          userId="user-test"
        />
      )
    })

    // Santander debe apuntar a octubre (12 de octubre, faltan 15 días)
    expect(screen.getByText(/Santander o Scotiabank/)).toBeDefined()
    expect(screen.getByText(/12 de octubre/)).toBeDefined()
    expect(screen.getByText(/15 días/)).toBeDefined()

    // BBVA, Banamex, Banorte debe apuntar al 13 de octubre (faltan 16 días)
    expect(screen.getByText(/BBVA, Banamex, Banorte y demás bancos/)).toBeDefined()
    expect(screen.getByText(/13 de octubre/)).toBeDefined()
    expect(screen.getByText(/16 días/)).toBeDefined()

    // Cheque debe apuntar al 29 de septiembre (faltan 2 días)
    expect(screen.getByText(/pago con cheque/i)).toBeDefined()
    expect(screen.getByText(/29 de septiembre/)).toBeDefined()
    expect(screen.getByText(/2 días/)).toBeDefined()

    // BBVA/Banamex NO debe estar agrupado con cheque ni decir que cae el 29
    const lines = screen.getAllByRole("paragraph")
    const bbvaLine = lines.find((p) => p.textContent?.includes("BBVA, Banamex, Banorte"))
    expect(bbvaLine?.textContent).toContain("13 de octubre")
    expect(bbvaLine?.textContent).not.toContain("29 de septiembre")
    expect(bbvaLine?.textContent).not.toContain("cheque")
  })

  it("el 26 de septiembre de 2026: BBVA/otros muestra 'Hoy pagan'", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 26, 10, 0, 0))

    await act(async () => {
      render(
        <WelcomeCard
          fullName="Axel Rosete"
          greeting="Buenos días"
          dateLabel="Sábado, 26 de septiembre"
          userId="user-test"
        />
      )
    })

    expect(screen.getByText(/Hoy pagan BBVA, Banamex, Banorte y demás bancos/)).toBeDefined()
    expect(screen.getByText(/cae el 26 de septiembre/)).toBeDefined()
  })

  it("el 25 de septiembre de 2026: Santander muestra 'Hoy paga' y BBVA muestra 'Mañana pagan'", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 25, 9, 0, 0))

    await act(async () => {
      render(
        <WelcomeCard
          fullName="Axel Rosete"
          greeting="Buenos días"
          dateLabel="Viernes, 25 de septiembre"
          userId="user-test"
        />
      )
    })

    expect(screen.getByText(/Hoy paga Santander o Scotiabank/)).toBeDefined()
    expect(screen.getByText(/cae el 25 de septiembre/)).toBeDefined()

    expect(screen.getByText(/Mañana pagan BBVA, Banamex, Banorte y demás bancos/)).toBeDefined()
    expect(screen.getByText(/cae el 26 de septiembre/)).toBeDefined()
  })

  it("el 28 y 29 de septiembre: Cheque muestra 'Mañana se paga' y 'Hoy se paga'", async () => {
    // 28 de septiembre -> Mañana se paga con cheque
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date(2026, 8, 28, 14, 0, 0))

    let rerenderFn: ((ui: React.ReactNode) => void) | undefined
    await act(async () => {
      const res = render(
        <WelcomeCard
          fullName="Axel Rosete"
          greeting="Buenas tardes"
          dateLabel="Lunes, 28 de septiembre"
          userId="user-test"
        />
      )
      rerenderFn = res.rerender
    })

    expect(screen.getByText(/Mañana se paga con cheque/)).toBeDefined()

    // 29 de septiembre -> Hoy se paga con cheque
    vi.setSystemTime(new Date(2026, 8, 29, 8, 0, 0))
    await act(async () => {
      rerenderFn!(
        <WelcomeCard
          fullName="Axel Rosete"
          greeting="Buenos días"
          dateLabel="Martes, 29 de septiembre"
          userId="user-test"
        />
      )
    })

    expect(screen.getByText(/Hoy se paga con cheque/)).toBeDefined()
  })
})
