import { Suspense } from "react"
import { TransferPageContent } from "@/features/transferir/components/TransferPageContent"

export const metadata = {
  title: "Transferir documento",
}

export default function TransferPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          Cargando…
        </div>
      }
    >
      <TransferPageContent />
    </Suspense>
  )
}
