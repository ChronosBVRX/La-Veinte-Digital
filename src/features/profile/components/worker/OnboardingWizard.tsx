"use client"

import { useState, useCallback } from "react"
import { Button } from "@/shared/components/ui/Button"
import { WelcomeStep } from "./WelcomeStep"
import { ModeChoiceStep } from "./ModeChoiceStep"
import { MethodChoiceStep } from "./MethodChoiceStep"
import { ManualCaptureStep } from "./ManualCaptureStep"
import { ConsentStep } from "./ConsentStep"
import { ConfirmStep } from "./ConfirmStep"
import { SummaryStep } from "./SummaryStep"
import {
  chooseBasicModeAction,
  confirmManualProfileAction,
  completePayslipOnboardingAction,
} from "@/features/profile/actions/worker-profile-actions"
import { TarjetonImporterWrapper } from "@/features/tarjeton/components/TarjetonImporterWrapper"
import type { TarjetonImportSuccessMeta } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import type { ConfirmedWorkerProfileUpdate, WorkerProfileDraft } from "@/shared/domain/worker"

interface OnboardingWizardProps {
  returnTo?: string
  profileSnapshot?: TarjetonProfileSnapshot | null
  onComplete: () => void
}

export function OnboardingWizard({ returnTo, profileSnapshot, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1)
  const [chosenMode, setChosenMode] = useState<"basic" | "configured" | null>(null)
  const [chosenMethod, setChosenMethod] = useState<"manual" | "payslip" | null>(null)
  const [draft, setDraft] = useState<WorkerProfileDraft>({ mode: "manual", identity: {}, situation: {}, confirmedFields: [] })
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // El tarjetón usa el importador canónico: menos pasos (sin revisión doble
  // ni consentimiento separado; la revisión y autorización ocurren dentro
  // del propio importador antes de confirmar en el servidor).
  const totalSteps = chosenMethod === "payslip" ? 5 : 7

  const goNext = useCallback(() => setStep((s) => s + 1), [])
  const goBack = useCallback(() => setStep((s) => Math.max(1, s - 1)), [])

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Barra de progreso */}
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
            setError(null)
            try {
              const result = await chooseBasicModeAction()
              if (result.ok) onComplete()
              else setError(result.message)
            } finally {
              setLoading(false)
            }
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
            if (!chosenMethod) return
            if (chosenMethod === "manual") {
              setDraft((prev) => ({ ...prev, mode: "manual" }))
            }
            goNext()
          }}
          onBack={goBack}
        />
      )}

      {/* Paso 4a — Captura manual */}
      {step === 4 && chosenMethod === "manual" && (
        <ManualCaptureStep
          draft={draft}
          onChange={setDraft}
          onContinue={goNext}
          onBack={goBack}
        />
      )}

      {/* Paso 4b — Importador canónico de tarjetón (revisión y autorización incluidas) */}
      {step === 4 && chosenMethod === "payslip" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <Button variant="ghost" size="sm" onClick={goBack} style={{ alignSelf: "flex-start" }}>
            ← Elegir otro método
          </Button>
          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Guardando tu perfil laboral…</p>
          ) : (
            <TarjetonImporterWrapper
              profile={profileSnapshot ?? null}
              onSuccess={handlePayslipSuccess}
            />
          )}
        </div>
      )}

      {/* Paso 5 — Consentimiento (solo manual) */}
      {step === 5 && chosenMethod === "manual" && (
        <ConsentStep
          accepted={consentAccepted}
          onAccept={setConsentAccepted}
          onContinue={goNext}
          onBack={goBack}
        />
      )}

      {/* Paso 6 — Confirmación (solo manual) */}
      {step === 6 && chosenMethod === "manual" && (
        <ConfirmStep
          draft={draft}
          method="manual"
          onConfirm={async () => {
            setLoading(true)
            setError(null)
            try {
              const update: ConfirmedWorkerProfileUpdate = {
                mode: "manual",
                sourceOfRequest: "manual",
                identity: { ...draft.identity },
                situation: { ...draft.situation },
                sources: Object.fromEntries(
                  draft.confirmedFields.map((f) => [f, "manual"])
                ) as ConfirmedWorkerProfileUpdate["sources"],
                consentRef: { purpose: "use_worker_data", version: "2026-08-v1" },
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
      {((step === 5 && chosenMethod === "payslip") || (step === 7 && chosenMethod === "manual")) && (
        <SummaryStep
          returnTo={returnTo}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}

