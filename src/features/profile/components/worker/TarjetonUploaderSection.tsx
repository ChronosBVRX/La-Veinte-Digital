"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { TarjetonImporterWrapper } from "@/features/tarjeton/components/TarjetonImporterWrapper"
import { completePayslipOnboardingAction } from "@/features/profile/actions/worker-profile-actions"
import type { TarjetonImportSuccessMeta } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"

interface TarjetonUploaderSectionProps {
  profileSnapshot: TarjetonProfileSnapshot | null
}

/**
 * Uploader canónico de tarjetón dentro de Mi información laboral.
 * Tras cada confirmación exitosa deja el onboarding laboral configurado
 * (modo tarjetón) sin reescribir campos —los valores ya fueron guardados
 * por la confirmación canónica— y refresca la vista servidor.
 */
export function TarjetonUploaderSection({ profileSnapshot }: TarjetonUploaderSectionProps) {
  const [syncError, setSyncError] = useState<string | null>(null)
  const router = useRouter()

  const handleSuccess = useCallback(async (_meta: TarjetonImportSuccessMeta) => {
    setSyncError(null)
    const result = await completePayslipOnboardingAction(_meta)
    if (!result.ok) {
      setSyncError("Tus datos se guardaron, pero no pudimos actualizar el estado de tu perfil laboral. Inténtalo de nuevo subiendo otro tarjetón.")
      return
    }
    router.refresh()
  }, [router])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {syncError && (
        <div role="alert" style={{ color: "#dc2626", fontSize: "0.875rem", background: "#fef2f2", padding: "0.5rem", borderRadius: "0.375rem" }}>
          {syncError}
        </div>
      )}
      <TarjetonImporterWrapper profile={profileSnapshot} onSuccess={handleSuccess} />
    </div>
  )
}
