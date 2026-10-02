// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { RoleModeSwitch } from "../RoleModeSwitch"
import type { ReactNode } from "react"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...rest
  }: {
    children: ReactNode
    href: string
    onClick?: () => void
    [key: string]: unknown
  }) => (
    <a
      href={href}
      onClick={() => {
        onClick?.()
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}))

describe("RoleModeSwitch Component", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("renderiza el grupo de navegación con ambos enlaces", () => {
    render(<RoleModeSwitch currentMode="worker" />)

    const group = screen.getByRole("group", { name: /Conmutador de modo de cuenta/i })
    expect(group).toBeDefined()

    const workerLink = screen.getByRole("link", { name: /Cambiar a Modo Usuario/i })
    expect(workerLink.getAttribute("href")).toBe("/")

    const unionLink = screen.getByRole("link", { name: /Cambiar a Modo Representante/i })
    expect(unionLink.getAttribute("href")).toBe("/representacion")
  })

  it("marca aria-current en Modo Usuario cuando currentMode es worker", () => {
    render(<RoleModeSwitch currentMode="worker" />)

    const workerLink = screen.getByRole("link", { name: /Cambiar a Modo Usuario/i })
    expect(workerLink.getAttribute("aria-current")).toBe("page")

    const unionLink = screen.getByRole("link", { name: /Cambiar a Modo Representante/i })
    expect(unionLink.getAttribute("aria-current")).toBeNull()
  })

  it("marca aria-current en Modo Representante cuando currentMode es union", () => {
    render(<RoleModeSwitch currentMode="union" />)

    const unionLink = screen.getByRole("link", { name: /Cambiar a Modo Representante/i })
    expect(unionLink.getAttribute("aria-current")).toBe("page")

    const workerLink = screen.getByRole("link", { name: /Cambiar a Modo Usuario/i })
    expect(workerLink.getAttribute("aria-current")).toBeNull()
  })

  it("persiste la preferencia en localStorage al hacer clic en un modo", () => {
    render(<RoleModeSwitch currentMode="worker" />)

    const unionLink = screen.getByRole("link", { name: /Cambiar a Modo Representante/i })
    fireEvent.click(unionLink)
    expect(localStorage.getItem("lvd_preferred_mode")).toBe("union")

    const workerLink = screen.getByRole("link", { name: /Cambiar a Modo Usuario/i })
    fireEvent.click(workerLink)
    expect(localStorage.getItem("lvd_preferred_mode")).toBe("worker")
  })

  it("soporta variante dark para la cabecera institucional sindical", () => {
    render(<RoleModeSwitch currentMode="union" variant="dark" />)

    const group = screen.getByRole("group", { name: /Conmutador de modo de cuenta/i })
    expect(group.style.background).toContain("rgba(255, 255, 255, 0.12)")
  })

  it("renderiza etiquetas completas y compactas para adaptabilidad móvil", () => {
    const { container } = render(<RoleModeSwitch currentMode="worker" />)

    const longLabels = container.querySelectorAll(".role-mode-switch-long")
    const shortLabels = container.querySelectorAll(".role-mode-switch-short")

    expect(longLabels.length).toBe(2)
    expect(shortLabels.length).toBe(2)
    expect(longLabels[0]?.textContent).toBe("Modo Usuario")
    expect(shortLabels[0]?.textContent).toBe("Usuario")
    expect(longLabels[1]?.textContent).toBe("Modo Representante")
    expect(shortLabels[1]?.textContent).toBe("Representante")
  })
})
