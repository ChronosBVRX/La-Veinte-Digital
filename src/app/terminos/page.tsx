import { PublicPageShell } from "@/shared/components/public/PublicPageShell"
import { OWNER_NAME, OWNER_ROLE, CONTACT_EMAIL, CONTACT_MAILTO, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_HREF } from "@/shared/lib/contact"

export const metadata = {
  title: "Términos de Uso | La Veinte Digital",
  description: "Términos y condiciones de uso de La Veinte Digital.",
}

export default function TermsPage() {
  return (
    <PublicPageShell title="Términos de Uso" intro="Última actualización: 2026-08-30">
      <section>
        <h2 style={h2}>1. Aceptación</h2>
        <p>Al usar La Veinte Digital aceptas estos términos. Si no estás de acuerdo, no uses la plataforma.</p>
      </section>

      <section>
        <h2 style={h2}>2. Servicio independiente</h2>
        <p>
          La Veinte Digital es una herramienta <strong>independiente</strong>. <strong>No es una aplicación
          oficial del IMSS ni de ninguna institución de gobierno</strong> y no sustituye los portales o
          servicios oficiales. Los resultados de calculadoras, simuladores y herramientas normativas son
          informativos y dependen de la información que tú proporcionas; pueden variar de la información
          oficial. Verifica siempre con las fuentes oficiales.
        </p>
      </section>

      <section>
        <h2 style={h2}>3. Acceso a portales de terceros</h2>
        <p>
          La app puede dirigirte a portales públicos y oficiales (IMSS, SAT, SNTSS y otros). Al acceder a
          ellos, se aplican los términos y políticas de cada sitio. Tus credenciales de esos portales se
          guardan <em>cifradas en tu dispositivo</em> y se usan para operar dentro del portal; no las
          compartimos y no nos responsabilizamos por el uso de esos portales.
        </p>
      </section>

      <section>
        <h2 style={h2}>4. Responsabilidad del usuario</h2>
        <p>Eres responsable de mantener la confidencialidad de tu contraseña, de no compartir tu cuenta y de usar la aplicación de manera lícita. No debes intentar vulnerar la seguridad de la plataforma.</p>
      </section>

      <section>
        <h2 style={h2}>5. Disponibilidad y cambios</h2>
        <p>Podemos actualizar, modificar o suspender funciones en cualquier momento para mejorar el servicio o cumplir con la ley.</p>
      </section>

      <section>
        <h2 style={h2}>6. Contacto</h2>
        <p>
          Responsable: <strong>{OWNER_NAME}</strong>, {OWNER_ROLE}.
        </p>
        <p>
          Correo: <a href={CONTACT_MAILTO} style={link}>{CONTACT_EMAIL}</a>
          {" · "}
          Teléfono: <a href={CONTACT_PHONE_HREF} style={link}>{CONTACT_PHONE_DISPLAY}</a>
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Consulta nuestra <a href="/privacidad" style={link}>Política de Privacidad</a> y la página de{" "}
          <a href="/soporte" style={link}>Soporte</a>.
        </p>
      </section>
    </PublicPageShell>
  )
}

import type { CSSProperties } from "react"

const h2: CSSProperties = { fontSize: "1.125rem", fontWeight: 700, margin: "1.5rem 0 0.5rem" }
const link: CSSProperties = { color: "var(--primary)", textDecoration: "none" }
