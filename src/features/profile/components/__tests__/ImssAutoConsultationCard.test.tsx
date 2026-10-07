// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ImssAutoConsultationCard } from "../ImssAutoConsultationCard"

describe("ImssAutoConsultationCard", () => {
  beforeEach(() => {
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
  })

  afterEach(() => {
    delete (window as unknown as { LaVeinteApp?: unknown }).LaVeinteApp
    vi.restoreAllMocks()
  })

  it("renderiza en navegador web con explicación de beneficios y aviso de privacidad", () => {
    render(<ImssAutoConsultationCard />)

    expect(screen.getByText("Consultas Automáticas en Portales IMSS")).toBeTruthy()
    expect(screen.getByText("Sabe cuánto vas a cobrar antes")).toBeTruthy()
    expect(screen.getByText("Detecta conceptos habituales faltantes")).toBeTruthy()
    expect(screen.getByText("Historial de checadas biométricas")).toBeTruthy()
    expect(screen.getByText(/Garantía de Seguridad: Tus datos nunca salen de tu celular/i)).toBeTruthy()
    expect(screen.getByText(/Tus contraseñas y accesos a Tu Perfil IMSS/i)).toBeTruthy()
    expect(screen.getByText(/Disponible exclusivamente en la App Móvil/i)).toBeTruthy()
  })

  it("en app nativa con credenciales, muestra estado configurado y botón para gestionar bóveda", async () => {
    const openOfficialPayslips = vi.fn()
    ;(window as unknown as { LaVeinteApp: unknown }).LaVeinteApp = {
      isNativeApp: () => true,
      hasImssCredentials: (portalId: string) => portalId === "tuperfil",
      openOfficialPayslips,
    }

    render(<ImssAutoConsultationCard />)

    const manageBtn = await screen.findByRole("button", { name: /Gestionar Bóveda IMSS/i })
    expect(manageBtn).toBeTruthy()
    expect(screen.getByText(/Bóveda configurada en tu celular/i)).toBeTruthy()

    fireEvent.click(manageBtn)
    expect(openOfficialPayslips).toHaveBeenCalledTimes(1)
  })

  it("en app nativa con credenciales vía Promise asíncrona, detecta y muestra estado activo", async () => {
    ;(window as unknown as { LaVeinteApp: unknown }).LaVeinteApp = {
      isNativeApp: () => true,
      hasImssCredentials: (portalId: string) => Promise.resolve(portalId === "tuperfil"),
      openOfficialPayslips: vi.fn(),
    }

    render(<ImssAutoConsultationCard matricula="99123456" />)

    const manageBtn = await screen.findByRole("button", { name: /Gestionar Bóveda IMSS/i })
    expect(manageBtn).toBeTruthy()
    expect(await screen.findByText(/Bóveda configurada en tu celular/i)).toBeTruthy()
    expect(screen.getByText(/Cuenta vinculada a matrícula 99123456/i)).toBeTruthy()
    expect(screen.getByText(/Acceso listo para consultar tarjetón y checadas \(99123456\)/i)).toBeTruthy()
  })

  it("en app nativa sin credenciales pero con matrícula, muestra matrícula identificada", async () => {
    ;(window as unknown as { LaVeinteApp: unknown }).LaVeinteApp = {
      isNativeApp: () => true,
      hasImssCredentials: () => Promise.resolve(false),
      openOfficialPayslips: vi.fn(),
    }

    render(<ImssAutoConsultationCard matricula="88776655" />)

    const configBtn = await screen.findByRole("button", { name: /Configurar en Bóveda/i })
    expect(configBtn).toBeTruthy()
    expect(screen.getByText(/Cuenta vinculada a matrícula 88776655/i)).toBeTruthy()
  })
})
