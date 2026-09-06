// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
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

import { DashboardShell } from "../../layout/DashboardShell"

describe("DashboardShell con MobileValueBar", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it("presenta MobileValueBar", async () => {
    render(
      <DashboardShell fullName="Test User">
        <p>contenido</p>
      </DashboardShell>
    )
    // MobileValueBar se monta solo-cliente (next/dynamic ssr:false).
    expect(await screen.findByLabelText("Consejo de La Veinte Digital")).toBeDefined()
  })

  it("no monta la navegación inferior antigua ni su sheet", () => {
    render(
      <DashboardShell fullName="Test User">
        <p>contenido</p>
      </DashboardShell>
    )
    expect(document.querySelector(".mobile-bottom-nav")).toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByLabelText("Mi trabajo")).toBeNull()
    expect(screen.queryByLabelText("Herramientas")).toBeNull()
    expect(screen.queryByLabelText("Más")).toBeNull()
  })

  it("mantiene AppHeader y drawer lateral", () => {
    render(
      <DashboardShell fullName="Test User">
        <p>contenido</p>
      </DashboardShell>
    )
    expect(screen.getByLabelText("Abrir menú")).toBeDefined()
    expect(screen.getByLabelText("Cerrar menú")).toBeDefined()
  })

  it("el drawer abre y su contenido de navegación sigue presente", () => {
    render(
      <DashboardShell fullName="Test User">
        <p>contenido</p>
      </DashboardShell>
    )
    fireEvent.click(screen.getByLabelText("Abrir menú"))
    expect(screen.getByRole("link", { name: "La Veinte Digital" })).toBeDefined()
    // Sidebar desktop + drawer móvil renderizan el mismo contenido navegable.
    expect(screen.getAllByText("Inicio").length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText("Calculadoras").length).toBeGreaterThanOrEqual(1)
  })

  it("el CTA del banner navega a rutas reales", async () => {
    render(
      <DashboardShell fullName="Test User">
        <p>contenido</p>
      </DashboardShell>
    )
    const bar = await screen.findByLabelText("Consejo de La Veinte Digital")
    const cta = bar.querySelector("a[href]") as HTMLAnchorElement | null
    expect(cta).toBeTruthy()
    expect(["/calculadoras", "/escritos", "/vacaciones", "/asistente"]).toContain(cta?.getAttribute("href"))
  })
})
