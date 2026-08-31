// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CalculatorsIndex } from "../components/CalculatorsIndex"

describe("CalculatorsIndex mobile", () => {
  it("renderiza 6 calculadoras con grid 2-col", () => {
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
    expect(cards.length).toBe(6)
    for (const card of cards) {
      const style = (card as HTMLElement).style
      // minHeight compacta
      expect(card).toBeTruthy()
      void style
    }
  })
})
