import Link from "next/link"
import type { CSSProperties } from "react"
import { PublicPageShell } from "@/shared/components/public/PublicPageShell"
import { OWNER_NAME, CONTACT_EMAIL, CONTACT_MAILTO, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_HREF } from "@/shared/lib/contact"

export const metadata = {
  title: "Términos de Uso | La Veinte Digital",
  description: "Términos y condiciones de uso de La Veinte Digital.",
}

export default function TermsPage() {
  return (
    <PublicPageShell title="Términos de Uso" intro="Última actualización: 2026-10-12">
      <section>
        <h2 style={h2}>1. Aceptación</h2>
        <p>Al usar La Veinte Digital aceptas estos términos y nuestra <Link href="/privacidad" style={link}>Política de Privacidad</Link>. Si no estás de acuerdo, no uses la plataforma.</p>
      </section>

      <section>
        <h2 style={h2}>2. Servicio independiente y alcance orientativo</h2>
        <p>
          La Veinte Digital es una herramienta <strong>independiente</strong>. <strong>No es una aplicación
          oficial del IMSS ni de ninguna institución de gobierno</strong> y no sustituye los portales, dictámenes o
          servicios oficiales. Los resultados de calculadoras, simuladores, consultas normativas y borradores de escritos
          generados con apoyo de inteligencia artificial tienen carácter estrictamente <strong>informativo y orientativo</strong>,
          y dependen de la exactitud de los datos que tú proporcionas; pueden variar respecto de las determinaciones
          oficiales. No constituyen asesoría jurídica vinculante ni resolución institucional. El usuario es el único
          responsable de revisar, validar y firmar cualquier escrito o solicitud antes de presentarlo ante el IMSS, el SNTSS
          o cualquier autoridad.
        </p>
      </section>

      <section>
        <h2 style={h2}>3. Acceso a portales de terceros</h2>
        <p>
          La app puede dirigirte a portales públicos y oficiales (IMSS, SAT, SNTSS y otros). Al acceder a
          ellos, se aplican los términos y políticas de cada sitio. Tus credenciales de esos portales se
          guardan <em>cifradas en tu dispositivo</em> y se usan para operar dentro del portal; no las
          compartimos y no nos responsabilizamos por la disponibilidad ni el uso de esos portales.
        </p>
      </section>

      <section>
        <h2 style={h2}>4. Responsabilidad del usuario y minimización de datos</h2>
        <p>
          Eres responsable de mantener la confidencialidad de tu contraseña, de no compartir tu cuenta y de usar la
          aplicación de manera lícita. Al utilizar el Asistente o el Generador de Escritos, te comprometes a no ingresar
          datos personales sensibles o confidenciales de terceras personas sin contar con su autorización o legitimación.
          Queda prohibido intentar vulnerar los mecanismos de autenticación, aislamiento de datos o seguridad de la plataforma.
        </p>
      </section>

      <section>
        <h2 style={h2}>5. Disponibilidad, cambios y legislación aplicable</h2>
        <p>
          Podemos actualizar, modificar o suspender funciones en cualquier momento para mejorar el servicio, reforzar la
          seguridad o cumplir con la ley. Estos Términos de Uso se rigen e interpretan conforme a las leyes aplicables en
          los Estados Unidos Mexicanos.
        </p>
      </section>

      <section>
        <h2 style={h2}>6. Contacto</h2>
        <p>
          Responsable: <strong>{OWNER_NAME}</strong>.
        </p>
        <p>
          Correo: <a href={CONTACT_MAILTO} style={link}>{CONTACT_EMAIL}</a>
          {" · "}
          Teléfono: <a href={CONTACT_PHONE_HREF} style={link}>{CONTACT_PHONE_DISPLAY}</a>
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Consulta nuestra <Link href="/privacidad" style={link}>Política de Privacidad</Link> y la página de{" "}
          <Link href="/soporte" style={link}>Soporte</Link>.
        </p>
      </section>
    </PublicPageShell>
  )
}

const h2: CSSProperties = { fontSize: "1.125rem", fontWeight: 700, margin: "1.5rem 0 0.5rem" }
const link: CSSProperties = { color: "var(--primary)", textDecoration: "none" }

