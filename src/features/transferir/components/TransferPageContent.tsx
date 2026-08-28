"use client"

import { useSearchParams } from "next/navigation"
import { WarningCircle } from "@phosphor-icons/react"
import { TransferPhonePage } from "./TransferPhonePage"
import { PrintSendPanel } from "./PrintSendPanel"
import { TransferShell } from "./TransferShell"

export function TransferPageContent() {
  const params = useSearchParams()
  const token = params.get("t")
  const printMode = params.get("print")

  if (printMode === "1") {
    return (
      <TransferShell>
        <PrintSendPanel />
      </TransferShell>
    )
  }

  if (token) return <TransferPhonePage token={token} />

  return (
    <TransferShell>
      <div style={{ textAlign: "center" }}>
        <WarningCircle size={40} style={{ color: "var(--error)" }} />
        <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0.75rem 0 0.25rem" }}>
          Enlace no válido
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
          Escanea de nuevo el código QR mostrado en el otro dispositivo.
        </p>
      </div>
    </TransferShell>
  )
}
