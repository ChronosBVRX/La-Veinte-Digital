// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Vacation2027AnnouncementCard } from "../components/Vacation2027AnnouncementCard"

describe("Vacation2027AnnouncementCard", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renderiza el título 'Ya están disponibles los roles vacacionales 2027'", () => {
    render(<Vacation2027AnnouncementCard />)
    const title = screen.getByText("Ya están disponibles los roles vacacionales 2027")
    expect(title).toBeDefined()
    expect(title.tagName.toLowerCase()).toBe("h2")
  })

  it("renderiza la etiqueta de novedad 'NUEVO · 2027'", () => {
    render(<Vacation2027AnnouncementCard />)
    const badge = screen.getByText("NUEVO · 2027")
    expect(badge).toBeDefined()
  })

  it("renderiza el CTA 'Ver roles 2027'", () => {
    render(<Vacation2027AnnouncementCard />)
    const cta = screen.getByText("Ver roles 2027")
    expect(cta).toBeDefined()
  })

  it("existe un enlace cuyo destino sea '/vacaciones'", () => {
    render(<Vacation2027AnnouncementCard />)
    const link = screen.getByRole("link", {
      name: /ya están disponibles los roles vacacionales 2027/i,
    })
    expect(link).toBeDefined()
    expect(link.getAttribute("href")).toBe("/vacaciones")
  })

  it("el componente no contiene la palabra 'preliminar'", () => {
    const { container } = render(<Vacation2027AnnouncementCard />)
    expect(container.textContent?.toLowerCase()).not.toContain("preliminar")
  })

  it("el componente no contiene la palabra 'provisional'", () => {
    const { container } = render(<Vacation2027AnnouncementCard />)
    expect(container.textContent?.toLowerCase()).not.toContain("provisional")
    expect(container.textContent?.toLowerCase()).not.toContain("próximamente")
    expect(container.textContent?.toLowerCase()).not.toContain("pendiente de publicación")
  })

  it("no depende de fetch ni de Supabase (componente ligero estático)", () => {
    render(<Vacation2027AnnouncementCard />)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("no genera overflow evidente en viewport móvil: contenedor y link usan reglas defensivas", () => {
    render(<Vacation2027AnnouncementCard />)
    const cardSection = screen.getByTestId("vacation-2027-announcement-card")
    const cardLink = screen.getByTestId("vacation-2027-announcement-link")

    expect(cardSection.style.minWidth).toBe("0px")
    expect(cardSection.style.maxWidth).toBe("100%")
    expect(cardSection.style.boxSizing).toBe("border-box")

    expect(cardLink.style.minWidth).toBe("0px")
    expect(cardLink.style.maxWidth).toBe("100%")
    expect(cardLink.style.boxSizing).toBe("border-box")
    expect(cardLink.style.overflowWrap).toBe("break-word")
  })
})
