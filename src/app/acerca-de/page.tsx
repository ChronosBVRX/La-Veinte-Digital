import { PublicPageShell } from "@/shared/components/public/PublicPageShell"

export const metadata = {
  title: "Acerca de | La Veinte Digital",
  description: "Qué es La Veinte Digital, a quién sirve y su relación con terceros.",
}

export default function AboutPage() {
  return (
    <PublicPageShell title="Acerca de La Veinte Digital" intro="Una plataforma digital de la comunidad SNTSS">
      <section>
        <h2 style={h2}>Qué es</h2>
        <p>
          La Veinte Digital es una plataforma digital orientada a trabajadores. Reúne herramientas
          informativas y de consulta: tu perfil laboral, tarjetones y recibos del IMSS, checadas, agenda,
          calculadoras y simuladores, y una biblioteca de normativa laboral.
        </p>
      </section>

      <section>
        <h2 style={h2}>Aviso importante</h2>
        <div style={{
          background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "var(--radius)",
          padding: "1rem 1.25rem", margin: "0.5rem 0 1rem",
        }}>
          <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.6 }}>
            <strong>La Veinte Digital es una herramienta independiente.</strong> No es una aplicación
            oficial del IMSS ni de ninguna institución de gobierno, y no sustituye los portales o servicios
            oficiales. Los resultados de las calculadoras y simuladores son informativos y dependen de los
            datos que tú proporcionas; verifica siempre la información con las fuentes oficiales.
          </p>
        </div>
      </section>

      <section>
        <h2 style={h2}>Acceso a servicios externos</h2>
        <p>
          Desde la app puedes acceder a portales públicos y oficiales (por ejemplo, el portal de «Tu
          Perfil» del IMSS y los trámites de nómina/tarjetón). Al usar esos servicios eres tú quien inicia
          el proceso; La Veinte Digital solo te ayuda a llegar, y las credenciales que escribes se guardan
          cifradas en tu dispositivo.
        </p>
      </section>

      <section>
        <h2 style={h2}>Más información</h2>
        <p>
          Lee nuestra <a href="/privacidad" style={link}>Política de Privacidad</a>,{" "}
          <a href="/terminos" style={link}>Términos de Uso</a>,{" "}
          <a href="/soporte" style={link}>Soporte</a> y{" "}
          <a href="/informacion-y-fuentes" style={link}>Información y fuentes</a>.
        </p>
      </section>
    </PublicPageShell>
  )
}

import type { CSSProperties } from "react"

const h2: CSSProperties = { fontSize: "1.125rem", fontWeight: 700, margin: "1.5rem 0 0.5rem" }
const link: CSSProperties = { color: "var(--primary)", textDecoration: "none" }
