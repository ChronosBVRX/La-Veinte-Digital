// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { Modal } from "../Modal"
import { useState } from "react"

function ModalWrapper({ closeOnOverlay = true }: { closeOnOverlay?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button data-testid="external-trigger">External</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Test Modal"
        description="Modal description"
        closeOnOverlay={closeOnOverlay}
      >
        <p>Modal content</p>
        <button data-testid="modal-button">Action</button>
      </Modal>
    </div>
  )
}

function ClosedModalWrapper() {
  return (
    <Modal open={false} onClose={() => {}} title="Closed">
      <p>Should not render</p>
    </Modal>
  )
}

function pressEscape() {
  fireEvent.keyDown(document, { key: "Escape" })
}

describe("Modal", () => {
  afterEach(() => {
    document.body.style.overflow = ""
  })

  it("has role dialog", () => {
    render(<ModalWrapper />)
    expect(screen.getByRole("dialog")).toBeDefined()
  })

  it("has aria-modal true", () => {
    render(<ModalWrapper />)
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
  })

  it("has aria-labelledby pointing to title", () => {
    render(<ModalWrapper />)
    const dialog = screen.getByRole("dialog")
    const titleId = dialog.getAttribute("aria-labelledby")
    expect(titleId).toBeTruthy()
    const title = document.getElementById(titleId!)
    expect(title?.textContent).toBe("Test Modal")
  })

  it("has aria-describedby for description", () => {
    render(<ModalWrapper />)
    const dialog = screen.getByRole("dialog")
    const descId = dialog.getAttribute("aria-describedby")
    expect(descId).toBeTruthy()
    const desc = document.getElementById(descId!)
    expect(desc?.textContent).toBe("Modal description")
  })

  it("renders title and children", () => {
    render(<ModalWrapper />)
    expect(screen.getByText("Test Modal")).toBeDefined()
    expect(screen.getByText("Modal content")).toBeDefined()
  })

  it("does not render when closed", () => {
    render(<ClosedModalWrapper />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes with Escape key", () => {
    render(<ModalWrapper />)
    expect(screen.getByRole("dialog")).toBeDefined()
    pressEscape()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("closes with Escape even when closeOnOverlay is false", () => {
    render(<ModalWrapper closeOnOverlay={false} />)
    expect(screen.getByRole("dialog")).toBeDefined()
    pressEscape()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("calls onClose when overlay is clicked", () => {
    render(<ModalWrapper />)
    const overlay = screen.getByRole("dialog").parentElement!
    fireEvent.click(overlay)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("does not close from overlay when closeOnOverlay is false", () => {
    render(<ModalWrapper closeOnOverlay={false} />)
    const overlay = screen.getByRole("dialog").parentElement!
    fireEvent.click(overlay)
    expect(screen.getByRole("dialog")).toBeDefined()
  })

  it("locks body scroll while open", () => {
    render(<ModalWrapper />)
    expect(document.body.style.overflow).toBe("hidden")
  })

  it("restores body scroll on close", () => {
    render(<ModalWrapper />)
    pressEscape()
    expect(document.body.style.overflow).not.toBe("hidden")
  })

  it("restores the previous focused element", () => {
    render(<ModalWrapper />)
    const externalTrigger = screen.getByTestId("external-trigger")
    externalTrigger.focus()
    expect(document.activeElement).toBe(externalTrigger)
    pressEscape()
    expect(document.activeElement).toBe(externalTrigger)
  })

  it("contains focusable elements inside the dialog", () => {
    render(<ModalWrapper />)
    const dialog = screen.getByRole("dialog")
    const focusable = dialog.querySelectorAll("button, [tabindex], input, select, textarea, a[href]")
    expect(focusable.length).toBeGreaterThan(0)
  })

  it("renders footer when provided", () => {
    render(
      <Modal open={true} onClose={() => {}} title="With Footer" footer={<button data-testid="footer-btn">Save</button>}>
        Content
      </Modal>
    )
    expect(screen.getByTestId("footer-btn")).toBeDefined()
  })

  it("keeps focus in content input when onClose identity changes while open", async () => {
    // Regresión: escribir en un formulario re-renderiza al padre y crea una
    // nueva identidad de onClose. Eso NUNCA debe reinicializar el autofocus
    // del modal ni robar el foco (en móvil cierra el teclado virtual).
    const { rerender } = render(
      <Modal open={true} onClose={() => {}} title="Focus test">
        <input data-testid="name-input" />
      </Modal>
    )
    // Canario: el autofocus inicial sí debe funcionar en este entorno.
    await waitFor(() => expect(document.activeElement?.tagName).toBe("BUTTON"), { timeout: 1000 })
    const input = screen.getByTestId("name-input") as HTMLInputElement
    input.focus()
    expect(document.activeElement).toBe(input)
    // Simula el re-render del padre al escribir (nueva identidad de onClose).
    rerender(
      <Modal open={true} onClose={() => {}} title="Focus test">
        <input data-testid="name-input" />
      </Modal>
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
    // Sin remount del input…
    expect(screen.getByTestId("name-input")).toBe(input)
    // …y sin robo de foco.
    expect(document.activeElement).toBe(input)
  })

  it("Escape calls the latest onClose after parent rerenders", () => {
    // Protección contra closures obsoletas al desacoplar onClose del efecto.
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(
      <Modal open={true} onClose={first} title="Escape test">
        <p>Content</p>
      </Modal>
    )
    rerender(
      <Modal open={true} onClose={second} title="Escape test">
        <p>Content</p>
      </Modal>
    )
    pressEscape()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })
})
