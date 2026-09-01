// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

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

vi.mock("../components/ImportTarjetonModal", () => ({
  ImportTarjetonModal: () => null,
}))
vi.mock("../components/SendPrintModal", () => ({
  SendPrintModal: () => null,
}))

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: {
              id: "user-test-dp",
              email: "test@example.com",
            },
          },
        }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                full_name: "Rosa Medina",
                matricula: "776655",
                categoria: "Médico No Familiar",
                antiguedad: "10",
              },
            }),
        }),
      }),
    }),
  }),
}))

import { DocumentosPersonales } from "../components/DocumentosPersonales"
import { guardarEscrito } from "@/features/escritos/services/escritos-storage"
import { createEmptyEscritoDraftV2 } from "@/shared/contracts/escrito-draft"

describe("DocumentosPersonales component", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("en entorno web no nativo muestra el mensaje informativo", async () => {
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp

    render(<DocumentosPersonales />)

    expect(
      await screen.findByText(/Esta sección es exclusiva de la app La Veinte Digital/i)
    ).toBeDefined()
  })

  it("en la app nativa lista los escritos del usuario e incluye el botón de editar con enlace a /escritos?id=", async () => {
    const userId = "user-test-dp"
    const draft = createEmptyEscritoDraftV2(userId, undefined, {
      id: "esc-dp-100",
      titulo: "Solicitud de Cambio de Turno",
      cuerpo: "Cuerpo del oficio...",
    })
    guardarEscrito(draft, userId)

    // Mock LaVeinteApp native bridge
    ;(window as unknown as { LaVeinteApp: unknown }).LaVeinteApp = {
      listNativeDocuments: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "Tarjeton_2026_08.pdf",
          localPath: "/data/docs/Tarjeton_2026_08.pdf",
          source: "TU_PERFIL",
          fileSize: 102400,
          downloadedAt: Date.now(),
          mimeType: "application/pdf",
        },
      ]),
    }

    render(<DocumentosPersonales />)

    // Verifica que se muestran las secciones
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Tarjetones" })).toBeDefined()
      expect(screen.getByRole("heading", { name: "Escritos" })).toBeDefined()
      expect(screen.getByText("Solicitud de Cambio de Turno")).toBeDefined()
    })

    // Verifica que existe el enlace para editar el escrito
    const linkEditar = screen.getByTitle("Editar escrito")
    expect(linkEditar).toBeDefined()
    expect(linkEditar.getAttribute("href")).toBe("/escritos?id=esc-dp-100")
  })
})
