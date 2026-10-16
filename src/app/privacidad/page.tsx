import Link from "next/link"
import type { CSSProperties } from "react"
import { Scale, Lock } from "lucide-react"
import { PublicPageShell } from "@/shared/components/public/PublicPageShell"
import { OWNER_NAME, CONTACT_EMAIL, CONTACT_MAILTO, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_HREF } from "@/shared/lib/contact"

export const metadata = {
  title: "Política de Privacidad | La Veinte Digital",
  description: "Cómo La Veinte Digital recopila, usa y protege tu información conforme a la LFPDPPP.",
}

export default function PrivacyPage() {
  return (
    <PublicPageShell title="Política de Privacidad" intro="Última actualización: 2026-10-16">
      <section>
        <h2 style={h2}>1. Quiénes somos, Deslinde Legal y Responsable del Tratamiento</h2>
        <p>
          La Veinte Digital es una herramienta tecnológica independiente de consulta normativa, cálculo de prestaciones y apoyo pedagógico para la comunidad de personas trabajadoras del Seguro Social.
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
            <strong>DESLINDE DE RESPONSABILIDAD SINDICAL E INSTITUCIONAL:</strong>
          </span>
          <br />
          La Veinte Digital <strong>NO es una aplicación oficial, filial, representante ni portavoz del Sindicato Nacional de Trabajadores del Seguro Social (SNTSS)</strong>, ni de su Comité Ejecutivo Nacional, ni de la Sección XX, ni de ninguna otra sección sindical. Tampoco es una aplicación oficial ni depende del <strong>Instituto Mexicano del Seguro Social (IMSS)</strong> ni de ninguna dependencia de gobierno.
          <br /><br />
          No existe subordinación laboral, representación sindical estatutaria de hecho o de derecho, ni vinculación orgánica o política con las dirigencias sindicales ni con las autoridades patronales. Su propósito es estrictamente formativo, de divulgación del Contrato Colectivo de Trabajo (documento público depositado ante el CFCRL) y de apoyo técnico personal para el trabajador conforme a los artículos 6º y 7º de la Constitución Política de los Estados Unidos Mexicanos y el artículo 358 de la Ley Federal del Trabajo.
        </div>
        <p>
          En cumplimiento con la <strong>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</strong> y su Reglamento, el responsable del tratamiento de tus datos personales es <strong>{OWNER_NAME}</strong>, con domicilio para oír y recibir notificaciones en materia de privacidad en Morelia, Michoacán, México, y correo electrónico de contacto{" "}
          <a href={CONTACT_MAILTO} style={link}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2 style={h2}>2. Qué información usamos y finalidad EXACTA de cada dato</h2>
        <p>
          Aplicamos el principio de licitud y minimización de datos. A continuación te explicamos con absoluta transparencia para qué se utiliza cada dato específico:
        </p>
        <ul style={list}>
          <li>
            <strong>Nombre completo:</strong> Se utiliza exclusivamente para la titularidad de tu cuenta de acceso y para suscribir y personalizar los borradores de escritos formales, solicitudes y oficios de gestión que tú decidas generar para tus trámites.
          </li>
          <li>
            <strong>Matrícula IMSS:</strong> Se utiliza exclusivamente para membretar y autocompletar tus escritos, solicitudes y peticiones laborales generadas en la app, evitando que tengas que capturarla manualmente cada vez. No se utiliza para rastreo ni se comparte con directivas sindicales ni jefaturas patronales.
          </li>
          <li>
            <strong>Adscripción:</strong> Se utiliza exclusivamente para indicar tu centro de trabajo (unidad médica, hospital o área administrativa) en los encabezados de tus solicitudes.
          </li>
          <li>
            <strong>Antigüedad y fecha de ingreso:</strong> Se utiliza exclusivamente para alimentar los algoritmos matemáticos que calculan tus derechos y prestaciones contractuales (días de vacaciones según la escala del CCT IMSS-SNTSS, prima vacacional, aguinaldo, fondo de ahorro y proyecciones de jubilación).
          </li>
          <li>
            <strong>Categoría sindical y jornada de trabajo:</strong> Se utiliza exclusivamente para ubicar tu salario base en el Tabulador del Contrato Colectivo de Trabajo y ejecutar los cálculos de nómina, tiempo extraordinario, conceptos variables y prestaciones.
          </li>
          <li>
            <strong>Tarjetón IMSS (Extracción 100% local en tu dispositivo):</strong> Los archivos PDF de tu tarjetón de pago se procesan en la memoria local de tu navegador. <strong>El archivo PDF original jamás se sube ni se almacena en nuestros servidores.</strong> El sistema descarta automáticamente <strong>RFC, CURP, NSS, cuentas bancarias/CLABE, códigos QR y sellos digitales</strong>, almacenando únicamente los importes de conceptos para tus calculadoras y una huella criptográfica (hash SHA-256) del folio fiscal para evitar duplicados.
          </li>
          <li>
            <strong>Cuenta de correo y contraseña:</strong> Se utiliza para autenticar tu acceso seguro a la plataforma vía Supabase Auth. Tu contraseña está cifrada criptográficamente y nadie puede leerla.
          </li>
          <li>
            <strong>Documentos personales escaneados:</strong> Los archivos que escaneas se guardan en el almacenamiento local de tu propio dispositivo. Solo se transfieren temporalmente de forma cifrada si tú decides usar la función de impresión QR en estación local.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>3. Garantía inquebrantable de privacidad y aislamiento (Nadie más puede ver tus datos)</h2>
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "var(--radius-sm)",
          padding: "0.875rem 1rem",
          margin: "0 0 1rem",
          fontSize: "0.875rem",
          color: "#166534",
          lineHeight: 1.5,
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <Lock size={15} style={{ color: "#166534", flexShrink: 0 }} />
            <strong>AISLAMIENTO TOTAL:</strong>
          </span>
          {" "}Tu información está protegida con políticas de seguridad por fila (Row Level Security - RLS) en la base de datos. <strong>Nadie más puede ver tus datos más que tú mismo con tu usuario y contraseña.</strong>
          <br /><br />
          Ni delegados sindicales, ni directivos de la Sección XX, ni integrantes del Comité Ejecutivo Nacional del SNTSS, ni jefes de personal o directivos del IMSS, ni otros usuarios tienen acceso a ver tu perfil, tus tarjetones, tus cálculos o tus escritos.
        </div>
        <ul style={list}>
          <li><strong>Cero venta o cesión:</strong> Tus datos jamás se venden, no se comparten con terceros, no se rentan ni se transfieren a partidos políticos, planillas electorales, anunciantes ni empresas comerciales.</li>
          <li><strong>Uso restringido:</strong> Se usan única y exclusivamente para los fines personales descritos de cálculo laboral y redacción de escritos.</li>
          <li><strong>Control absoluto:</strong> Puedes editar tus datos cuando lo desees o eliminar tu cuenta y todos tus registros de forma instantánea e irreversible en cualquier momento.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>4. Datos que NO recopilamos ni almacenamos en servidor</h2>
        <ul style={list}>
          <li>No almacenamos en nuestros servidores tus archivos PDF originales del tarjetón de pago, ni tu RFC, CURP, NSS o números de cuenta bancaria extraídos de él.</li>
          <li>No usamos SDKs de publicidad ni rastreadores de analítica comercial de terceros.</li>
          <li>No vendemos, rentamos ni cedemos tus datos personales a anunciantes ni a terceros con fines comerciales.</li>
          <li>No leemos tu galería de fotos completa; la cámara solo se activa cuando tú la utilizas.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>5. Encargados que procesan datos en nuestro nombre</h2>
        <p>
          No realizamos transferencias de tus datos personales a terceros para fines distintos a los del servicio. Para operar técnicamente la plataforma nos apoyamos en los siguientes encargados bajo obligaciones de confidencialidad y seguridad (artículos 36 y 37 de la LFPDPPP):
        </p>
        <ul style={list}>
          <li><strong>Supabase (infraestructura en Oracle Cloud):</strong> autenticación, base de datos con aislamiento por fila (Row-Level Security) y almacenamiento privado cifrado.</li>
          <li><strong>Proveedores de inferencia de IA (OpenAI y DeepSeek):</strong> procesan exclusivamente el texto de tu consulta o solicitud de escrito y tu contexto laboral no sensible vía API empresarial para generar la respuesta en tiempo real, sin conservar ni utilizar tu información para entrenar modelos públicos.</li>
          <li><strong>Cloudflare Turnstile:</strong> verificación de seguridad anti-bots en los formularios de autenticación para proteger tu cuenta contra accesos automatizados.</li>
          <li><strong>Firebase Cloud Messaging (Google):</strong> procesa los tokens de dispositivo para la entrega de notificaciones push.</li>
          <li><strong>Portales externos (IMSS, SAT, SNTSS y otros):</strong> cuando accedes a ellos desde la app, interactúas directamente con el portal oficial y el tratamiento se rige por el aviso de privacidad de cada institución.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>6. Finalidades del tratamiento y retención</h2>
        <p>
          <strong>Finalidades primarias (necesarias para el servicio):</strong> autenticar tu sesión, calcular estimaciones laborales y vacacionales, brindarte orientación normativa con fuentes verificadas, redactar borradores de escritos a tu solicitud y gestionar los trámites y herramientas administrativas que utilices dentro de la plataforma.
        </p>
        <p>
          <strong>Finalidades secundarias:</strong> enviarte notificaciones informativas sobre avisos o recordatorios que tú configures; puedes desactivarlas en cualquier momento desde los ajustes de tu perfil o dispositivo. Conservamos tus datos únicamente mientras mantengas tu cuenta activa. Cuando eliminas tu cuenta, tus datos personales y laborales asociados a ella se suprimen de forma irreversible de nuestros servidores.
        </p>
      </section>

      <section>
        <h2 style={h2}>7. Medidas de seguridad</h2>
        <p>
          Protegemos tu información con medidas técnicas, administrativas y físicas: cifrado en tránsito (TLS/HTTPS con HSTS), políticas de aislamiento por fila (RLS) en base de datos, sanitización automática de identificadores sensibles en el navegador antes de transmitir datos, almacenamiento cifrado de credenciales en tu dispositivo (Android Keystore) y bloqueo biométrico opcional. La aplicación móvil impide el respaldo automático en la nube de terceros de tus documentos locales y credenciales. En caso de presentarse una vulneración de seguridad que afecte de forma significativa tus derechos patrimoniales o morales, te lo notificaremos de inmediato conforme al artículo 20 de la LFPDPPP.
        </p>
      </section>

      <section>
        <h2 style={h2}>8. Derechos ARCO, revocación y eliminación de cuenta</h2>
        <p>
          Tienes derecho en todo momento a <strong>Acceder, Rectificar, Cancelar u Oponerte (Derechos ARCO)</strong> al tratamiento de tus datos personales, así como a revocar tu consentimiento:
        </p>
        <ul style={list}>
          <li><strong>Eliminación inmediata y autónoma:</strong> puedes borrar definitivamente tu cuenta y todos tus datos desde <strong>Perfil → Privacidad y cuenta → Eliminar mi cuenta</strong> o directamente en <Link href="/eliminar-cuenta" style={link}>/eliminar-cuenta</Link>.</li>
          <li><strong>Solicitud formal ARCO:</strong> también puedes enviar una solicitud al correo <a href={CONTACT_MAILTO} style={link}>{CONTACT_EMAIL}</a> indicando tu nombre, el correo asociado a tu cuenta y la descripción clara del derecho que deseas ejercer. Responderemos tu solicitud en un plazo máximo de 20 días hábiles y, de resultar procedente, la haremos efectiva dentro de los 15 días hábiles siguientes conforme al artículo 32 de la LFPDPPP.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>9. Cambios al aviso y contacto</h2>
        <p>
          Cualquier modificación sustancial a esta Política de Privacidad se publicará en esta misma página indicando la fecha de última actualización. Para dudas sobre privacidad, protección de datos o ejercicio de derechos ARCO, contáctanos:
        </p>
        <p>
          Correo: <a href={CONTACT_MAILTO} style={link}>{CONTACT_EMAIL}</a>
          {" · "}
          Teléfono: <a href={CONTACT_PHONE_HREF} style={link}>{CONTACT_PHONE_DISPLAY}</a>
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
          Consulta también nuestros <Link href="/terminos" style={link}>Términos de Uso</Link> y la página de{" "}
          <Link href="/soporte" style={link}>Soporte</Link>.
        </p>
      </section>
    </PublicPageShell>
  )
}

const h2: CSSProperties = { fontSize: "1.125rem", fontWeight: 700, margin: "1.5rem 0 0.5rem" }
const list: CSSProperties = { margin: "0 0 1rem", paddingLeft: "1.25rem", lineHeight: 1.6, fontSize: "0.9375rem" }
const link: CSSProperties = { color: "var(--primary)", textDecoration: "none" }

