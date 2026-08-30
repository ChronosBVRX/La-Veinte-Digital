import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { PublicPageShell } from "@/shared/components/public/PublicPageShell"
import { DeleteAccountButton } from "@/features/account/components/DeleteAccountButton"

export const metadata = {
  title: "Eliminar mi cuenta | La Veinte Digital",
  description: "Solicita la eliminación definitiva de tu cuenta La Veinte Digital.",
}

export default async function DeleteAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <PublicPageShell
      title="Eliminar mi cuenta"
      intro="La eliminación es definitiva e irreversible"
    >
      <section>
        <h2 style={h2}>Qué se elimina</h2>
        <ul style={list}>
          <li>Tu perfil y datos personales de la cuenta.</li>
          <li>Datos laborales: categoría, antigüedad, jornada.</li>
          <li>Tarjetones, recibos y checadas importados.</li>
          <li>Tu agenda y bitácora.</li>
          <li>Documentos compartidos mediante transferencia/QR.</li>
          <li>Tu acceso a La Veinte Digital (se cierra tu sesión).</li>
        </ul>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--radius)", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#991b1b", lineHeight: 1.6 }}>
            <strong>Esta acción no se puede deshacer.</strong> No podrás recuperar tu cuenta ni tus datos
            después de eliminarla.
          </p>
        </div>
      </section>

      {user ? (
        <section>
          <h2 style={h2}>Confirmar eliminación</h2>
          <p style={{ fontSize: "0.9375rem", color: "var(--muted)" }}>
            Estás autenticado como <strong>{user.email}</strong>. Usa el botón para confirmar.
          </p>
          <DeleteAccountButton />
        </section>
      ) : (
        <section>
          <h2 style={h2}>Para eliminar tu cuenta</h2>
          <p>
            Debes iniciar sesión con la cuenta que quieres eliminar.{" "}
            <Link href="/login" style={link}>Inicia sesión aquí</Link> y vuelve a esta página.
          </p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Si no puedes iniciar sesión o prefieres que un equipo te ayude, escríbenos por Soporte:{" "}
            <em>[REQUIERE_DATO_DEL_PROPIETARIO — canal oficial de soporte]</em>.
          </p>
        </section>
      )}
    </PublicPageShell>
  )
}

import type { CSSProperties } from "react"

const h2: CSSProperties = { fontSize: "1.125rem", fontWeight: 700, margin: "1.5rem 0 0.5rem" }
const list: CSSProperties = { margin: "0 0 1rem", paddingLeft: "1.25rem", lineHeight: 1.6, fontSize: "0.9375rem" }
const link: CSSProperties = { color: "var(--primary)", textDecoration: "none" }
