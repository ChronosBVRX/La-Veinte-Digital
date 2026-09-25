// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ResponsiveDialog } from "../ResponsiveDialog"
import { useState } from "react"

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function ResponsiveDialogWrapper({
  mobile = false,
  openInitial = true,
  size = "md",
}: {
  mobile?: boolean
  openInitial?: boolean
  size?: "sm" | "md" | "lg"
}) {
  mockMatchMedia(mobile)
  const [open, setOpen] = useState(openInitial)

  return (
    <div data-testid="parent-container" style={{ transform: "scale(1)" }}>
      <button data-testid="external-trigger">External</button>
      <ResponsiveDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Test Responsive Dialog"
        description="Dialog description test"
        size={size}
        footer={<button data-testid="footer-btn">Aceptar</button>}
      >
        <p>Dialog content</p>
        <button data-testid="dialog-action-btn">Action</button>
      </ResponsiveDialog>
    </div>
  )
}

describe("ResponsiveDialog", () => {
  afterEach(() => {
    document.body.style.overflow = ""
    vi.restoreAllMocks()
  })

  it("does not render when closed", () => {
    mockMatchMedia(false)
    render(<ResponsiveDialog open={false} onClose={() => {}} title="Closed"><p>Hidden</p></ResponsiveDialog>)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("renders as Desktop Modal when viewport > 768px", () => {
    render(<ResponsiveDialogWrapper mobile={false} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeDefined()
    expect(screen.getByText("Test Responsive Dialog")).toBeDefined()
    expect(screen.getByText("Dialog description test")).toBeDefined()
    expect(screen.getByText("Dialog content")).toBeDefined()
    expect(screen.getByTestId("footer-btn")).toBeDefined()

    // Portal check: the dialog's top overlay container must be a direct child of document.body
    const overlay = dialog.parentElement!
    expect(overlay.parentElement).toBe(document.body)
    // It must NOT be inside the transformed parent-container
    const parentContainer = screen.getByTestId("parent-container")
    expect(parentContainer.contains(dialog)).toBe(false)
  })

  it("renders as Mobile BottomSheet when viewport <= 768px", () => {
    render(<ResponsiveDialogWrapper mobile={true} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeDefined()
    expect(screen.getByText("Test Responsive Dialog")).toBeDefined()
    expect(screen.getByText("Dialog description test")).toBeDefined()
    expect(screen.getByText("Dialog content")).toBeDefined()
    expect(screen.getByTestId("footer-btn")).toBeDefined()

    // BottomSheet includes a drag handle
    const handle = dialog.querySelector("[aria-hidden='true']")
    expect(handle).toBeDefined()

    // Portal check: overlay is a direct child of document.body
    const overlay = dialog.parentElement!
    expect(overlay.parentElement).toBe(document.body)
    const parentContainer = screen.getByTestId("parent-container")
    expect(parentContainer.contains(dialog)).toBe(false)
  })

  it("closes with Escape key on desktop", () => {
    render(<ResponsiveDialogWrapper mobile={false} />)
    expect(screen.getByRole("dialog")).toBeDefined()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes with Escape key on mobile", () => {
    render(<ResponsiveDialogWrapper mobile={true} />)
    expect(screen.getByRole("dialog")).toBeDefined()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes when overlay is clicked on desktop", () => {
    render(<ResponsiveDialogWrapper mobile={false} />)
    const overlay = screen.getByRole("dialog").parentElement!
    fireEvent.click(overlay)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes when overlay is clicked on mobile", () => {
    render(<ResponsiveDialogWrapper mobile={true} />)
    const overlay = screen.getByRole("dialog").parentElement!
    fireEvent.click(overlay)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("locks body scroll while open on desktop", () => {
    render(<ResponsiveDialogWrapper mobile={false} />)
    expect(document.body.style.overflow).toBe("hidden")
  })

  it("locks body scroll while open on mobile", () => {
    render(<ResponsiveDialogWrapper mobile={true} />)
    expect(document.body.style.overflow).toBe("hidden")
  })
})
