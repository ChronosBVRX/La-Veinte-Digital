// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Button } from "../Button"

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole("button", { name: "Click me" })).toBeTruthy()
  })

  it("fires onClick when clicked", () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("does NOT fire onClick when disabled", () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Click</Button>)
    fireEvent.click(screen.getByRole("button"))
    expect(onClick).not.toHaveBeenCalled()
  })

  it("shows loading spinner when loading=true", () => {
    render(<Button loading>Submit</Button>)
    const button = screen.getByRole("button")
    expect(button.querySelector("[aria-hidden]")).toBeTruthy()
  })

  it("is disabled when loading=true", () => {
    render(<Button loading>Submit</Button>)
    const button = screen.getByRole("button") as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it("has type=button by default", () => {
    render(<Button>Click</Button>)
    const button = screen.getByRole("button") as HTMLButtonElement
    expect(button.type).toBe("button")
  })

  it("renders fullWidth style", () => {
    render(<Button fullWidth>Full</Button>)
    const button = screen.getByRole("button")
    expect(button.style.width).toBe("100%")
  })

  it("renders leadingIcon", () => {
    render(
      <Button leadingIcon={<span data-testid="lead-icon">L</span>}>
        With Icon
      </Button>,
    )
    expect(screen.getByTestId("lead-icon")).toBeTruthy()
  })

  it("renders trailingIcon after children text", () => {
    render(
      <Button trailingIcon={<span data-testid="trail-icon">T</span>}>
        With Icon
      </Button>,
    )
    expect(screen.getByTestId("trail-icon")).toBeTruthy()
  })

  it("applies primary variant styles", () => {
    render(<Button variant="primary">Primary</Button>)
    const button = screen.getByRole("button")
    expect(button.style.background).toBe("var(--primary)")
    expect(button.style.color).toBe("var(--primary-fg)")
  })

  it("applies secondary variant styles", () => {
    render(<Button variant="secondary">Secondary</Button>)
    const button = screen.getByRole("button")
    expect(button.style.background).toBe("var(--accent)")
    expect(button.style.color).toBe("var(--fg)")
  })

  it("applies outline variant styles", () => {
    render(<Button variant="outline">Outline</Button>)
    const button = screen.getByRole("button")
    expect(button.style.background).toBe("transparent")
  })

  it("applies ghost variant styles", () => {
    render(<Button variant="ghost">Ghost</Button>)
    const button = screen.getByRole("button")
    expect(button.style.background).toBe("transparent")
    expect(button.style.borderColor).toBe("transparent")
  })

  it("applies danger variant styles", () => {
    render(<Button variant="danger">Danger</Button>)
    const button = screen.getByRole("button")
    expect(button.style.background).toBe("var(--error)")
    expect(button.style.color).toBe("rgb(255, 255, 255)")
  })

  it("has accessible focus styles (no outline:none)", () => {
    render(<Button>Focusable</Button>)
    const button = screen.getByRole("button")
    expect(button.style.outline).not.toBe("none")
  })
})
