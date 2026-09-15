// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"

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

import { OnboardingCard } from "../OnboardingCard"

describe("OnboardingCard — ausencia confirmada vs dato desconocido", () => {
  it("tarjetón desconocido no invita a importar cuando el resto está completo", () => {
    const { container } = render(
      <OnboardingCard hasAntiguedad hasTarjeton={null} hasCategoria />,
    )

    expect(container.textContent ?? "").toBe("")
    expect(screen.queryByText("Importar mi tarjetón")).toBeNull()
  })

  it("todos desconocidos no renderiza nada", () => {
    const { container } = render(
      <OnboardingCard hasAntiguedad={null} hasTarjeton={null} hasCategoria={null} />,
    )

    expect(container.textContent ?? "").toBe("")
  })

  it("ausencia confirmada de tarjetón sí muestra el CTA de importar", () => {
    render(<OnboardingCard hasAntiguedad hasTarjeton={false} hasCategoria />)

    expect(screen.getByText("Importar mi tarjetón")).toBeTruthy()
    const cta = screen.getByText("Importar mi tarjetón").closest("a")
    expect(cta?.getAttribute("href")).toBe("/profile/mi-informacion-laboral")
    expect(screen.getByText("2 de 3 pasos completados")).toBeTruthy()
  })

  it("categoría y antigüedad desconocidas no se presentan como pendientes", () => {
    render(<OnboardingCard hasAntiguedad={null} hasTarjeton={false} hasCategoria={null} />)

    expect(screen.queryByText("Registrar mi categoría")).toBeNull()
    expect(screen.queryByText("Registrar mi antigüedad")).toBeNull()
    expect(screen.getByText("Importar mi tarjetón")).toBeTruthy()
    expect(screen.getAllByText("Por confirmar")).toHaveLength(2)
    expect(screen.getByText("0 de 1 pasos completados · 2 por confirmar")).toBeTruthy()
  })

  it("tarjetón desconocido no genera CTA de importar aunque falten otros pasos", () => {
    render(<OnboardingCard hasAntiguedad={false} hasTarjeton={null} hasCategoria={false} />)

    const cta = screen.getByText("Registrar mi categoría").closest("a")
    expect(cta?.getAttribute("href")).toBe("/profile")
    expect(screen.queryByText("Importar mi tarjetón")).toBeNull()
    expect(screen.getAllByText("Por confirmar")).toHaveLength(1)
  })
})
