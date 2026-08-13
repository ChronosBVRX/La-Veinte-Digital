import Image from "next/image"
import type { ReactNode } from "react"

export function TransferShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Image
            src="/logo-icon.png"
            alt="La Veinte Digital"
            width={48}
            height={48}
            style={{ maxHeight: "48px", width: "auto" }}
          />
        </div>
        {children}
        <p
          style={{
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--muted)",
            margin: 0,
          }}
        >
          Los documentos se eliminan automáticamente al cerrar la transferencia.
        </p>
      </div>
    </div>
  )
}
