// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ComponentProps, ReactNode } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CopyServiceHeroCard } from "../components/CopyServiceHeroCard"
import { CopyServicePage } from "../components/CopyServicePage"
import type { DocumentScannerFlow } from "@/features/document-scanner/components/DocumentScannerFlow"
import type { SendPrintModal } from "@/shared/components/app/SendPrintModal"

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// Mock DocumentScannerFlow
vi.mock("@/features/document-scanner/components/DocumentScannerFlow", () => ({
  DocumentScannerFlow: ({
    open,
    mode,
    intent,
    onPrintRequest,
    onSaved,
    onClose,
  }: ComponentProps<typeof DocumentScannerFlow>) => {
    if (!open) return null
    return (
      <div data-testid="mock-document-scanner-flow" data-mode={mode} data-intent={intent}>
        <span>Scanner Mode: {mode}</span>
        <button
          onClick={() => {
            onSaved?.({
              id: "doc-1",
              kind: mode === "ine-front" ? "ine" : "documento",
              name: "Doc.pdf",
              storage: "indexeddb",
            })
          }}
        >
          Simular Guardado Opcional
        </button>
        <button
          onClick={() => {
            const fakeFile = new File(["fake pdf"], "Doc.pdf", { type: "application/pdf" })
            onPrintRequest?.(fakeFile, "Doc.pdf")
          }}
        >
          Simular Enviar a Imprimir
        </button>
        <button onClick={onClose}>Cerrar Scanner</button>
      </div>
    )
  },
}))

// Mock SendPrintModal
vi.mock("@/shared/components/app/SendPrintModal", () => ({
  SendPrintModal: ({
    open,
    docName,
    onSent,
    onClose,
  }: ComponentProps<typeof SendPrintModal>) => {
    if (!open) return null
    return (
      <div data-testid="mock-send-print-modal" data-docname={docName}>
        <span>Send Print: {docName}</span>
        <button
          onClick={() => {
            onSent?.()
            onClose()
          }}
        >
          Confirmar Envío QR
        </button>
        <button onClick={onClose}>Cancelar Envío</button>
      </div>
    )
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("CopyServiceHeroCard", () => {
  it("se renderiza en la página principal con enlace a /copias", () => {
    render(<CopyServiceHeroCard />)

    expect(screen.getByRole("heading", { name: "Sacar copias" })).toBeDefined()
    expect(screen.getByText(/Escanea un documento con tu celular y envíalo a imprimir/i)).toBeDefined()
    const link = screen.getByRole("link", { name: /Sacar una copia/i })
    expect(link.getAttribute("href")).toBe("/copias")
    expect(screen.getByText("Documento")).toBeDefined()
    expect(screen.getByText("INE (ambas caras)")).toBeDefined()
  })
})

describe("CopyServicePage", () => {
  it("renderiza el encabezado, advertencia de privacidad y las dos opciones principales", () => {
    render(<CopyServicePage userId="user-test-123" />)

    expect(screen.getByRole("heading", { name: "Sacar copias" })).toBeDefined()
    expect(screen.getByText(/No se guardará automáticamente en tus documentos/i)).toBeDefined()
    expect(screen.getByTestId("copy-option-document")).toBeDefined()
    expect(screen.getByTestId("copy-option-ine")).toBeDefined()
  })

  it("inicia el flujo de digitalización en modo documento con intent='print'", async () => {
    render(<CopyServicePage userId="user-test-123" />)

    fireEvent.click(screen.getByTestId("copy-option-document"))

    await waitFor(() => {
      const scanner = screen.getByTestId("mock-document-scanner-flow")
      expect(scanner).toBeDefined()
      expect(scanner.getAttribute("data-mode")).toBe("document")
      expect(scanner.getAttribute("data-intent")).toBe("print")
    })
  })

  it("inicia el flujo de digitalización en modo INE con intent='print'", async () => {
    render(<CopyServicePage userId="user-test-123" />)

    fireEvent.click(screen.getByTestId("copy-option-ine"))

    await waitFor(() => {
      const scanner = screen.getByTestId("mock-document-scanner-flow")
      expect(scanner).toBeDefined()
      expect(scanner.getAttribute("data-mode")).toBe("ine-front")
      expect(scanner.getAttribute("data-intent")).toBe("print")
    })
  })

  it("cierra el scanner y abre SendPrintModal al solicitar impresión", async () => {
    render(<CopyServicePage userId="user-test-123" />)

    fireEvent.click(screen.getByTestId("copy-option-document"))
    expect(screen.getByTestId("mock-document-scanner-flow")).toBeDefined()

    fireEvent.click(screen.getByText("Simular Enviar a Imprimir"))

    await waitFor(() => {
      expect(screen.queryByTestId("mock-document-scanner-flow")).toBeNull()
      expect(screen.getByTestId("mock-send-print-modal")).toBeDefined()
      expect(screen.getByTestId("mock-send-print-modal").getAttribute("data-docname")).toBe("Doc.pdf")
    })
  })

  it("muestra la pantalla de éxito al completar el envío QR y permite sacar otra copia", async () => {
    render(<CopyServicePage userId="user-test-123" />)

    fireEvent.click(screen.getByTestId("copy-option-document"))
    fireEvent.click(screen.getByText("Simular Enviar a Imprimir"))

    // Confirmar envío en el modal de impresión
    fireEvent.click(screen.getByText("Confirmar Envío QR"))

    await waitFor(() => {
      expect(screen.getByTestId("copy-service-success")).toBeDefined()
      expect(screen.getByText("¡Listo!")).toBeDefined()
      expect(
        screen.getByText("Tu documento fue enviado a la computadora de la oficina sindical. Ya puedes imprimirlo.")
      ).toBeDefined()
    })

    // Botón para sacar otra copia
    fireEvent.click(screen.getByRole("button", { name: "Sacar otra copia" }))

    await waitFor(() => {
      expect(screen.queryByTestId("copy-service-success")).toBeNull()
      expect(screen.getByTestId("copy-service-page")).toBeDefined()
    })
  })

  it("muestra confirmación de guardado en Mis documentos si el usuario activó la casilla opcional", async () => {
    render(<CopyServicePage userId="user-test-123" />)

    fireEvent.click(screen.getByTestId("copy-option-document"))
    fireEvent.click(screen.getByText("Simular Guardado Opcional"))
    fireEvent.click(screen.getByText("Simular Enviar a Imprimir"))

    fireEvent.click(screen.getByText("Confirmar Envío QR"))

    await waitFor(() => {
      expect(screen.getByTestId("copy-service-success")).toBeDefined()
      expect(screen.getByText("También guardamos una copia en Mis documentos.")).toBeDefined()
    })
  })
})
