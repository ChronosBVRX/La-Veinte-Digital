"use client"

import { useState, useCallback } from "react"
import { WelcomeStep } from "./WelcomeStep"
import { ModeChoiceStep } from "./ModeChoiceStep"
import { MethodChoiceStep } from "./MethodChoiceStep"
import { ManualCaptureStep } from "./ManualCaptureStep"
import { ReviewStep } from "./ReviewStep"
import { ConsentStep } from "./ConsentStep"
import { ConfirmStep } from "./ConfirmStep"
import { SummaryStep } from "./SummaryStep"
import { chooseBasicModeAction, grantWorkerConsentAction, confirmManualProfileAction } from "@/features/profile/actions/worker-profile-actions"
import { WORKER_PRIVACY_NOTICE_VERSION } from "@/shared/domain/worker"
import type { WorkerProfileDraft, ConfirmedWorkerProfileUpdate } from "@/shared/domain/worker"

interface OnboardingWizardProps {
  returnTo?: string
  onComplete: () => void
}

export function OnboardingWizard({ returnTo, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1)
  const [chosenMode, setChosenMode] = useState<"basic" | "configured" | null>(null)
  const [chosenMethod, setChosenMethod] = useState<"manual" | "payslip" | null>(null)
  const [draft, setDraft] = useState<WorkerProfileDraft>({ mode: "manual", identity: {}, situation: {}, confirmedFields: [] })
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const goNext = useCallback(() => setStep((s) => s + 1), [])
  const goBack = useCallback(() => setStep((s) => Math.max(1, s - 1)), [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Barra de progreso */}
      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", marginBottom: "0.25rem" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
          <div key={s} style={{
            flex: 1, height: "4px", borderRadius: "2px",
            background: s <= step ? "var(--primary)" : "var(--border)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
        Paso {step} de 8
      </p>

      {error && (
        <div role="alert" style={{ color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "0.5rem", borderRadius: "0.375rem" }}>
          {error}
        </div>
      )}

      {/* Paso 1 — Bienvenida */}
      {step === 1 && (
        <WelcomeStep
          onStart={() => goNext()}
          onSkipBasic={async () => {
            setLoading(true)
            const result = await chooseBasicModeAction()
            setLoading(false)
            if (result.ok) onComplete()
            else setError(result.message)
          }}
          loading={loading}
        />
      )}

      {/* Paso 2 — Modo */}
      {step === 2 && (
        <ModeChoiceStep
          selected={chosenMode}
          onSelect={(mode) => setChosenMode(mode)}
          onContinue={() => {
            if (!chosenMode) return
            if (chosenMode === "basic") {
              chooseBasicModeAction().then((r) => { if (r.ok) onComplete(); else setError(r.message) })
              return
            }
            goNext()
          }}
          onBack={goBack}
        />
      )}

      {/* Paso 3 — Método */}
      {step === 3 && (
        <MethodChoiceStep
          selected={chosenMethod}
          onSelect={(method) => setChosenMethod(method)}
          onContinue={() => {
            if (chosenMethod === "payslip") {
              setError("La importación de tarjetón estará disponible en la siguiente fase. Por ahora configura tu perfil manualmente.")
              return
            }
            setDraft((prev) => ({ ...prev, mode: "manual" }))
            goNext()
          }}
          onBack={goBack}
        />
      )}

      {/* Paso 4 — Captura manual */}
      {step === 4 && (
        <ManualCaptureStep
          draft={draft}
          onChange={setDraft}
          onContinue={goNext}
          onBack={goBack}
        />
      )}

      {/* Paso 5 — Revisión */}
      {step === 5 && (
        <ReviewStep
          draft={draft}
          onEdit={() => setStep(4)}
          onContinue={goNext}
          onBack={goBack}
        />
      )}

      {/* Paso 6 — Consentimiento */}
      {step === 6 && (
        <ConsentStep
          accepted={consentAccepted}
          onAccept={setConsentAccepted}
          onContinue={goNext}
          onBack={goBack}
        />
      )}

      {/* Paso 7 — Confirmación */}
      {step === 7 && (
        <ConfirmStep
          draft={draft}
          onConfirm={async () => {
            setLoading(true)
            setError(null)
            await grantWorkerConsentAction("use_worker_data", WORKER_PRIVACY_NOTICE_VERSION)
            const update: ConfirmedWorkerProfileUpdate = {
              mode: "manual",
              sourceOfRequest: "manual",
              identity: { ...draft.identity },
              situation: { ...draft.situation },
              sources: Object.fromEntries(
                draft.confirmedFields.map((f) => [f, "manual"])
              ) as ConfirmedWorkerProfileUpdate["sources"],
              consentRef: { purpose: "use_worker_data", version: WORKER_PRIVACY_NOTICE_VERSION },
            }
            const result = await confirmManualProfileAction(update)
            setLoading(false)
            if (result.ok) goNext()
            else setError(result.message)
          }}
          onBack={goBack}
          loading={loading}
        />
      )}

      {/* Paso 8 — Resumen */}
      {step === 8 && (
        <SummaryStep
          returnTo={returnTo}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}
