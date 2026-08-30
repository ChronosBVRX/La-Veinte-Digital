import { PublicPageShell } from "@/shared/components/public/PublicPageShell"

export const metadata = {
  title: "Política de Privacidad | La Veinte Digital",
  description: "Cómo La Veinte Digital recopila, usa y protege tu información.",
}

export default function PrivacyPage() {
  return (
    <PublicPageShell title="Política de Privacidad" intro="Última actualización: 2026-08-30">
      <section>
        <h2 style={h2}>1. Quiénes somos</h2>
        <p>
          La Veinte Digital es una plataforma digital independiente de la comunidad SNTSS.{" "}
          <strong>No es una aplicación oficial del IMSS ni de ninguna institución de gobierno.</strong>{" "}
          Solo proporciona herramientas informativas y de acceso a portales públicos y oficiales.
        </p>
      </section>

      <section>
        <h2 style={h2}>2. Qué información usamos</h2>
        <p>Usamos únicamente los datos necesarios para que la plataforma funcione:</p>
        <ul style={list}>
          <li><strong>Cuenta:</strong> correo electrónico y contraseña para iniciar sesión (gestionados por Supabase Auth).</li>
          <li><strong>Perfil laboral:</strong> nombre, matrícula/adscripción, categoría, antigüedad y jornada que tú ingresas.</li>
          <li><strong>Tarjetones y nómina:</strong> los datos de tu tarjetón IMSS y recibos de pago que importas. Los PDFs se procesan en tu propio dispositivo; a nuestros servidores van los datos estructurados y no la imagen del documento.</li>
          <li><strong>Documentos personales:</strong> los archivos que guardas, se almacenan de forma local en tu dispositivo; solo viajan a nuestros servidores cuando tú los envías mediante el flujo de transferencia/impresión por QR.</li>
          <li><strong>Cámara:</strong> se usa únicamente para leer códigos QR, solo cuando tú entras a esa función.</li>
          <li><strong>Notificaciones:</strong> un identificador de tu dispositivo (token de Firebase Cloud Messaging) para enviarte avisos.</li>
          <li><strong>Credenciales IMSS:</strong> cuando decides usar los servicios del IMSS desde la app, las credenciales del portal que escribes se guardan <em>cifradas</em> solo en tu dispositivo (Android Keystore) y nunca se envían a los servidores de La Veinte Digital; se usan para operar dentro del portal oficial.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>3. Datos que NO recopilamos</h2>
        <ul style={list}>
          <li>No usamos SDKs de publicidad ni de analítica de terceros.</li>
          <li>No vendemos ni compartimos tus datos con anunciantes.</li>
          <li>No leemos tu galería de fotos completa; la cámara solo se usa bajo tu acción.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>4. Proveedores que procesan datos en nuestro nombre</h2>
        <p>Dependemos de los siguientes servicios para operar:</p>
        <ul style={list}>
          <li><strong>Supabase</strong> (autenticación y base de datos): guarda tu cuenta, perfil y datos laborales.</li>
          <li><strong>Firebase Cloud Messaging</strong> (Google): procesa los identificadores de dispositivo para enviar notificaciones.</li>
          <li><strong>Portales externos</strong> (IMSS, SAT, SNTSS y otros): cuando accedes a ellos desde la app, el tratamiento de tus datos se rige por las políticas de cada portal oficial, no por nosotros.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>5. Finalidad y retención</h2>
        <p>Usamos tus datos para brindarte las funciones de la plataforma (consultas, tarjetones, simuladores) y para avisarte de novedades. Conservamos tu cuenta y datos mientras la plataforma esté activa. Cuando eliminas tu cuenta, borramos tus datos de nuestros servidores.</p>
      </section>

      <section>
        <h2 style={h2}>6. Seguridad</h2>
        <p>Protegemos tu información con cifrado en tránsito (HTTPS), cifrado en reposo en nuestras bases de datos, almacenamiento cifrado de credenciales del IMSS en tu dispositivo y bloqueo biométrico opcional. La app no permite el respaldo en la nube ni la transferencia a otro dispositivo de tu información sensible (documentos, credenciales, sesión).</p>
      </section>

      <section>
        <h2 style={h2}>7. Tus derechos</h2>
        <p>Puedes consultar, corregir o eliminar tu información. Puedes solicitar la eliminación de tu cuenta desde <strong>Perfil → Privacidad y cuenta → Eliminar mi cuenta</strong>, o desde la sección de eliminación de cuenta de este sitio.</p>
      </section>

      <section>
        <h2 style={h2}>8. Contacto</h2>
        {/* REQUIERE_DATO_DEL_PROPIETARIO: se debe completar el correo/contacto real de soporte de La Veinte Digital */}
        <p>
          Para dudas sobre privacidad: soporte de La Veinte Digital.{" "}
          <em>[REQUIERE_DATO_DEL_PROPIETARIO — correo de contacto oficial]</em>
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Consulta también nuestros <a href="/terminos" style={link}>Términos de Uso</a> y la página de{" "}
          <a href="/soporte" style={link}>Soporte</a>.
        </p>
      </section>
    </PublicPageShell>
  )
}

import type { CSSProperties } from "react"

const h2: CSSProperties = { fontSize: "1.125rem", fontWeight: 700, margin: "1.5rem 0 0.5rem" }
const list: CSSProperties = { margin: "0 0 1rem", paddingLeft: "1.25rem", lineHeight: 1.6, fontSize: "0.9375rem" }
const link: CSSProperties = { color: "var(--primary)", textDecoration: "none" }
