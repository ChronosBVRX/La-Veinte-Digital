"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import type { WorkerProfile, ProfileQuality, FieldRequirement, WorkerDataEvent, WorkerProfileMode } from "@/shared/domain/worker"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"
import { Button } from "@/shared/components/ui/Button"
import { BasicModeCard } from "./BasicModeCard"
import { ProfileQualityCard } from "./ProfileQualityCard"
import { ProfileFieldsList } from "./ProfileFieldsList"
import { ProfileHistoryList } from "./ProfileHistoryList"
import { ChangeMethodDialog } from "./ChangeMethodDialog"
import { DeleteWorkerDataSection } from "./DeleteWorkerDataSection"
import { changeWorkerProfileModeAction } from "@/features/profile/actions/worker-profile-actions"

const OnboardingWizard = dynamic(
  () => import("./OnboardingWizard").then((m) => m.OnboardingWizard),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          color: "#166534",
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius)",
          fontSize: "0.9375rem",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        <strong>✅ ¡Autenticación exitosa!</strong> Preparando tu cuenta…
      </div>
    ),
  }
)

export type WorkerState = "unconfigured" | "basic" | "configured"

interface WorkerProfileCenterProps {
  state: WorkerState
  mode?: WorkerProfileMode | null
  profile?: WorkerProfile | null
  quality?: ProfileQuality | null
  requirements: readonly FieldRequirement[]
  events: WorkerDataEvent[]
  returnTo?: string
  isInitialOnboarding?: boolean
  profileSnapshot?: TarjetonProfileSnapshot | null
  userId: string
}

export function WorkerProfileCenter({
  state,
  mode,
  profile,
  quality,
  requirements,
  events,
  returnTo,
  isInitialOnboarding,
  profileSnapshot,
  userId,
}: WorkerProfileCenterProps) {
  const serverMode = mode ?? null
  const [override, setOverride] = useState<{
    forServerState: WorkerState
    forServerMode: WorkerProfileMode | null
    viewState: WorkerState
    viewMode: WorkerProfileMode | null
  } | null>(null)
  const [showChangeDialog, setShowChangeDialog] = useState(false)
  const router = useRouter()

  const isOverrideActive =
    override !== null &&
    override.forServerState === state &&
    override.forServerMode === serverMode

  const viewState = isOverrideActive ? override.viewState : state
  const viewMode = isOverrideActive ? override.viewMode : serverMode

  const setClientView = (nextState: WorkerState, nextMode: WorkerProfileMode | null) => {
    setOverride({
      forServerState: state,
      forServerMode: serverMode,
      viewState: nextState,
      viewMode: nextMode,
    })
  }

  const handleComplete = (nextState: WorkerState = "basic", nextMode: WorkerProfileMode | null = null) => {
    setClientView(nextState, nextMode)
    router.refresh()
  }

  if (viewState === "unconfigured") {
    return (
      <OnboardingWizard
        returnTo={returnTo}
        isInitialOnboarding={isInitialOnboarding}
        profileSnapshot={profileSnapshot}
        userId={userId}
        onComplete={handleComplete}
      />
    )
  }

  if (viewState === "basic") {
    return <BasicModeCard onConfigure={() => setClientView("unconfigured", null)} />
  }

  // configured
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, wordBreak: "break-word" }}>Mi información laboral</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0", wordBreak: "break-word" }}>
            {viewMode === "payslip" ? "Perfil configurado mediante tarjetón" : "Perfil configurado mediante captura manual"}
            {profile && <> · Actualizado {profile.updatedAt.slice(0, 10)}</>}
          </p>
        </div>
      </div>

      {/* CTA principal: mantener datos al día con el tarjetón */}
      <div style={{
        background: "linear-gradient(135deg, rgba(37,99,235,0.06), var(--card))",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg, var(--radius))",
        padding: "1rem 1.25rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "0.75rem",
        width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box",
      }}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.125rem", wordBreak: "break-word" }}>
            Mantén tus datos al día con tu tarjetón
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--muted)", wordBreak: "break-word" }}>
            Cada vez que subes un recibo nuevo, tu categoría, antigüedad, jornada y conceptos se actualizan solos.
          </div>
        </div>
        <Button size="sm" style={{ flexShrink: 0 }} onClick={() => {
          document.getElementById("subir-tarjeton")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }}>
          Subir tarjetón
        </Button>
      </div>

      {quality && <ProfileQualityCard quality={quality} />}

      {profile && <ProfileFieldsList profile={profile} requirements={requirements} />}

      {events.length > 0 && <ProfileHistoryList events={events} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <button
          onClick={() => setShowChangeDialog(true)}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.5rem 0.75rem", cursor: "pointer", fontSize: "0.875rem", textAlign: "left" }}
        >
          Cambiar método ({viewMode === "manual" ? "Manual → Tarjetón" : "Tarjetón → Manual"})
        </button>
        <DeleteWorkerDataSection onDeleted={() => { setClientView("basic", null) }} />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem", marginTop: "0.5rem" }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
            Eliminar mi cuenta es una acción independiente que no está disponible en esta versión.
          </p>
        </div>
      </div>

      {showChangeDialog && (
        <ChangeMethodDialog
          current={viewMode ?? "manual"}
          onConfirm={async (newMode) => {
            const result = await changeWorkerProfileModeAction(newMode)
            if (result.ok) { setClientView("configured", newMode); setShowChangeDialog(false) }
            return result
          }}
          onCancel={() => setShowChangeDialog(false)}
        />
      )}
    </div>
  )
}
