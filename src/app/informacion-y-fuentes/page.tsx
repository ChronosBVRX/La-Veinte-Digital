import { PublicPageShell } from "@/shared/components/public/PublicPageShell"
import {
  EXTERNAL_PORTAL_NOTICE,
  GOVERNMENT_SOURCES,
  INDEPENDENCE_NOTICE_INFO,
  INDEPENDENCE_NOTICE_SHORT,
  SOURCES_LAST_UPDATED,
  type SourceCategory,
} from "@/shared/lib/government-sources"

export const metadata = {
  title: "Información y fuentes | La Veinte Digital",
  description:
    "Aviso de independencia y enlaces a las fuentes oficiales utilizadas por La Veinte Digital.",
}

const CATEGORY_TITLES: { key: SourceCategory; title: string }[] = [
  { key: "gubernamental", title: "2. Fuentes gubernamentales" },
  { key: "legislativa", title: "3. Legislación federal" },
  { key: "institucional-imss", title: "4. Fuentes institucionales del IMSS" },
  { key: "laboral-cct", title: "5. Contrato Colectivo y fuentes laborales" },
  { key: "sindical", title: "6. Fuentes sindicales" },
]

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — Abre un sitio externo`}
      style={{
        color: "var(--primary)",
        textDecoration: "underline",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      }}
    >
      {href} (sitio externo)
    </a>
  )
}

export default function InformacionYFuentesPage() {
  return (
    <PublicPageShell
      title="Información y fuentes"
      intro="Procedencia de la información laboral y normativa de La Veinte Digital."
    >
      <section aria-labelledby="aviso-independencia">
        <h2 id="aviso-independencia" style={h2}>
          1. Aviso de independencia
        </h2>
        <div style={notice}>
          <p style={{ margin: 0, fontWeight: 700 }}>Aplicación independiente</p>
          <p style={{ margin: "0.5rem 0 0" }}>{INDEPENDENCE_NOTICE_SHORT}</p>
          <p style={{ margin: "0.5rem 0 0" }}>{INDEPENDENCE_NOTICE_INFO}</p>
          <p style={{ margin: "0.5rem 0 0" }}>{EXTERNAL_PORTAL_NOTICE}</p>
        </div>
      </section>

      {CATEGORY_TITLES.map(({ key, title }) => {
        const items = GOVERNMENT_SOURCES.filter((s) => s.categoria === key)
        if (items.length === 0) return null
        return (
          <section key={key} aria-label={title}>
            <h2 style={h2}>{title}</h2>
            <ul style={list}>
              {items.map((s) => (
                <li key={s.id} style={{ marginBottom: "0.875rem" }}>
                  <strong>{s.titulo}</strong>
                  <br />
                  <span style={muted}>
                    Emisor: {s.emisor} · {s.documento} · Vigencia: {s.vigencia} ·
                    Verificado: {s.ultimaVerificacion}
                  </span>
                  <br />
                  <ExternalLink href={s.url} label={s.titulo} />
                </li>
              ))}
            </ul>
            {key === "sindical" && (
              <p style={muted}>
                Los documentos sindicales se identifican por su emisor y no se presentan como
                fuentes gubernamentales.
              </p>
            )}
          </section>
        )
      })}

      <section aria-labelledby="como-se-usa">
        <h2 id="como-se-usa" style={h2}>
          7. Cómo se utiliza la información
        </h2>
        <p>
          La Veinte Digital organiza información pública y tus propios datos laborales para
          orientarte. Cada herramienta indica su fuente; la explicación en lenguaje claro es
          contenido editorial propio y se distingue de la cita oficial.
        </p>
      </section>

      <section aria-labelledby="limitaciones">
        <h2 id="limitaciones" style={h2}>
          8. Limitaciones de cálculos y respuestas de IA
        </h2>
        <p>
          Los resultados de calculadoras y las respuestas del asistente son estimaciones
          orientativas. Verifica siempre con la documentación vigente y, cuando corresponda, con
          las áreas competentes. Los escritos generados con IA deben revisarse antes de
          presentarse. La IA nunca emite resoluciones oficiales.
        </p>
      </section>

      <section aria-labelledby="actualizacion">
        <h2 id="actualizacion" style={h2}>
          9. Fecha de última actualización
        </h2>
        <p>{SOURCES_LAST_UPDATED}</p>
      </section>

      <section aria-labelledby="enlaces">
        <h2 id="enlaces" style={h2}>
          10. Privacidad, términos, contacto y eliminación de cuenta
        </h2>
        <ul style={list}>
          <li>
            <a href="/privacidad" style={link}>
              Política de Privacidad
            </a>
          </li>
          <li>
            <a href="/terminos" style={link}>
              Términos de Uso
            </a>
          </li>
          <li>
            <a href="/soporte" style={link}>
              Soporte y contacto
            </a>
          </li>
          <li>
            <a href="/eliminar-cuenta" style={link}>
              Solicitar eliminación de cuenta
            </a>
          </li>
          <li>
            <a href="/acerca-de" style={link}>
              Acerca de
            </a>
          </li>
        </ul>
      </section>
    </PublicPageShell>
  )
}

import type { CSSProperties } from "react"

const h2: CSSProperties = { fontSize: "1.125rem", fontWeight: 700, margin: "1.5rem 0 0.5rem" }
const list: CSSProperties = { margin: "0 0 1rem", paddingLeft: "1.25rem", lineHeight: 1.6, fontSize: "0.9375rem" }
const link: CSSProperties = { color: "var(--primary)", textDecoration: "underline" }
const muted: CSSProperties = { color: "var(--muted)", fontSize: "0.85rem" }
const notice: CSSProperties = {
  background: "#fffbeb",
  border: "1px solid #fde68a",
  borderRadius: "var(--radius)",
  padding: "1rem 1.25rem",
  margin: "0.5rem 0 1rem",
  fontSize: "0.9375rem",
  lineHeight: 1.6,
}
