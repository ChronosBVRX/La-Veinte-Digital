"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import type { WorkerProfile, ProfileQuality, FieldRequirement, WorkerDataEvent, WorkerProfileMode } from "@/shared/domain/worker"
import { BasicModeCard } from "./BasicModeCard"
import { ProfileQualityCard } from "./ProfileQualityCard"
import { ProfileFieldsList } from "./ProfileFieldsList"
import { ProfileHistoryList } from "./ProfileHistoryList"
import { ChangeMethodDialog } from "./ChangeMethodDialog"
import { DeleteWorkerDataSection } from "./DeleteWorkerDataSection"
import { changeWorkerProfileModeAction } from "@/features/profile/actions/worker-profile-actions"

const OnboardingWizard = dynamic(
  () => import("./OnboardingWizard").then((m) => m.OnboardingWizard),
  { ssr: false }
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
}

export function WorkerProfileCenter({ state, mode, profile, quality, requirements, events, returnTo }: WorkerProfileCenterProps) {
  const [viewState, setViewState] = useState<WorkerState>(state)
  const [viewMode, setViewMode] = useState<WorkerProfileMode | null>(mode ?? null)
  const [showChangeDialog, setShowChangeDialog] = useState(false)

  if (viewState === "unconfigured") {
    return <OnboardingWizard returnTo={returnTo} onComplete={() => { setViewState("basic"); setViewMode(null) }} />
  }

  if (viewState === "basic") {
    return <BasicModeCard onConfigure={() => setViewState("unconfigured")} />
  }

  // configured
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Mi información laboral</h1>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.25rem 0 0" }}>
            {viewMode === "payslip" ? "Perfil configurado mediante tarjetón" : "Perfil configurado mediante captura manual"}
            {profile && <> · Actualizado {profile.updatedAt.slice(0, 10)}</>}
          </p>
        </div>
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
        <DeleteWorkerDataSection onDeleted={() => { setViewState("basic"); setViewMode(null) }} />
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
            if (result.ok) { setViewMode(newMode); setShowChangeDialog(false) }
            return result
          }}
          onCancel={() => setShowChangeDialog(false)}
        />
      )}
    </div>
  )
}
