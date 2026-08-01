import Link from "next/link"
import { Button } from "@/shared/components/ui/Button"

export default function NotFound() {
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "420px" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Página no encontrada</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
          La página que buscas no existe o fue movida.
        </p>
        <Link href="/" style={{ display: "inline-flex", justifyContent: "center" }}>
          <Button>Volver al inicio</Button>
        </Link>
      </div>
    </div>
  )
}
