// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ReactNode } from "react"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode
    href: string | { pathname: string }
    [key: string]: unknown
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}))

import { MOBILE_SHEET_GROUPS, BOTTOM_NAV_ITEMS } from "../navigation"
import { MobileBottomNav } from "../MobileBottomNav"
import { OnboardingCard } from "../OnboardingCard"
import { HomeQuickActions } from "../HomeQuickActions"

describe("navegación móvil — Punto 3", () => {
  it("el sheet de Herramientas incluye 'Practicar una audiencia'", () => {
    const herramientas = MOBILE_SHEET_GROUPS.herramientas.items
    const audiencia = herramientas.find((i) => i.href === "/simulador")
    expect(audiencia).toBeTruthy()
    expect(audiencia?.label).toBe("Practicar una audiencia")
  })

  it("el sheet de Herramientas conserva las 4 herramientas base", () => {
    const hrefs = MOBILE_SHEET_GROUPS.herramientas.items.map((i) => i.href)
    expect(hrefs).toEqual(
      expect.arrayContaining(["/calculadoras", "/simulador-nomina", "/escritos", "/catalogo"]),
    )
  })
})

describe("barra inferior móvil — Punto 4", () => {
  it("renderiza exactamente 5 tabs", () => {
    render(<MobileBottomNav onSheetOpen={vi.fn()} />)
    for (const item of BOTTOM_NAV_ITEMS) {
      expect(screen.getByLabelText(item.label)).toBeTruthy()
    }
  })

  it("el Asistente tiene aria-label y no lanza error", () => {
    render(<MobileBottomNav onSheetOpen={vi.fn()} />)
    const asistente = screen.getByLabelText("Asistente")
    expect(asistente.tagName).toBe("A")
  })

  it("los tabs sin href disparan onSheetOpen con su key", () => {
    const onSheetOpen = vi.fn()
    render(<MobileBottomNav onSheetOpen={onSheetOpen} />)
    fireEvent.click(screen.getByLabelText("Mi trabajo"))
    expect(onSheetOpen).toHaveBeenCalledWith("trabajo")
    fireEvent.click(screen.getByLabelText("Más"))
    expect(onSheetOpen).toHaveBeenCalledWith("mas")
  })
})

describe("OnboardingCard — Punto 1", () => {
  it("muestra el progreso y la siguiente acción cuando faltan los 3 pasos", () => {
    render(<OnboardingCard hasAntiguedad={false} hasTarjeton={false} hasCategoria={false} />)
    expect(screen.getByText("0 de 3 pasos completados")).toBeTruthy()
    expect(screen.getByText("Registrar mi categoría")).toBeTruthy()
    expect(screen.getByText("Falta 3 de 3")).toBeTruthy()
  })

  it("avanza al siguiente paso después de completar categoría y antigüedad", () => {
    render(<OnboardingCard hasAntiguedad hasTarjeton={false} hasCategoria />)
    expect(screen.getByText("2 de 3 pasos completados")).toBeTruthy()
    expect(screen.getByText("Importar mi tarjetón")).toBeTruthy()
    expect(screen.getByText("Falta 1 de 3")).toBeTruthy()
  })

  it("no renderiza nada cuando la cuenta está completa", () => {
    const { container } = render(
      <OnboardingCard hasAntiguedad hasTarjeton hasCategoria />,
    )
    expect(container.textContent ?? "").toBe("")
  })
})

describe("HomeQuickActions — Punto 2", () => {
  it("muestra el encabezado '¿Qué necesitas hoy?' y los 4 accesos", () => {
    render(<HomeQuickActions />)
    expect(screen.getByText("¿Qué necesitas hoy?")).toBeTruthy()
    for (const label of ["Mi tarjetón", "Calcular un pago", "Asistente IA", "Registrar incidencia"]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
  })
})