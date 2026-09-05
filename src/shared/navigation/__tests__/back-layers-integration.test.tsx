// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useState, type ReactNode } from "react"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode
    href: string | { pathname: string }
    [key: string]: unknown
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}))

import { backNavigationCoordinator } from "../back-navigation-coordinator"
import { useBackLayer } from "../useBackLayer"
import { Modal } from "@/shared/components/ui/Modal"
import { BottomSheet } from "@/shared/components/ui/BottomSheet"
import { FullscreenPortal } from "@/shared/components/ui/FullscreenPortal"
import { MobileNavigationSheet } from "@/shared/components/app/MobileNavigationSheet"
import { SearchableSelect } from "@/shared/components/ui/SearchableSelect"

function pressBack(): boolean {
  expect(typeof window.LaVeinteNavigation?.back).toBe("function")
  return window.LaVeinteNavigation!.back()
}

describe("Back canónico — integración de capas", () => {
  beforeEach(() => {
    backNavigationCoordinator.clear()
  })

  afterEach(() => {
    backNavigationCoordinator.clear()
    document.body.style.overflow = ""
  })

  it("menú abierto (MobileNavigationSheet) → Atrás cierra el menú", () => {
    const onClose = vi.fn()
    function Wrapper() {
      const [key, setKey] = useState<string | null>("herramientas")
      return (
        <MobileNavigationSheet
          openKey={key}
          onClose={() => {
            setKey(null)
            onClose()
          }}
          onNavigate={() => setKey(null)}
        />
      )
    }
    render(<Wrapper />)
    expect(screen.getByRole("dialog")).toBeDefined()

    let consumed = false
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("dialog")).toBeNull()

    // Sin capas: passthrough (el anfitrión retrocede de ruta / pantalla nativa).
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(false)
  })

  it("modal abierto → Atrás cierra el modal", () => {
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="Modal test">
          <p>contenido</p>
        </Modal>
      )
    }
    render(<Wrapper />)
    expect(screen.getByRole("dialog")).toBeDefined()

    let consumed = false
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(true)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("popover dentro de modal → primer Atrás cierra popover, segundo el modal", () => {
    const options = [
      { label: "Base A", value: "a" },
      { label: "Base B", value: "b" },
    ]
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="Modal con selector">
          <SearchableSelect label="Categoría" name="categoria" options={options} />
        </Modal>
      )
    }
    render(<Wrapper />)
    const input = screen.getByPlaceholderText("Buscar categoría...")
    // Abrir el desplegable escribiendo una coincidencia parcial.
    fireEvent.change(input, { target: { value: "Base" } })
    expect(screen.getByText("Base A")).toBeDefined()

    // Primer Atrás: cierra el popover, el modal sigue abierto.
    let consumed = false
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(true)
    expect(screen.queryByText("Base A")).toBeNull()
    expect(screen.getByRole("dialog")).toBeDefined()

    // Segundo Atrás: cierra el modal.
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(true)
    expect(screen.queryByRole("dialog")).toBeNull()

    // Tercero: sin capas.
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(false)
  })

  it("BottomSheet abierto → Atrás lo cierra; Escape y overlay siguen funcionando", () => {
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Sheet">
          <p>cuerpo</p>
        </BottomSheet>
      )
    }
    const { unmount } = render(<Wrapper />)
    expect(screen.getByRole("dialog")).toBeDefined()

    // Cierres existentes intactos: Escape desemboca en el mismo onClose.
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    unmount()
    backNavigationCoordinator.clear()

    // Reabrir y cerrar vía Atrás canónico.
    function Wrapper2() {
      const [open, setOpen] = useState(true)
      return (
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Sheet">
          <p>cuerpo</p>
        </BottomSheet>
      )
    }
    render(<Wrapper2 />)
    expect(screen.getByRole("dialog")).toBeDefined()
    let consumed = false
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(true)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("FullscreenPortal abierto → Atrás lo cierra con el mismo onClose", () => {
    const onClose = vi.fn()
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <FullscreenPortal
          open={open}
          onClose={() => {
            setOpen(false)
            onClose()
          }}
          ariaLabel="portal"
        >
          <div>portal body</div>
        </FullscreenPortal>
      )
    }
    render(<Wrapper />)
    expect(screen.getByText("portal body")).toBeDefined()

    let consumed = false
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText("portal body")).toBeNull()
  })

  it("pulsaciones rápidas sobre una sola capa no hacen doble cierre", () => {
    const onClose = vi.fn()
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <Modal
          open={open}
          onClose={() => {
            setOpen(false)
            onClose()
          }}
          title="una capa"
        >
          <p>x</p>
        </Modal>
      )
    }
    render(<Wrapper />)
    let first = false
    let second = false
    act(() => {
      first = pressBack()
      second = pressBack()
    })
    expect(first).toBe(true)
    // La segunda pulsación ya no encuentra capas: passthrough, no doble onClose.
    expect(second).toBe(false)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("desmontar limpia el registro (sin capas fantasma)", () => {
    function Wrapper() {
      const [open] = useState(true)
      return (
        <Modal open={open} onClose={() => {}} title="efímero">
          <p>x</p>
        </Modal>
      )
    }
    const { unmount } = render(<Wrapper />)
    expect(backNavigationCoordinator.hasLayers()).toBe(true)
    unmount()
    expect(backNavigationCoordinator.hasLayers()).toBe(false)
    let consumed = true
    act(() => {
      consumed = pressBack()
    })
    expect(consumed).toBe(false)
  })

  it("useBackLayer expone la API estable sin conocer Android", () => {
    const onClose = vi.fn()
    function Probe({ open }: { open: boolean }) {
      useBackLayer(open, onClose, "probe")
      return null
    }
    const { rerender, unmount } = render(<Probe open={false} />)
    expect(backNavigationCoordinator.hasLayers()).toBe(false)
    rerender(<Probe open={true} />)
    expect(backNavigationCoordinator.hasLayers()).toBe(true)
    let consumed = false
    act(() => {
      consumed = window.LaVeinteNavigation!.back()
    })
    expect(consumed).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
    expect(backNavigationCoordinator.hasLayers()).toBe(false)
  })

  it("navegación web normal: cerrar por X desregistra y deja la ruta intacta", () => {
    function Wrapper() {
      const [open, setOpen] = useState(true)
      return (
        <Modal open={open} onClose={() => setOpen(false)} title="cerrar con X">
          <p>x</p>
        </Modal>
      )
    }
    render(<Wrapper />)
    fireEvent.click(screen.getByLabelText("Cerrar"))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(backNavigationCoordinator.hasLayers()).toBe(false)
    let consumed = true
    act(() => {
      consumed = pressBack()
    })
    // Sin overlays el Atrás vuelve a la ruta anterior (passthrough).
    expect(consumed).toBe(false)
  })
})
