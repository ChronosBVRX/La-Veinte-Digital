"use server"

import { revalidatePath } from "next/cache"
import { WorkerProfileService } from "@/shared/server/worker-profile"
import { WorkerProfileUnauthorizedError, WorkerProfileConsentRequiredError, WorkerProfileTransitionError, WorkerProfilePersistenceError } from "@/shared/server/worker-profile/errors"
import type { ConfirmedWorkerProfileUpdate, ConsentPurpose, WorkerProfileMode } from "@/shared/domain/worker"
import type { TarjetonImportSuccessMeta } from "@/shared/contracts/tarjeton-import"

export type ActionResult = { ok: true; data?: unknown } | { ok: false; code: string; message: string }

function handleError(err: unknown): { ok: false; code: string; message: string } {
  if (err instanceof WorkerProfileUnauthorizedError) return { ok: false, code: err.code, message: "No autenticado." }
  if (err instanceof WorkerProfileConsentRequiredError) return { ok: false, code: err.code, message: "Autoriza el uso de tus datos laborales para continuar." }
  if (err instanceof WorkerProfileTransitionError) return { ok: false, code: err.code, message: err.message }
  if (err instanceof WorkerProfilePersistenceError) return { ok: false, code: err.code, message: err.message }
  const msg = err instanceof Error ? err.message : "Error inesperado."
  console.error("[worker-profile-action]", msg)
  return { ok: false, code: "persistence", message: "No se pudo completar la operación. Inténtalo de nuevo." }
}

export async function chooseBasicModeAction(): Promise<ActionResult> {
  try {
    const svc = new WorkerProfileService()
    await svc.chooseBasicMode()
    revalidatePath("/profile/mi-informacion-laboral")
    return { ok: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function confirmManualProfileAction(input: ConfirmedWorkerProfileUpdate): Promise<ActionResult> {
  try {
    const svc = new WorkerProfileService()
    svc.validateConfirmedUpdate(input)
    await svc.confirmManualProfile(input)
    revalidatePath("/profile/mi-informacion-laboral")
    return { ok: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function confirmPayslipProfileAction(
  profile: ConfirmedWorkerProfileUpdate,
  extractionMethod?: string,
  confidence?: number,
  period?: string,
): Promise<ActionResult> {
  try {
    const svc = new WorkerProfileService()
    svc.validateConfirmedUpdate(profile)
    await svc.confirmPayslipProfile(profile, { extractionMethod, confidence, period })
    revalidatePath("/profile/mi-informacion-laboral")
    return { ok: true }
  } catch (err) {
    return handleError(err)
  }
}

/**
 * Cierra el flujo de importación de tarjetón dejando el onboarding laboral
 * en estado configurado (modo tarjetón) sin reescribir campos: los valores
 * ya fueron persistidos por la confirmación canónica del tarjetón
 * (`/api/tarjeton/confirm` → `confirm_imported_payslip`).
 *
 * Registra el consentimiento `store_tarjeton` —el usuario lo autorizó
 * explícitamente en la pantalla de revisión del tarjetón— y voltea
 * worker_preferences a configured/payslip con metadata técnica del evento.
 */
export async function completePayslipOnboardingAction(
  meta: TarjetonImportSuccessMeta = {},
): Promise<ActionResult> {
  try {
    const consentVersion = "2026-08-v1"
    const method: string | undefined =
      meta.method === "native_text" || meta.method === "ocr" || meta.method === "hybrid"
        ? meta.method
        : undefined
    const confidence =
      typeof meta.confidence === "number" && meta.confidence >= 0 && meta.confidence <= 1
        ? meta.confidence
        : undefined

    const svc = new WorkerProfileService()
    await svc.grantConsent("store_tarjeton", consentVersion)
    await svc.confirmPayslipProfile(
      {
        mode: "payslip",
        sourceOfRequest: "payslip",
        identity: {},
        situation: {},
        sources: {},
        consentRef: { purpose: "store_tarjeton", version: consentVersion },
      },
      { extractionMethod: method, confidence, period: meta.period ?? undefined },
    )
    revalidatePath("/profile/mi-informacion-laboral")
    return { ok: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function changeWorkerProfileModeAction(mode: WorkerProfileMode): Promise<ActionResult> {
  try {
    const svc = new WorkerProfileService()
    await svc.changeWorkerProfileMode(mode)
    revalidatePath("/profile/mi-informacion-laboral")
    return { ok: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function deleteWorkerDataAction(confirmation: string): Promise<ActionResult> {
  try {
    if (confirmation !== "BORRAR") {
      return { ok: false, code: "validation", message: "Escribe BORRAR para confirmar." }
    }
    const svc = new WorkerProfileService()
    await svc.deleteWorkerData()
    revalidatePath("/profile/mi-informacion-laboral")
    return { ok: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function grantWorkerConsentAction(purpose: ConsentPurpose, version: string): Promise<ActionResult> {
  try {
    const svc = new WorkerProfileService()
    await svc.grantConsent(purpose, version)
    revalidatePath("/profile/mi-informacion-laboral")
    return { ok: true }
  } catch (err) {
    return handleError(err)
  }
}

export async function revokeWorkerConsentAction(purpose: ConsentPurpose): Promise<ActionResult> {
  try {
    const svc = new WorkerProfileService()
    await svc.revokeConsent(purpose)
    revalidatePath("/profile/mi-informacion-laboral")
    return { ok: true }
  } catch (err) {
    return handleError(err)
  }
}
