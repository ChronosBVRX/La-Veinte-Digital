"use client"

import dynamic from "next/dynamic"
import type { TarjetonImportSuccessMeta } from "@/shared/contracts/tarjeton-import"
import type { TarjetonProfileSnapshot } from "@/features/tarjeton/hooks/useTarjetonImporter"

const TarjetonImporterInner = dynamic(
  () =>
    import("@/features/tarjeton/components/TarjetonImporter").then(
      (m) => m.TarjetonImporter
    ),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "2rem",
          textAlign: "center",
          color: "var(--muted)",
        }}
      >
        Cargando visor de tarjetón...
      </div>
    ),
  }
)

export function TarjetonImporterWrapper({
  profile,
  userId,
  onSuccess,
}: {
  profile: TarjetonProfileSnapshot | null
  userId: string
  onSuccess?: (meta: TarjetonImportSuccessMeta) => void
}) {
  return <TarjetonImporterInner profile={profile} userId={userId} onSuccess={onSuccess} />
}
