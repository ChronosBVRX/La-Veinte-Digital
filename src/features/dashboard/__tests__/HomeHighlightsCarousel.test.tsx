// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { HomeHighlightsCarousel } from "../components/HomeHighlightsCarousel"
import { isExcludedByQuickActions, HOME_QUICK_ACTION_IDS } from "../lib/highlight-exclusion-policy"
import type { Announcement } from "@/shared/contracts/announcements"

let mockWorkerContext: Record<string, unknown> | null = null
let mockWorkerStatus: "idle" | "loading" | "error" | "ready" = "ready"
let mockWorkerError: Error | null = null
const mockRetry = vi.fn()

vi.mock("@/shared/hooks/useLiveWorkerContext", () => ({
  useWorkerContextSync: () => ({
    context: mockWorkerContext,
    status: mockWorkerStatus,
    error: mockWorkerError,
    retry: mockRetry,
  }),
}))

vi.mock("@/features/transferir/components/TransferDocumentsModal", () => ({
  TransferDocumentsModal: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    if (!open) return null
    return (
      <div data-testid="mock-transfer-modal">
        <span>Modal de Transferencia QR</span>
        <button onClick={onClose}>Cerrar Transferencia</button>
      </div>
    )
  },
}))

function setupWorkerWithSalary(amount002 = 10000, amount011 = 8215) {
  mockWorkerStatus = "ready"
  mockWorkerError = null
  mockWorkerContext = {
    userId: "test-user-id",
    meta: {
      userId: "test-user-id",
      activePayslipId: "p-1",
      activePayslipPeriod: "1A-SEP-2026",
      activeEmployeeNumber: "123456",
      selectionMode: "AUTO_LATEST",
      contextRevision: 1,
    },
    profile: { matricula: "123456" },
    payroll: {
      latestPeriod: "1A-SEP-2026",
      recurringConcepts: [
        { conceptCode: "002", lastAmount: amount002, lastSeenAt: "1A-SEP-2026", payslipId: "p-1", confirmed: true },
        { conceptCode: "011", lastAmount: amount011, lastSeenAt: "1A-SEP-2026", payslipId: "p-1", confirmed: true },
      ],
    },
  }
}

function setupWorkerWithoutPayslip() {
  mockWorkerStatus = "ready"
  mockWorkerError = null
  mockWorkerContext = {
    userId: "test-user-id",
    meta: { userId: "test-user-id", activePayslipId: null, activePayslipPeriod: null },
    profile: null,
    payroll: { latestPeriod: null, recurringConcepts: [] },
  }
}

