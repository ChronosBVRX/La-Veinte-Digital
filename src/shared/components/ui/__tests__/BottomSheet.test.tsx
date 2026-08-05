// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BottomSheet } from "../BottomSheet"
import { useState } from "react"

function SheetWrapper() {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button data-testid="external-trigger">External</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Sheet Title">
        <p>Sheet content</p>
        <button data-testid="sheet-button">Action</button>
      </BottomSheet>
    </div>
  )
}

function pressEscape() {
  fireEvent.keyDown(document, { key: "Escape" })
}

describe("BottomSheet", () => {
  afterEach(() => {
    document.body.style.overflow = ""
  })

  it("has role dialog", () => {
    render(<SheetWrapper />)
    expect(screen.getByRole("dialog")).toBeDefined()
  })

  it("has aria-modal true", () => {
    render(<SheetWrapper />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
  })

  it("does not render when closed", () => {
    render(<BottomSheet open={false} onClose={() => {}} title="Closed"><p>No</p></BottomSheet>)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes with Escape key", () => {
    render(<SheetWrapper />)
    expect(screen.getByRole("dialog")).toBeDefined()
    pressEscape()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("calls onClose when overlay is clicked", () => {
    render(<SheetWrapper />)
    const overlay = screen.getByRole("dialog").parentElement!
    fireEvent.click(overlay)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("locks body scroll while open", () => {
    render(<SheetWrapper />)
    expect(document.body.style.overflow).toBe("hidden")
  })

  it("restores the previous focused element", () => {
    render(<SheetWrapper />)
    const externalTrigger = screen.getByTestId("external-trigger")
    externalTrigger.focus()
    expect(document.activeElement).toBe(externalTrigger)
    pressEscape()
    expect(document.activeElement).toBe(externalTrigger)
  })
})
