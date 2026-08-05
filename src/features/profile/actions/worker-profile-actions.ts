"use server"

import { revalidatePath } from "next/cache"
import { WorkerProfileService } from "@/shared/server/worker-profile"
import { WorkerProfileUnauthorizedError, WorkerProfileConsentRequiredError, WorkerProfileTransitionError, WorkerProfilePersistenceError } from "@/shared/server/worker-profile/errors"
import type { ConfirmedWorkerProfileUpdate, ConsentPurpose, WorkerProfileMode } from "@/shared/domain/worker"

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
