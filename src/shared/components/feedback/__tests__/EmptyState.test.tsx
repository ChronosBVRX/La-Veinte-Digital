// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { EmptyState } from "../EmptyState"

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No hay resultados" />)
    expect(screen.getByText("No hay resultados")).toBeTruthy()
  })

  it("renders title as h3", () => {
    render(<EmptyState title="Vacío" />)
    const heading = screen.getByText("Vacío")
    expect(heading.tagName).toBe("H3")
  })

  it("renders description", () => {
    render(
      <EmptyState
        title="Sin datos"
        description="Aún no tienes registros cargados."
      />,
    )
    expect(screen.getByText("Aún no tienes registros cargados.")).toBeTruthy()
  })

  it("does not render description when not provided", () => {
    render(<EmptyState title="Solo título" />)
    const heading = screen.getByText("Solo título")
    expect(heading.tagName).toBe("H3")
  })

  it("renders action element", () => {
    render(
      <EmptyState
        title="Vacío"
        action={<button data-testid="action-btn">Agregar</button>}
      />,
    )
    expect(screen.getByTestId("action-btn")).toBeTruthy()
  })

  it("renders secondaryAction element", () => {
    render(
      <EmptyState
        title="Vacío"
        secondaryAction={<a href="/help" data-testid="secondary-link">Ayuda</a>}
      />,
    )
    expect(screen.getByTestId("secondary-link")).toBeTruthy()
  })

  it("shows icon when provided", () => {
    render(
      <EmptyState
        title="Vacío"
        icon={<span data-testid="empty-icon">📭</span>}
      />,
    )
    expect(screen.getByTestId("empty-icon")).toBeTruthy()
  })

  it("does not render icon wrapper when not provided", () => {
    const { container } = render(<EmptyState title="Sin icono" />)
    expect(container.querySelector("h3")?.previousElementSibling).toBeNull()
  })
})
