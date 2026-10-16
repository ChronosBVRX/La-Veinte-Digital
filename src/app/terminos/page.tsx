import Link from "next/link"
import type { CSSProperties } from "react"
import { Scale } from "lucide-react"
import { PublicPageShell } from "@/shared/components/public/PublicPageShell"
import { OWNER_NAME, CONTACT_EMAIL, CONTACT_MAILTO, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_HREF } from "@/shared/lib/contact"

export const metadata = {
  title: "Términos de Uso | La Veinte Digital",
  description: "Términos y condiciones de uso de La Veinte Digital.",
}

export default function TermsPage() {
  return (
    <PublicPageShell title="Términos de Uso" intro="Última actualización: 2026-10-16">
      <section>
        <h2 style={h2}>1. Aceptación del Acuerdo</h2>
        <p>
          Al registrarte o utilizar La Veinte Digital, confirmas que has leído, entendido y aceptado estos Términos de Uso, nuestra <Link href="/privacidad" style={link}>Política de Privacidad</Link> y el Deslinde de Responsabilidad Legal. Si no estás de acuerdo con cualquiera de estas condiciones, debes abstenerte de utilizar la plataforma.
        </p>
      </section>

      <section>
        <h2 style={h2}>2. Naturaleza independiente, pedagógica y Deslinde Sindical e Institucional</h2>
        <p>
          La Veinte Digital es un desarrollo tecnológico y pedagógico <strong>estrictamente independiente</strong> creado para facilitar el estudio, consulta y comprensión del Contrato Colectivo de Trabajo (CCT), la Ley Federal del Trabajo y normativas afines por parte de las personas trabajadoras.
        </p>
        <div style={{
          background: "var(--accent)",
          border: "1px solid var(--border)",
          borderLeft: "4px solid var(--primary)",
          borderRadius: "var(--radius-sm)",
          padding: "0.875rem 1rem",
          margin: "1rem 0",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <Scale size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <strong>CLÁUSULA EXPRESA DE NO REPRESENTACIÓN:</strong>
          </span>
          <br />
          La Veinte Digital <strong>NO es una aplicación oficial, filial, representante ni portavoz del Sindicato Nacional de Trabajadores del Seguro Social (SNTSS)</strong>, ni de su Comité Ejecutivo Nacional, ni de la Sección XX, ni de ninguna otra sección sindical. Tampoco es una aplicación oficial ni depende del <strong>Instituto Mexicano del Seguro Social (IMSS)</strong> ni de ninguna dependencia gubernamental.
          <br /><br />
          La plataforma no sustituye la representación sindical estatutaria ni las instancias oficiales obrero-patronales. Los cálculos, simuladores, consultas normativas y borradores de escritos son herramientas orientativas personales elaboradas con base en documentos públicos conforme al artículo 358 de la Ley Federal del Trabajo y los artículos 6º y 7º de la Constitución Política de los Estados Unidos Mexicanos.
        </div>
        <p>
          Los resultados generados son orientativos y dependen de los datos que tú proporciones. No constituyen asesoría jurídica vinculante ni resoluciones oficiales. La persona usuaria es la única responsable de revisar, cotejar y validar cualquier escrito o formato antes de presentarlo ante el IMSS, el SNTSS o cualquier autoridad.
        </p>
      </section>

      <section>
        <h2 style={h2}>3. Acceso a portales de terceros</h2>
        <p>
          La app puede facilitar enlaces o accesos a portales públicos y oficiales (IMSS, SAT, SNTSS y otros). Al acceder a ellos, se aplican exclusivamente los términos y políticas de cada sitio. Tus credenciales de esos portales se guardan <em>cifradas únicamente en tu dispositivo</em>; no las compartimos ni tenemos acceso a ellas.
        </p>
      </section>

      <section>
        <h2 style={h2}>4. Uso estrictamente personal y protección de datos</h2>
        <p>
          Toda la información que registras (nombre, matrícula, adscripción, antigüedad, categoría o conceptos de nómina) se destina <strong>única y exclusivamente para tus propios cálculos personales y la generación de tus formatos y escritos</strong>. Nadie más que tú tiene acceso a tus datos personales.
        </p>
        <p>
          Eres responsable de mantener la confidencialidad de tu contraseña, de no compartir tu cuenta y de usar la
          aplicación de manera lícita. Al utilizar el Asistente o el Generador de Escritos, te comprometes a no ingresar
          datos personales sensibles o confidenciales de terceras personas sin contar con su debida autorización.
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

