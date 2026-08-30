import { PublicPageShell } from "@/shared/components/public/PublicPageShell"

export const metadata = {
  title: "Soporte | La Veinte Digital",
  description: "Centro de ayuda y contacto de La Veinte Digital.",
}

export default function SupportPage() {
  return (
    <PublicPageShell title="Soporte y Ayuda" intro="Resolvemos tus dudas sobre La Veinte Digital">
      <section>
        <h2 style={h2}>Preguntas frecuentes</h2>
        <h3 style={h3}>¿Cómo inicio sesión?</h3>
        <p>Entra a la app o a la web y toca «Iniciar sesión». Puedes crear tu cuenta con tu correo electrónico.</p>
        <h3 style={h3}>¿La Veinte Digital es una app oficial del IMSS?</h3>
        <p>
          No. Es una herramienta independiente. No es una aplicación oficial del IMSS ni de ninguna
          institución y no sustituye sus portales o servicios.
        </p>
        <h3 style={h3}>¿Se eliminarán mis documentos si elimino mi cuenta?</h3>
        <p>
          Sí. Al eliminar tu cuenta se borran de nuestros servidores tu perfil, tus datos laborales,
          tarjetones, checadas, agenda y documentos compartidos. Los archivos guardados en tu propio
          dispositivo los puedes borrar tú; al eliminar la cuenta la app cierra tu sesión.
        </p>
        <h3 style={h3}>¿Cómo solicito la eliminación de mi cuenta?</h3>
        <p>Desde la app: <strong>Perfil → Privacidad y cuenta → Eliminar mi cuenta</strong>. También puedes usar la página de{" "}
          <a href="/eliminar-cuenta" style={link}>eliminación de cuenta</a>.</p>
      </section>

      <section>
        <h2 style={h2}>Contacto</h2>
        <p>
          {/* REQUIERE_DATO_DEL_PROPIETARIO: correo/chat de soporte real */}
          <em>[REQUIERE_DATO_DEL_PROPIETARIO — canal oficial de soporte de La Veinte Digital]</em>
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Consulta nuestra <a href="/privacidad" style={link}>Política de Privacidad</a> y nuestros{" "}
          <a href="/terminos" style={link}>Términos de Uso</a>.
        </p>
      </section>
    </PublicPageShell>
  )
}

import type { CSSProperties } from "react"

const h2: CSSProperties = { fontSize: "1.125rem", fontWeight: 700, margin: "1.5rem 0 0.5rem" }
const h3: CSSProperties = { fontSize: "1rem", fontWeight: 600, margin: "1rem 0 0.25rem" }
const link: CSSProperties = { color: "var(--primary)", textDecoration: "none" }
