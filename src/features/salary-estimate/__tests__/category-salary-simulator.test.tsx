// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CategorySalarySimulator } from "../components/CategorySalarySimulator"

describe("CategorySalarySimulator", () => {
  it("renderiza el simulador con selector de categorías y estado inicial", () => {
    render(<CategorySalarySimulator theme="dark" />)
    expect(screen.getByTestId("category-salary-simulator")).toBeTruthy()
    expect(screen.getByTestId("category-search-input")).toBeTruthy()
    expect(screen.getByTestId("category-dropdown-select")).toBeTruthy()
    expect(screen.getByTestId("simulation-results")).toBeTruthy()
  })

  it("permite filtrar categorías por texto de búsqueda", () => {
    render(<CategorySalarySimulator theme="dark" />)
    const searchInput = screen.getByTestId("category-search-input")
    fireEvent.change(searchInput, { target: { value: "ENFERMERA GENERAL 80" } })

    const select = screen.getByTestId("category-dropdown-select") as HTMLSelectElement
    expect(select.options.length).toBeGreaterThan(0)
    expect(select.options[0].text).toContain("ENFERMERA GENERAL 80")
  })

  it("calcula correctamente el incremento contractual para la categoría seleccionada", () => {
    render(<CategorySalarySimulator theme="dark" initialCategoryName="ENFERMERA GENERAL 80" />)
    
    // ENFERMERA GENERAL 80 tiene Tabular $3,690.56 y C11 $3,031.79
    // Aumento 4% tabular + 86.15% C11 = $422.43
    // Propuesta anterior = $343.06
    // Ganancia diferencial = $79.37
    expect(document.body.textContent).toContain("$422.43")
    expect(document.body.textContent).toContain("$343.06")
    expect(document.body.textContent).toContain("▲ Ganancia adicional lograda: +$79.37")
    expect(document.body.textContent).toContain("Este aumento es idéntico e independiente de la antigüedad")
  })

  it("permite cambiar de categoría y actualiza los cálculos instantáneamente", () => {
    const onSelect = vi.fn()
    render(<CategorySalarySimulator theme="light" onCategorySelect={onSelect} />)

    const select = screen.getByTestId("category-dropdown-select")
    fireEvent.change(select, { target: { value: "ASISTENTE MEDICA 80" } })

    expect(onSelect).toHaveBeenCalled()
    expect(document.body.textContent).toContain("ASISTENTE MEDICA 80")
    // ASISTENTE MEDICA 80: Tabular $3,054.34, C11 $2,509.14
    // Aumento = $349.60
    expect(document.body.textContent).toContain("$349.60")
  })
})
