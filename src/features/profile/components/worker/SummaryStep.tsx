"use client"
import { Button } from "@/shared/components/ui/Button"
import { useRouter } from "next/navigation"

export function SummaryStep({ returnTo, onComplete }: { returnTo?: string; onComplete: () => void }) {
  const router = useRouter()
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", alignItems: "center", textAlign: "center" }}>
      <div style={{ fontSize: "2rem" }}>✅</div>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>¡Perfil configurado!</h2>
      <p style={{ color: "var(--muted)", fontSize: "0.9375rem", margin: 0 }}>
        Tus datos se guardaron. Las herramientas ya pueden usarlos para completar cálculos automáticamente.
      </p>
      <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
        Puedes modificarlos desde Mi perfil → Mi información laboral.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: "320px" }}>
        <Button onClick={() => { onComplete(); router.push("/") }} style={{ width: "100%", justifyContent: "center" }}>
          Ir al inicio
        </Button>
        {returnTo && (
          <Button variant="secondary" onClick={() => { onComplete(); router.push(returnTo) }} style={{ width: "100%", justifyContent: "center" }}>
            Volver a la herramienta
          </Button>
        )}
      </div>
    </div>
  )
}
