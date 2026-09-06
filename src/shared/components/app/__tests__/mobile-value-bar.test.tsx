// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ReactNode } from "react"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
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

import { MobileValueBar } from "../MobileValueBar"
import {
  MOBILE_VALUE_ITEMS,
  pickMobileValueItem,
  selectMobileValueItems,
  trackMobileValueEvent,
  type MobileValueItem,
} from "../mobileValueItems"

const VIEWPORTS = [320, 360, 393, 412]

describe("MobileValueBar", () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renderiza mensaje con CTA correcto", () => {
    render(<MobileValueBar />)
    const bar = screen.getByLabelText("Consejo de La Veinte Digital")
    expect(bar).toBeDefined()
    const cta = bar.querySelector("a[href]")
    expect(cta).toBeTruthy()
    expect(["/calculadoras", "/escritos", "/vacaciones", "/asistente"].some((r) => cta?.getAttribute("href") === r)).toBe(true)
  })

  it("no muestra sponsors aunque estén habilitados (sin activación editorial)", () => {
    const items: MobileValueItem[] = [
      {
        id: "s1",
        type: "sponsor",
        text: "Compra ya",
        href: "/",
        ctaLabel: "Ver",
        enabled: true,
        sponsorName: "Demo",
      },
    ]
    const { container } = render(<MobileValueBar items={items} />)
    expect(container.textContent ?? "").toBe("")
    expect(screen.queryByLabelText("Contenido patrocinado")).toBeNull()
  })

  it("respeta enabled=false", () => {
    const items: MobileValueItem[] = [
      { id: "off", type: "tip", text: "Oculto", enabled: false },
    ]
    const { container } = render(<MobileValueBar items={items} />)
    expect(container.textContent ?? "").toBe("")
  })

  it("permite cerrar y sessionStorage conserva el dismiss durante la sesión", () => {
    const { unmount } = render(<MobileValueBar />)
    expect(screen.getByLabelText("Consejo de La Veinte Digital")).toBeDefined()
    fireEvent.click(screen.getByLabelText("Cerrar consejo"))
    expect(screen.queryByLabelText("Consejo de La Veinte Digital")).toBeNull()
    expect(window.sessionStorage.getItem("mobile_value_bar_dismissed")).toBe("1")

    // Re-montar en la misma sesión: sigue oculta.
    unmount()
    const rerender = render(<MobileValueBar />)
    expect(rerender.queryByLabelText("Consejo de La Veinte Digital")).toBeNull()
  })

  it("trackMobileValueEvent es no-op y no lanza", () => {
    expect(() => {
      trackMobileValueEvent("mobile_value_impression", "x")
      trackMobileValueEvent("mobile_value_click", "x")
      trackMobileValueEvent("mobile_value_dismiss", "x")
    }).not.toThrow()
  })

  it("el catálogo inicial trae 8 items habilitados sin sponsors ni datos dudosos", () => {
    expect(MOBILE_VALUE_ITEMS).toHaveLength(8)
    for (const item of MOBILE_VALUE_ITEMS) {
      expect(item.enabled).toBe(true)
      expect(item.type).not.toBe("sponsor")
      expect(item.text.length).toBeGreaterThan(0)
    }
  })

  it("los CTA apuntan a rutas reales del router", () => {
    const routes = ["/", "/calculadoras", "/escritos", "/vacaciones", "/guia", "/asistente", "/documentos-personales", "/bitacora", "/calendario"]
    for (const item of MOBILE_VALUE_ITEMS) {
      if (item.href) expect(routes).toContain(item.href)
    }
  })

  it("selección contextual: en /guia no autopromociona /guia", () => {
    const picked = pickMobileValueItem("/guia", { seed: 7 })
    expect(picked).toBeTruthy()
    expect(picked?.href).not.toBe("/guia")
  })

  it("selectMobileValueItems es determinista por semilla", () => {
    const a = pickMobileValueItem("/calculadoras", { seed: 42 })
    const b = pickMobileValueItem("/calculadoras", { seed: 42 })
    expect(a?.id).toBe(b?.id)
  })

  it("respeta ventanas startsAt/endsAt", () => {
    const items: MobileValueItem[] = [
      { id: "futuro", type: "tip", text: "Futuro", enabled: true, startsAt: "2999-01-01T00:00:00Z" },
      { id: "siempre", type: "tip", text: "Siempre", enabled: true },
    ]
    expect(selectMobileValueItems("/", { items }).map((i) => i.id)).toEqual(["siempre"])
  })

  VIEWPORTS.forEach((width) => {
    it(`sin overflow horizontal a ${width}px`, () => {
      const { container } = render(
        <div style={{ width: `${width}px`, maxWidth: `${width}px`, overflowX: "hidden", boxSizing: "border-box" }}>
          <MobileValueBar />
        </div>
      )
      const bar = container.querySelector("aside")
      expect(bar).toBeTruthy()
      // El texto debe permitir wrapping para no empujar horizontalmente.
      const text = container.querySelector("p")
      expect(text).toBeTruthy()
      expect((text as HTMLElement).style.overflowWrap).toBe("anywhere")
    })
  })
})
