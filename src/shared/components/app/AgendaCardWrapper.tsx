"use client"

import { useState, useMemo } from "react"
import { AgendaCard } from "@/features/agenda-laboral/components/AgendaCard"
import { useCommitments } from "@/features/agenda-laboral/hooks/useCommitments"
import { useSelectedAgendaDate } from "@/features/agenda-laboral/lib/agenda-bus"
import { Alert } from "@/shared/components/ui/Alert"
import { Button } from "@/shared/components/ui/Button"
import type { WorkerCommitment } from "@/features/agenda-laboral/types"

interface AgendaCardWrapperProps {
  userId: string
}

export function AgendaCardWrapper({ userId }: AgendaCardWrapperProps) {
  const { getCommitmentsForDate, fetchError, migration, retryMigration, add, refresh } = useCommitments(userId)
  const [selectedDate, setSelectedDate] = useSelectedAgendaDate()
  const [saveError, setSaveError] = useState<string | null>(null)

  const selectedCommitments = useMemo(() => {
    return getCommitmentsForDate(selectedDate)
  }, [getCommitmentsForDate, selectedDate])

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
        commitments={selectedCommitments}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
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
