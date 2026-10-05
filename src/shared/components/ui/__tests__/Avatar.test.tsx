// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Avatar } from "../Avatar"

describe("Avatar UI Component", () => {
  it("renderiza ícono de respaldo cuando no se pasa src", () => {
    render(<Avatar icon={<span data-testid="fallback-icon">Icon</span>} />)
    expect(screen.getByTestId("fallback-icon")).toBeDefined()
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("renderiza la imagen cuando se proporciona src", () => {
    render(
      <Avatar
        src="https://example.com/avatar.webp"
        alt="Foto de perfil"
        icon={<span data-testid="fallback-icon">Icon</span>}
      />
    )
    const img = screen.getByRole("img")
    expect(img).toBeDefined()
    expect(img.getAttribute("src")).toBe("https://example.com/avatar.webp")
    expect(img.getAttribute("alt")).toBe("Foto de perfil")
    expect(screen.queryByTestId("fallback-icon")).toBeNull()
  })

  it("cambia a ícono de respaldo si la imagen falla al cargar (onError)", () => {
    render(
      <Avatar
        src="https://example.com/broken.webp"
        alt="Foto rota"
        icon={<span data-testid="fallback-icon">Icon</span>}
      />
    )
    const img = screen.getByRole("img")
    fireEvent.error(img)

    expect(screen.getByTestId("fallback-icon")).toBeDefined()
    expect(screen.queryByRole("img")).toBeNull()
  })
})
