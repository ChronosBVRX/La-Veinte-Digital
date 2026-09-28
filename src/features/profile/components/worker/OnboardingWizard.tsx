"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/shared/components/ui/Button"
import { WelcomeStep } from "./WelcomeStep"
import { ManualCaptureStep } from "./ManualCaptureStep"
import { ConsentStep } from "./ConsentStep"
import { ConfirmStep } from "./ConfirmStep"
import { SummaryStep } from "./SummaryStep"
import {
  chooseBasicModeAction,
  confirmManualProfileAction,
  completePayslipOnboardingAction,
  grantWorkerConsentAction,
} from "@/features/profile/actions/worker-profile-actions"
import { TarjetonImporterWrapper } from "@/features/tarjeton/components/TarjetonImporterWrapper"
import type { TarjetonImportSuccessMeta } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import type { ConfirmedWorkerProfileUpdate, WorkerFieldName, WorkerProfileDraft, WorkerProfileMode } from "@/shared/domain/worker"

interface OnboardingWizardProps {
  returnTo?: string
  isInitialOnboarding?: boolean
  profileSnapshot?: TarjetonProfileSnapshot | null
  userId: string
  onComplete: (nextState?: "basic" | "configured", nextMode?: WorkerProfileMode | null) => void
}

function buildInitialDraft(snapshot?: TarjetonProfileSnapshot | null): WorkerProfileDraft {
  const confirmedFields: WorkerFieldName[] = []
  const identity: WorkerProfileDraft["identity"] = {}
  const situation: WorkerProfileDraft["situation"] = {}

  if (snapshot?.matricula?.trim()) {
    identity.matricula = snapshot.matricula.trim()
    confirmedFields.push("matricula")
  }
  if (snapshot?.adscripcion?.trim()) {
    identity.adscripcion = snapshot.adscripcion.trim()
    confirmedFields.push("adscripcion")
  }
  if (snapshot?.categoria?.trim()) {
    identity.categoria = snapshot.categoria.trim()
    confirmedFields.push("categoria")
  }
  if (snapshot?.antiguedad && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(snapshot.antiguedad.trim())) {
    situation.effectiveSeniorityDate = snapshot.antiguedad.trim()
    confirmedFields.push("effectiveSeniorityDate")
  }

  return { mode: "manual", identity, situation, confirmedFields }
}

export function OnboardingWizard({
  returnTo,
  isInitialOnboarding,
  profileSnapshot,
  userId,
  onComplete,
}: OnboardingWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [chosenMethod, setChosenMethod] = useState<"manual" | "payslip" | null>(null)
  const [draft, setDraft] = useState<WorkerProfileDraft>(() => buildInitialDraft(profileSnapshot))
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const totalSteps = chosenMethod === "payslip" ? 3 : 5

  const goNext = useCallback(() => setStep((s) => s + 1), [])
  const goBack = useCallback(() => {
    setStep((s) => {
      if (s <= 2) {
        setChosenMethod(null)
        return 1
      }
      return s - 1
    })
  }, [])

  const handlePayslipSuccess = useCallback(async (meta: TarjetonImportSuccessMeta) => {
    setLoading(true)
    setError(null)
    try {
      const result = await completePayslipOnboardingAction(meta)
      if (result.ok) goNext()
      else setError(result.message)
    } finally {
      setLoading(false)
    }
  }, [goNext])

  const handleChoosePayslip = useCallback(() => {
    if (typeof document !== "undefined") {
      const uploaderSection = document.getElementById("subir-tarjeton")
      if (uploaderSection) {
        uploaderSection.scrollIntoView({ behavior: "smooth", block: "start" })
        return
      }
    }
    setChosenMethod("payslip")
    setStep(2)
  }, [])

  const handleStartManual = useCallback(() => {
    setChosenMethod("manual")
    setDraft((prev) => ({ ...prev, mode: "manual" }))
    setStep(2)
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Barra de progreso visible una vez elegido un flujo */}
      {step > 1 && (
        <div>
          <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginBottom: "0.25rem" }}>
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div key={s} style={{
                flex: 1, height: "4px", borderRadius: "2px",
                background: s <= step ? "var(--primary)" : "var(--border)",
                transition: "background 0.3s",
              }} />
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
            Paso {step} de {totalSteps}
          </p>
        </div>
      )}

      {error && (
        <div role="alert" style={{ color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "0.5rem", borderRadius: "0.375rem" }}>
          {error}
        </div>
      )}

      {/* Paso 1 — Bienvenida y elección directa */}
      {step === 1 && (
        <WelcomeStep
          isInitialOnboarding={isInitialOnboarding}
          onChoosePayslip={handleChoosePayslip}
          onStart={handleStartManual}
          onSkipBasic={async () => {
            setLoading(true)
            setError(null)
            try {
              const result = await chooseBasicModeAction()
              if (result.ok) {
                onComplete("basic", null)
                if (returnTo) {
                  router.push(returnTo)
                } else if (isInitialOnboarding) {
                  router.push("/")
                }
              } else {
                setError(result.message)
              }
            } finally {
              setLoading(false)
            }
          }}
          loading={loading}
        />
      )}

      {/* Paso 2a — Captura manual */}
      {step === 2 && chosenMethod === "manual" && (
        <ManualCaptureStep
          draft={draft}
          onChange={setDraft}
          onContinue={goNext}
          onBack={goBack}
        />
      )}

      {/* Paso 2b — Importador canónico de tarjetón (fallback si no existe #subir-tarjeton en DOM) */}
      {step === 2 && chosenMethod === "payslip" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Button variant="ghost" size="sm" onClick={goBack} style={{ alignSelf: "flex-start" }}>
            ← Elegir otro método
          </Button>
          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Guardando tu perfil laboral…</p>
          ) : (
            <TarjetonImporterWrapper
              profile={profileSnapshot ?? null}
              userId={userId}
              onSuccess={handlePayslipSuccess}
            />
          )}
        </div>
      )}

      {/* Paso 3 — Consentimiento (solo manual) */}
      {step === 3 && chosenMethod === "manual" && (
        <ConsentStep
          accepted={consentAccepted}
          onAccept={setConsentAccepted}
          onContinue={goNext}
          onBack={goBack}
        />
      )}

      {/* Paso 4 — Confirmación (solo manual) */}
      {step === 4 && chosenMethod === "manual" && (
        <ConfirmStep
          draft={draft}
          method="manual"
          onConfirm={async () => {
            setLoading(true)
            setError(null)
            try {
              const consentVersion = "2026-08-v1"
              const consentRes = await grantWorkerConsentAction("use_worker_data", consentVersion)
              if (!consentRes.ok) {
                setError(consentRes.message)
                return
              }
              const update: ConfirmedWorkerProfileUpdate = {
                mode: "manual",
                sourceOfRequest: "manual",
                identity: { ...draft.identity },
                situation: { ...draft.situation },
                sources: Object.fromEntries(
                  draft.confirmedFields.map((f) => [f, "manual"])
                ) as ConfirmedWorkerProfileUpdate["sources"],
                consentRef: { purpose: "use_worker_data", version: consentVersion },
              }
              const result = await confirmManualProfileAction(update)
              if (result.ok) goNext()
              else setError(result.message)
            } finally {
              setLoading(false)
            }
          }}
          onBack={goBack}
          loading={loading}
        />
      )}

      {/* Último paso — Resumen */}
      {((step === 3 && chosenMethod === "payslip") || (step === 5 && chosenMethod === "manual")) && (
        <SummaryStep
          returnTo={returnTo}
          onComplete={() => onComplete("configured", chosenMethod ?? "manual")}
        />
      )}
    </div>
  )
}