describe("HomeHighlightsCarousel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: [] }),
      }) as Response),
    )
    setupWorkerWithSalary()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("1. renderiza un único carrusel destacado en el DOM", () => {
    render(<HomeHighlightsCarousel />)
    const carousels = screen.getAllByTestId("home-highlights-carousel")
    expect(carousels).toHaveLength(1)
    expect(carousels[0].getAttribute("aria-roledescription")).toBe("carousel")
  })

  it("2. vacaciones 2027 aparece en los slides disponibles", () => {
    render(<HomeHighlightsCarousel />)
    const tab = screen.getByRole("tab", { name: /Ya están disponibles los roles vacacionales 2027/i })
    expect(tab).toBeDefined()

    // Al pulsar el tab correspondiente, se visualiza el slide
    fireEvent.click(tab)
    expect(screen.getByTestId("highlight-vacation-roles")).toBeDefined()
    expect(screen.getByText("Ya están disponibles los roles vacacionales 2027")).toBeDefined()
    expect(screen.getByText("Ver roles 2027")).toBeDefined()
    const cta = screen.getByRole("link", { name: /Ver roles 2027/i })
    expect(cta.getAttribute("href")).toBe("/vacaciones")
  })

  it("3. aumento salarial aparece como slide y muestra el importe estimado quincenal", () => {
    render(<HomeHighlightsCarousel />)
    const salarySlide = screen.getByTestId("highlight-salary-increase")
    expect(salarySlide).toBeDefined()
    expect(screen.getByText("TU AUMENTO ESTIMADO")).toBeDefined()
    expect(screen.getByText(/por quincena/i)).toBeDefined()
    expect(screen.getByRole("button", { name: /Ver detalle/i })).toBeDefined()
  })

  it("3a. aumento salarial en estado sin tarjetón invita a importar y no muestra $0.00", () => {
    setupWorkerWithoutPayslip()
    render(<HomeHighlightsCarousel />)
    expect(screen.getByText("Descubre tu aumento")).toBeDefined()
    expect(screen.getByText("Importa tu tarjetón más reciente para calcularlo.")).toBeDefined()
    const cta = screen.getByRole("link", { name: /Importar tarjetón/i })
    expect(cta.getAttribute("href")).toBe("/profile/mi-informacion-laboral")
    expect(document.body.textContent).not.toContain("$0.00")
  })

  it("3b. aumento salarial en estado de error permite reintentar y no rompe el carrusel", () => {
    mockWorkerStatus = "error"
    mockWorkerError = new Error("Network error")
    render(<HomeHighlightsCarousel />)
    expect(screen.getByText("No pudimos consultar tu información laboral en este momento.")).toBeDefined()
    const retryBtn = screen.getByRole("button", { name: /Reintentar/i })
    fireEvent.click(retryBtn)
    expect(mockRetry).toHaveBeenCalled()
    // El carrusel continúa funcionando
    expect(screen.getByTestId("home-highlights-carousel")).toBeDefined()
  })

  it("4. copias aparece como slide con sus etiquetas", () => {
    render(<HomeHighlightsCarousel />)
    const tab = screen.getByRole("tab", { name: /Sacar copias/i })
    fireEvent.click(tab)

    expect(screen.getByTestId("highlight-copy-service")).toBeDefined()
    expect(screen.getByText("SERVICIO SINDICAL")).toBeDefined()
    expect(screen.getByText("Documento")).toBeDefined()
    expect(screen.getByText("INE (ambas caras)")).toBeDefined()
    const cta = screen.getByRole("link", { name: /Sacar una copia/i })
    expect(cta.getAttribute("href")).toBe("/copias")
  })

  it("5. transferir documentos aparece como slide e invoca el modal QR", () => {
    render(<HomeHighlightsCarousel />)
    const tab = screen.getByRole("tab", { name: /Transferir documentos/i })
    fireEvent.click(tab)

    expect(screen.getByTestId("highlight-transfer-docs")).toBeDefined()
    const cta = screen.getByRole("button", { name: /Transferir documentos/i })
    fireEvent.click(cta)

    expect(screen.getByTestId("mock-transfer-modal")).toBeDefined()
    expect(screen.getByText("Modal de Transferencia QR")).toBeDefined()
  })

  it("6. calculadoras concretas aparecen como slide con enlace a /calculadoras y herramientas reales", () => {
    render(<HomeHighlightsCarousel />)
    const tab = screen.getByRole("tab", { name: /Calcula tus prestaciones/i })
    fireEvent.click(tab)

    expect(screen.getByTestId("highlight-calculators")).toBeDefined()
    expect(screen.getByText("Aguinaldo")).toBeDefined()
    expect(screen.getByText("Tiempo extra")).toBeDefined()
    expect(screen.getByText("Préstamos")).toBeDefined()
    expect(screen.getByText("Segunda de Julio")).toBeDefined()
    expect(screen.getByText("Cláusula 97")).toBeDefined()
    const cta = screen.getByRole("link", { name: /Ver calculadoras/i })
    expect(cta.getAttribute("href")).toBe("/calculadoras")
  })

  it("7. guía del tarjetón aparece como slide con enlace a /guia", () => {
    render(<HomeHighlightsCarousel />)
    const tab = screen.getByRole("tab", { name: /¿Tienes dudas sobre tu tarjetón\?/i })
    fireEvent.click(tab)

    expect(screen.getByTestId("highlight-guia-tarjeton")).toBeDefined()
    const cta = screen.getByRole("link", { name: /Entender mi tarjetón/i })
    expect(cta.getAttribute("href")).toBe("/guia")
  })

  it("8. regla de exclusión funcional: las 6 funciones de HomeQuickActions NO se duplican por ID, título ni ruta", () => {
    expect(HOME_QUICK_ACTION_IDS.has("agenda")).toBe(true)
    expect(HOME_QUICK_ACTION_IDS.has("tarjeton")).toBe(true)
    expect(HOME_QUICK_ACTION_IDS.has("checadas")).toBe(true)
    expect(HOME_QUICK_ACTION_IDS.has("documentos")).toBe(true)
    expect(HOME_QUICK_ACTION_IDS.has("escritos")).toBe(true)
    expect(HOME_QUICK_ACTION_IDS.has("derechos")).toBe(true)

    // Comprobar política con casos duplicados por título o id
    expect(isExcludedByQuickActions({ id: "agenda", title: "Mi agenda" })).toBe(true)
    expect(isExcludedByQuickActions({ title: "Hacer un escrito" })).toBe(true)
    expect(isExcludedByQuickActions({ title: "Mis derechos" })).toBe(true)
    expect(isExcludedByQuickActions({ title: "Mis documentos" })).toBe(true)
    expect(isExcludedByQuickActions({ title: "Mis checadas" })).toBe(true)

    // Comprobar política con casos duplicados por ruta (destination_path / href)
    expect(isExcludedByQuickActions({ href: "/bitacora" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/bitacora/compromiso-1" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/documentos-personales" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/documentos-personales?tab=checadas" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/escritos" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/escritos/nuevo" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/asistente" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/asistente?q=derechos" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/profile/mi-informacion-laboral" })).toBe(true)
    expect(isExcludedByQuickActions({ href: "/tarjeton" })).toBe(true)

    // Casos legítimos del carrusel NO deben ser excluidos
    expect(isExcludedByQuickActions({ id: "salary-increase-highlight", title: "Tu aumento estimado", href: "/profile/mi-informacion-laboral" })).toBe(false)
    expect(isExcludedByQuickActions({ id: "vacation-2027-highlight", title: "Ya están disponibles los roles vacacionales 2027", href: "/vacaciones" })).toBe(false)
    expect(isExcludedByQuickActions({ id: "copy-service-highlight", title: "Sacar copias", href: "/copias" })).toBe(false)
    expect(isExcludedByQuickActions({ id: "transfer-docs-highlight", title: "Transferir documentos" })).toBe(false)
    expect(isExcludedByQuickActions({ id: "calculators-highlight", title: "Calcula tus prestaciones", href: "/calculadoras" })).toBe(false)
    expect(isExcludedByQuickActions({ id: "guia-tarjeton-highlight", title: "¿Tienes dudas sobre tu tarjetón?", href: "/guia" })).toBe(false)
  })

  it("9. respeta prioridades canónicas (aumento > vacaciones > copias > transferir > calculadoras > guía)", () => {
    render(<HomeHighlightsCarousel />)
    const tabs = screen.getAllByRole("tab")
    // El primer tab debe ser aumento salarial
    expect(tabs[0].getAttribute("aria-label")).toContain("por quincena")
    // El segundo tab debe ser vacaciones 2027
    expect(tabs[1].getAttribute("aria-label")).toContain("roles vacacionales 2027")
    // El tercer tab debe ser copias
    expect(tabs[2].getAttribute("aria-label")).toContain("copias")
  })

  it("10. integra anuncios remotos de administración cuando se reciben", async () => {
    const fakeAnnouncement = {
      id: "ann-custom-99",
      kind: "tool",
      title: "Nueva función sindical disponible",
      body: "Ya puedes solicitar trámites en línea",
      bar_text: "Trámites en línea disponibles",
      destination_path: "/copias",
      status: "PUBLISHED",
      show_in_inbox: true,
      show_in_bar: false,
      show_in_home_hero: true,
      publish_at: null,
      expires_at: null,
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as Announcement

    render(<HomeHighlightsCarousel initialAnnouncements={[fakeAnnouncement]} />)
    const tab = screen.getByRole("tab", { name: /Nueva función sindical disponible/i })
    expect(tab).toBeDefined()

    fireEvent.click(tab)
    expect(screen.getByTestId("highlight-announcement-ann-custom-99")).toBeDefined()
    expect(screen.getByText("NUEVA HERRAMIENTA")).toBeDefined()
  })

  it("11. si el fetch de anuncios remotos falla, mantiene los destacados del sistema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Red no disponible")
      }),
    )

    render(<HomeHighlightsCarousel />)
    // El carrusel se mantiene con los destacados base
    expect(screen.getByTestId("home-highlights-carousel")).toBeDefined()
    expect(screen.getByTestId("highlight-salary-increase")).toBeDefined()
  })

  it("12. navegación por controles desktop (flechas siguiente y anterior)", () => {
    render(<HomeHighlightsCarousel />)
    expect(screen.getByTestId("highlight-salary-increase")).toBeDefined()

    const nextBtn = screen.getByRole("button", { name: "Destacado siguiente" })
    fireEvent.click(nextBtn)
    expect(screen.getByTestId("highlight-vacation-roles")).toBeDefined()

    const prevBtn = screen.getByRole("button", { name: "Destacado anterior" })
    fireEvent.click(prevBtn)
    expect(screen.getByTestId("highlight-salary-increase")).toBeDefined()
  })

  it("13. swipe táctil en móvil avanza y retrocede según la dirección", () => {
    render(<HomeHighlightsCarousel />)
    const carouselRoot = screen.getByTestId("home-highlights-carousel")

    // Swipe izquierda (adelante)
    fireEvent.touchStart(carouselRoot, { touches: [{ clientX: 200, clientY: 100 }] })
    fireEvent.touchEnd(carouselRoot, { changedTouches: [{ clientX: 100, clientY: 100 }] })
    expect(screen.getByTestId("highlight-vacation-roles")).toBeDefined()

    // Swipe derecha (atrás)
    fireEvent.touchStart(carouselRoot, { touches: [{ clientX: 100, clientY: 100 }] })
    fireEvent.touchEnd(carouselRoot, { changedTouches: [{ clientX: 200, clientY: 100 }] })
    expect(screen.getByTestId("highlight-salary-increase")).toBeDefined()
  })

  it("14. no desborda en viewport móvil (estilos defensivos minWidth: 0, maxWidth: 100%)", () => {
    render(<HomeHighlightsCarousel />)
    const root = screen.getByTestId("home-highlights-carousel")
    expect(root.style.minWidth).toBe("0px")
    expect(root.style.maxWidth).toBe("100%")
    expect(root.style.overflow).toBe("hidden")
  })
})
