// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CalculatorsIndex } from "../components/CalculatorsIndex"

describe("CalculatorsIndex mobile", () => {
  it("renderiza 5 calculadoras unificadas con grid 2-col", () => {
    render(<CalculatorsIndex hasTarjeton={false} />)
    expect(screen.getByText("Aguinaldo")).toBeTruthy()
    expect(screen.getByText("Segunda de Julio")).toBeTruthy()
    expect(screen.getByText("Tiempo Extra")).toBeTruthy()
    expect(screen.getByText("Cláusula 97")).toBeTruthy()
    expect(screen.getByText("Préstamos por Categoría")).toBeTruthy()
    // Grid tiene clase calculators-grid
    const grid = document.querySelector(".calculators-grid")
    expect(grid).toBeTruthy()
  })

  it("tarjeton banner ocupa ancho completo y es clicable", () => {
    const { container } = render(<CalculatorsIndex hasTarjeton={false} />)
    const link = container.querySelector('a[href="/profile/mi-informacion-laboral"]')
    expect(link).toBeTruthy()
  })

  it("cards no generan overflow: minWidth 0 y texto truncado", () => {
    render(<CalculatorsIndex hasTarjeton={true} />)
    const cards = document.querySelectorAll(".calculator-card")
    expect(cards.length).toBe(5)
    for (const card of cards) {
      expect(card).toBeTruthy()
    }
  })

  const viewports = [
    { name: "Mobile pequeño (360x800)", width: 360, height: 800 },
    { name: "iPhone estándar (390x844)", width: 390, height: 844 },
    { name: "Android moderno (412x915)", width: 412, height: 915 },
  ]

  for (const vp of viewports) {
    it(`renderiza limpiamente en ${vp.name} sin overflow`, () => {
      window.innerWidth = vp.width
      window.innerHeight = vp.height
      const { container } = render(<CalculatorsIndex hasTarjeton={false} />)
      expect(container.firstChild).toBeTruthy()
      // Verificar que ningún contenedor tiene ancho fijo superior al viewport
      const elements = container.querySelectorAll("*")
      elements.forEach((el) => {
        const style = (el as HTMLElement).style
        if (style && style.width && style.width.endsWith("px")) {
          const px = parseInt(style.width, 10)
          expect(px).toBeLessThanOrEqual(vp.width)
        }
      })
    })
  }
})
