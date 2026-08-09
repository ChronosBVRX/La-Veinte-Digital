"use client"

import { useState } from "react"
import { TarjetonImporterWrapper } from "./TarjetonImporterWrapper"
import { TarjetonHistorySection } from "./TarjetonHistorySection"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"

interface PreviousImport {
  id: string
  periodRaw: string | null
  extractionMethod: string
  globalConfidence: number
  createdAt: string
  employeeName: string | null
  totalNet: number | null
}

export function TarjetonPageClient({
  profile,
  previousImports,
}: {
  profile: TarjetonProfileSnapshot
  previousImports: PreviousImport[]
}) {
  const [showUploader, setShowUploader] = useState(previousImports.length === 0)

  return (
    <>
      {previousImports.length > 0 && (
        <TarjetonHistorySection
          imports={previousImports}
          onUploadNew={() => setShowUploader(true)}
        />
      )}
      {showUploader && <TarjetonImporterWrapper profile={profile} />}
    </>
  )
}
