"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { TarjetonImporterWrapper } from "@/features/tarjeton/components/TarjetonImporterWrapper"
import { completePayslipOnboardingAction } from "@/features/profile/actions/worker-profile-actions"
import type { TarjetonImportSuccessMeta } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"

interface TarjetonUploaderSectionProps {
  profileSnapshot: TarjetonProfileSnapshot | null
  userId: string
}

/**
 * Uploader canónico de tarjetón dentro de Mi información laboral.
 * Tras cada confirmación exitosa deja el onboarding laboral configurado
 * (modo tarjetón) sin reescribir campos —los valores ya fueron guardados
 * por la confirmación canónica— y refresca la vista servidor.
 */
export function TarjetonUploaderSection({ profileSnapshot, userId }: TarjetonUploaderSectionProps) {
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastMeta, setLastMeta] = useState<TarjetonImportSuccessMeta | null>(null)
  const [retryingSync, setRetryingSync] = useState(false)
  const router = useRouter()

  const handleSuccess = useCallback(async (_meta: TarjetonImportSuccessMeta) => {
    setSyncError(null)
    try {
      const result = await completePayslipOnboardingAction(_meta)
      if (!result.ok) {
        setLastMeta(_meta)
        setSyncError("Tu tarjetón se guardó correctamente, pero hubo un detalle al actualizar el estado general de tu perfil laboral.")
      }
    } catch {
      setLastMeta(_meta)
      setSyncError("Tu tarjetón se guardó correctamente, pero ocurrió un problema de red al actualizar tu perfil laboral.")
    } finally {
      router.refresh()
    }
  }, [router])

  const handleRetrySync = async () => {
    if (!lastMeta) return
    setRetryingSync(true)
    try {
      const result = await completePayslipOnboardingAction(lastMeta)
      if (result.ok) {
        setSyncError(null)
        setLastMeta(null)
      } else {
        setSyncError("No se pudo actualizar el estado del perfil: " + result.message)
      }
    } catch {
      setSyncError("Error de conexión al actualizar el perfil laboral.")
    } finally {
      setRetryingSync(false)
      router.refresh()
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {syncError && (
        <div
          role="alert"
          style={{
            color: "#92400e",
            fontSize: "0.875rem",
            background: "#fef3c7",
            border: "1px solid #fde68a",
            padding: "0.75rem",
            borderRadius: "0.375rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>{syncError}</span>
          {lastMeta && (
            <button
              onClick={handleRetrySync}
              disabled={retryingSync}
              style={{
                background: "#f59e0b",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.25rem",
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: retryingSync ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                opacity: retryingSync ? 0.7 : 1,
              }}
            >
              {retryingSync ? "Reintentando…" : "Reintentar"}
            </button>
          )}
        </div>
      )}
      <TarjetonImporterWrapper profile={profileSnapshot} userId={userId} onSuccess={handleSuccess} />
    </div>
  )
}
