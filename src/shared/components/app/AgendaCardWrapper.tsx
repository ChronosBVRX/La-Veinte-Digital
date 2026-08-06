"use client"

import { useState } from "react"
import { AgendaCard } from "@/features/agenda-laboral/components/AgendaCard"
import { useCommitments } from "@/features/agenda-laboral/hooks/useCommitments"
import { Alert } from "@/shared/components/ui/Alert"
import { Button } from "@/shared/components/ui/Button"
import type { WorkerCommitment } from "@/features/agenda-laboral/types"

interface AgendaCardWrapperProps {
  userId: string
}

export function AgendaCardWrapper({ userId }: AgendaCardWrapperProps) {
  const { upcoming, fetchError, migration, retryMigration, add, refresh } = useCommitments(userId)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleAdd = async (c: Omit<WorkerCommitment, "id" | "createdAt">) => {
    setSaveError(null)
    const result = await add(c)
    if (!result) {
      setSaveError("No se pudo guardar el compromiso. Intenta de nuevo.")
    }
  }

  return (
    <>
      <AgendaCard
        userId={userId}
        commitments={upcoming}
        onCommitmentsChange={refresh}
        onAdd={handleAdd}
      />
      {fetchError && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert variant="warning">No pudimos actualizar tu agenda. Revisa tu conexión.</Alert>
        </div>
      )}
      {saveError && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert variant="error">{saveError}</Alert>
        </div>
      )}
      {migration === "failed" && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Alert
            variant="warning"
            title="Migración pendiente"
            action={<Button variant="outline" size="sm" onClick={retryMigration}>Reintentar</Button>}
          >
            No se pudieron migrar todos tus compromisos anteriores. Tus datos locales no se han perdido.
          </Alert>
        </div>
      )}
    </>
  )
}
