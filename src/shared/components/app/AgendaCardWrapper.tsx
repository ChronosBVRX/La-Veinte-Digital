"use client"

import { AgendaCard } from "@/features/agenda-laboral/components/AgendaCard"
import { useCommitments } from "@/features/agenda-laboral/hooks/useCommitments"
import type { WorkerCommitment } from "@/features/agenda-laboral/types"

interface AgendaCardWrapperProps {
  userId: string
}

export function AgendaCardWrapper({ userId }: AgendaCardWrapperProps) {
  const { upcoming, add, refresh } = useCommitments(userId)

  return (
    <AgendaCard
      userId={userId}
      commitments={upcoming}
      onCommitmentsChange={refresh}
      onAdd={add}
    />
  )
}
