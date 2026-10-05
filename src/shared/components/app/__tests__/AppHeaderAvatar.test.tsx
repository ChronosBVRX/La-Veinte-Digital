// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AppHeader } from "../AppHeader"

describe("AppHeader - Avatar Thumbnail", () => {
  it("muestra el ícono de respaldo cuando no hay avatarUrl", () => {
    render(<AppHeader fullName="Juan Pérez" onMenuToggle={vi.fn()} />)
    const trigger = screen.getByRole("button", { name: "Menú de perfil" })
    expect(trigger).toBeDefined()
    expect(trigger.querySelector("img")).toBeNull()
  })

  it("renderiza la imagen de avatar cuando se proporciona avatarUrl", () => {
    render(
      <AppHeader
        fullName="Juan Pérez"
        avatarUrl="https://example.com/storage/avatars/user123/avatar.webp"
        onMenuToggle={vi.fn()}
      />
    )
    const trigger = screen.getByRole("button", { name: "Menú de perfil" })
    const img = trigger.querySelector("img")
    expect(img).not.toBeNull()
    expect(img?.getAttribute("src")).toBe("https://example.com/storage/avatars/user123/avatar.webp")
  })

  it("regresa al ícono si la imagen de avatar falla al cargar", () => {
    render(
      <AppHeader
        fullName="Juan Pérez"
        avatarUrl="https://example.com/storage/avatars/user123/broken.webp"
        onMenuToggle={vi.fn()}
      />
    )
    const trigger = screen.getByRole("button", { name: "Menú de perfil" })
    const img = trigger.querySelector("img")
    expect(img).not.toBeNull()

    fireEvent.error(img!)
    // Tras el error, la etiqueta img debe desaparecer y mostrar el fallback
    expect(trigger.querySelector("img")).toBeNull()
  })
})
