// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Input } from "../Input"

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input />)
    expect(screen.getByRole("textbox")).toBeTruthy()
  })

  it("passes through placeholder", () => {
    render(<Input placeholder="Buscar..." />)
    const input = screen.getByPlaceholderText("Buscar...")
    expect(input).toBeTruthy()
  })

  it("passes through value", () => {
    render(<Input value="hola" readOnly />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.value).toBe("hola")
  })

  it("passes through type", () => {
    render(<Input type="email" />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.type).toBe("email")
  })

  it("shows invalid styling with invalid prop", () => {
    render(<Input invalid />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(input.style.border).toContain("var(--error)")
  })

  it("does not show invalid styling by default", () => {
    render(<Input />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.getAttribute("aria-invalid")).not.toBe("true")
  })

  it("renders leadingIcon", () => {
    render(
      <Input leadingIcon={<span data-testid="icon">🔍</span>} />,
    )
    expect(screen.getByTestId("icon")).toBeTruthy()
  })

  it("renders label text", () => {
    render(<Input label="Nombre completo" />)
    expect(screen.getByText("Nombre completo")).toBeTruthy()
  })

  it("associates label with input via htmlFor", () => {
    render(<Input label="Email" />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    const id = input.id
    expect(id).toBeTruthy()
    const label = screen.getByText("Email")
    expect(label.getAttribute("for")).toBe(id)
  })
})
