// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
  confirmPayslipProfile: vi.fn(async () => undefined),
  validateConfirmedUpdate: vi.fn(),
  chooseBasicMode: vi.fn(async () => undefined),
  confirmManualProfile: vi.fn(async () => undefined),
  grantConsent: vi.fn(async () => undefined),
  deleteWorkerData: vi.fn(async () => undefined),
  revalidatePath: vi.fn(),
  routerPush: vi.fn(),
  routerRefresh: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    refresh: mocks.routerRefresh,
  }),
}))

vi.mock("@/features/tarjeton/components/TarjetonImporterWrapper", () => ({
  TarjetonImporterWrapper: () => <div data-testid="tarjeton-importer-wrapper" />,
}))

vi.mock("@/shared/server/worker-profile", () => ({
  WorkerProfileService: vi.fn(function () {
    return {
      chooseBasicMode: mocks.chooseBasicMode,
      confirmManualProfile: mocks.confirmManualProfile,
      confirmPayslipProfile: mocks.confirmPayslipProfile,
      grantConsent: mocks.grantConsent,
      deleteWorkerData: mocks.deleteWorkerData,
      validateConfirmedUpdate: mocks.validateConfirmedUpdate,
      getCurrentProfile: vi.fn(async () => ({ state: "unconfigured" as const })),
      getWorkerPreferences: vi.fn(async () => ({ onboardingState: "unconfigured", preferredWorkerMode: null, updatedAt: "2026-01-01" })),
      getProfileQuality: vi.fn(async () => ({ percent: 0, confidence: 0, confirmedCount: 0, manualCount: 0, inferredCount: 0, missingFields: [], recommendations: [], benefitedTools: [] })),
      getFieldRequirements: vi.fn(() => []),
      getEffectiveConsent: vi.fn(async () => null),
      listWorkerEvents: vi.fn(async () => []),
    }
  }),
}))

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

import {
  completePayslipOnboardingAction,
} from "@/features/profile/actions/worker-profile-actions"
import { WorkerProfileUnauthorizedError } from "@/shared/server/worker-profile/errors"
import { OnboardingWizard } from "../OnboardingWizard"

describe("completePayslipOnboardingAction — cierre unificado del flujo tarjetón", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const minimalUpdateShape = () => {
    const call = mocks.confirmPayslipProfile.mock.calls[0] as unknown[] | undefined
    return call?.[0] as Record<string, unknown> | undefined
  }

  it("registra consentimiento store_tarjeton y luego marca configured/payslip", async () => {
    await completePayslipOnboardingAction({ method: "native_text" })
    expect(mocks.grantConsent).toHaveBeenCalledTimes(1)
    expect(mocks.grantConsent).toHaveBeenCalledWith("store_tarjeton", expect.any(String))
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledTimes(1)
    // El update es mínimo: no reescribe campos (ya los guardó la confirmación canónica).
    const update = minimalUpdateShape()
    expect(update).toBeDefined()
    expect(update?.identity).toEqual({})
    expect(update?.situation).toEqual({})
    expect(update?.sources).toEqual({})
    expect(update?.mode).toBe("payslip")
  })

  it("metadata de extracción viaja al servicio cuando es válida", async () => {
    await completePayslipOnboardingAction({ method: "ocr", confidence: 0.95, period: "Q1 2026" })
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ extractionMethod: "ocr", confidence: 0.95, period: "Q1 2026" }),
    )
  })

  it("método inválido se descarta (la RPC solo acepta native_text|ocr|hybrid)", async () => {
    await completePayslipOnboardingAction({ method: "desconocido" as never })
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ extractionMethod: undefined }),
    )
  })

  it("confianza fuera de rango se descarta", async () => {
    await completePayslipOnboardingAction({ confidence: 1.5 })
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ confidence: undefined }),
    )
  })

  it("sin metadata no inventa valores", async () => {
    await completePayslipOnboardingAction()
    expect(mocks.confirmPayslipProfile).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ extractionMethod: undefined, confidence: undefined, period: undefined }),
    )
  })

  it("fallo al marcar onboarding devuelve error sin ocultar la causa técnica", async () => {
    mocks.confirmPayslipProfile.mockRejectedValue(new WorkerProfileUnauthorizedError())
    const result = await completePayslipOnboardingAction({ method: "native_text" })
    expect(result.ok).toBe(false)
  })

  it("ningún objeto sensible viaja en los argumentos", async () => {
    await completePayslipOnboardingAction({ method: "native_text", confidence: 0.5, period: "Q1" })
    const firstArg = minimalUpdateShape()
    if (firstArg) {
      expect(firstArg).not.toHaveProperty("file")
      expect(firstArg).not.toHaveProperty("pdf")
      expect(firstArg).not.toHaveProperty("base64")
      expect(firstArg).not.toHaveProperty("text")
      expect(firstArg).not.toHaveProperty("parsed")
      expect(firstArg).not.toHaveProperty("userId")
    }
  })
})

describe("OnboardingWizard — flujo directo y consentimiento manual", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("muestra las 3 opciones claras desde el paso inicial sin pasos redundantes", () => {
    render(<OnboardingWizard userId="u1" onComplete={vi.fn()} />)
    expect(screen.getByText("¡Tu cuenta está lista!")).toBeTruthy()
    expect(screen.getByRole("button", { name: /Subir mi tarjetón IMSS/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Capturar datos manualmente/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Omitir por ahora/i })).toBeTruthy()
  })

  it("prerrellena captura manual con profileSnapshot y otorga consentimiento use_worker_data al confirmar", async () => {
    const onComplete = vi.fn()
    render(
      <OnboardingWizard
        userId="u1"
        profileSnapshot={{ matricula: "99123456", adscripcion: "HGZ 32", categoria: "ENFERMERA GENERAL 80" }}
        onComplete={onComplete}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Capturar datos manualmente/i }))

    const matriculaInput = screen.getByPlaceholderText("Ej: 12345678") as HTMLInputElement
    expect(matriculaInput.value).toBe("99123456")

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))

    const checkbox = screen.getByRole("checkbox")
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))

    expect(screen.getByText("¿Confirmas estos datos?")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y guardar" }))

    await waitFor(() => {
      expect(mocks.grantConsent).toHaveBeenCalledWith("use_worker_data", "2026-08-v1")
      expect(mocks.confirmManualProfile).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText("¡Perfil configurado!")).toBeTruthy()
  })

  it("redirige al inicio al omitir en modo básico durante el onboarding inicial", async () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard userId="u1" isInitialOnboarding onComplete={onComplete} />)

    expect(screen.getByText(/¡Registro e inicio de sesión exitoso!/i)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Omitir por ahora/i }))

    await waitFor(() => {
      expect(mocks.chooseBasicMode).toHaveBeenCalledTimes(1)
      expect(onComplete).toHaveBeenCalledWith("basic", null)
      expect(mocks.routerPush).toHaveBeenCalledWith("/")
    })
  })
})

