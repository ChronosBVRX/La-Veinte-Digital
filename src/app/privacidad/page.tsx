import Link from "next/link"
import type { CSSProperties } from "react"
import { PublicPageShell } from "@/shared/components/public/PublicPageShell"
import { OWNER_NAME, CONTACT_EMAIL, CONTACT_MAILTO, CONTACT_PHONE_DISPLAY, CONTACT_PHONE_HREF } from "@/shared/lib/contact"

export const metadata = {
  title: "Política de Privacidad | La Veinte Digital",
  description: "Cómo La Veinte Digital recopila, usa y protege tu información conforme a la LFPDPPP.",
}

export default function PrivacyPage() {
  return (
    <PublicPageShell title="Política de Privacidad" intro="Última actualización: 2026-10-12">
      <section>
        <h2 style={h2}>1. Quiénes somos y Responsable del Tratamiento</h2>
        <p>
          La Veinte Digital es una plataforma digital independiente de la comunidad SNTSS.{" "}
          <strong>No es una aplicación oficial del IMSS ni de ninguna institución de gobierno.</strong>{" "}
          Solo proporciona herramientas informativas y de acceso a portales públicos y oficiales.
        </p>
        <p>
          En cumplimiento con la <strong>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</strong> y su Reglamento, el responsable del tratamiento de tus datos personales es <strong>{OWNER_NAME}</strong>, con domicilio para oír y recibir notificaciones en materia de privacidad en Morelia, Michoacán, México, y correo electrónico de contacto{" "}
          <a href={CONTACT_MAILTO} style={link}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h2 style={h2}>2. Qué información usamos y minimización de datos</h2>
        <p>Aplicamos el principio de minimización y usamos únicamente los datos estrictamente necesarios para que la plataforma funcione:</p>
        <ul style={list}>
          <li><strong>Cuenta:</strong> correo electrónico y contraseña cifrada para iniciar sesión (gestionados por Supabase Auth).</li>
          <li><strong>Perfil laboral:</strong> nombre, matrícula/adscripción, categoría, antigüedad y jornada que tú ingresas o confirmas.</li>
          <li><strong>Tarjetones y nómina (extracción 100% local):</strong> los PDFs de tu tarjetón IMSS y recibos de pago se leen y procesan exclusivamente en tu propio dispositivo; el archivo PDF original jamás se sube a nuestros servidores. Antes de guardar tu contexto laboral, el sistema descarta automáticamente <strong>RFC, CURP, NSS, cuenta bancaria/CLABE, código QR, sello digital y cadena original</strong>, almacenando únicamente conceptos laborales necesarios para tus calculadoras y una huella criptográfica (hash SHA-256) del folio fiscal.</li>
          <li><strong>Documentos personales:</strong> los archivos que escaneas o guardas se almacenan de forma local en tu dispositivo; solo viajan de forma temporal y cifrada cuando tú utilizas expresamente el flujo de transferencia o impresión por código QR.</li>
          <li><strong>Cámara:</strong> se usa únicamente en tu dispositivo para escanear documentos o leer códigos QR bajo tu acción directa.</li>
          <li><strong>Notificaciones:</strong> un identificador técnico de tu dispositivo (token de Firebase Cloud Messaging) para enviarte avisos y recordatorios de tu agenda laboral.</li>
          <li><strong>Asistente y escritos con IA:</strong> las preguntas y notas que escribes para generar orientación normativa o borradores de escritos se procesan junto con datos básicos no sensibles de tu perfil laboral (categoría, jornada, antigüedad y adscripción; nunca RFC, CURP, NSS ni cuentas bancarias) para personalizar la respuesta. Las respuestas son orientativas y debes verificarlas con las fuentes oficiales (ver <Link href="/informacion-y-fuentes" style={link}>Información y fuentes</Link>).</li>
          <li><strong>Reportes de contenido generado:</strong> si reportas una respuesta, guardamos en tu dispositivo la categoría, el identificador de la respuesta, la fecha y una vista previa redactada automáticamente (sin NSS, CURP, correos ni teléfonos).</li>
          <li><strong>Credenciales IMSS:</strong> cuando decides usar los portales externos desde la app, las credenciales que escribes se guardan <em>cifradas</em> únicamente en tu dispositivo (Android Keystore) y nunca se envían a los servidores de La Veinte Digital.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>3. Datos que NO recopilamos ni almacenamos en servidor</h2>
        <ul style={list}>
          <li>No almacenamos en nuestros servidores tus archivos PDF originales del tarjetón de pago, ni tu RFC, CURP, NSS o números de cuenta bancaria extraídos de él.</li>
          <li>No usamos SDKs de publicidad ni rastreadores de analítica comercial de terceros.</li>
          <li>No vendemos, rentamos ni cedemos tus datos personales a anunciantes ni a terceros con fines comerciales.</li>
          <li>No leemos tu galería de fotos completa; la cámara solo se activa cuando tú la utilizas.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>4. Encargados que procesan datos en nuestro nombre</h2>
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
        <h2 style={h2}>5. Finalidades del tratamiento y retención</h2>
        <p>
          <strong>Finalidades primarias (necesarias para el servicio):</strong> autenticar tu sesión, calcular estimaciones laborales y vacacionales, brindarte orientación normativa con fuentes verificadas, redactar borradores de escritos a tu solicitud y gestionar los trámites y herramientas administrativas que utilices dentro de la plataforma.
        </p>
        <p>
          <strong>Finalidades secundarias:</strong> enviarte notificaciones informativas sobre avisos o recordatorios que tú configures; puedes desactivarlas en cualquier momento desde los ajustes de tu perfil o dispositivo. Conservamos tus datos únicamente mientras mantengas tu cuenta activa. Cuando eliminas tu cuenta, tus datos personales y laborales asociados a ella se suprimen de forma irreversible de nuestros servidores.
        </p>
      </section>

      <section>
        <h2 style={h2}>6. Medidas de seguridad</h2>
        <p>
          Protegemos tu información con medidas técnicas, administrativas y físicas: cifrado en tránsito (TLS/HTTPS con HSTS), políticas de aislamiento por fila (RLS) en base de datos, sanitización automática de identificadores sensibles en el navegador antes de transmitir datos, almacenamiento cifrado de credenciales en tu dispositivo (Android Keystore) y bloqueo biométrico opcional. La aplicación móvil impide el respaldo automático en la nube de terceros de tus documentos locales y credenciales. En caso de presentarse una vulneración de seguridad que afecte de forma significativa tus derechos patrimoniales o morales, te lo notificaremos de inmediato conforme al artículo 20 de la LFPDPPP.
        </p>
      </section>

      <section>
        <h2 style={h2}>7. Derechos ARCO, revocación y eliminación de cuenta</h2>
        <p>
          Tienes derecho en todo momento a <strong>Acceder, Rectificar, Cancelar u Oponerte (Derechos ARCO)</strong> al tratamiento de tus datos personales, así como a revocar tu consentimiento:
        </p>
        <ul style={list}>
          <li><strong>Eliminación inmediata y autónoma:</strong> puedes borrar definitivamente tu cuenta y todos tus datos desde <strong>Perfil → Privacidad y cuenta → Eliminar mi cuenta</strong> o directamente en <Link href="/eliminar-cuenta" style={link}>/eliminar-cuenta</Link>.</li>
          <li><strong>Solicitud formal ARCO:</strong> también puedes enviar una solicitud al correo <a href={CONTACT_MAILTO} style={link}>{CONTACT_EMAIL}</a> indicando tu nombre, el correo asociado a tu cuenta y la descripción clara del derecho que deseas ejercer. Responderemos tu solicitud en un plazo máximo de 20 días hábiles y, de resultar procedente, la haremos efectiva dentro de los 15 días hábiles siguientes conforme al artículo 32 de la LFPDPPP.</li>
        </ul>
      </section>

      <section>
        <h2 style={h2}>8. Cambios al aviso y contacto</h2>
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

