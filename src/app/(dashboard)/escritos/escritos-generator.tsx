"use client"

import { useState } from "react"
import { consultarBot } from "@/lib/services/bot"

const TIPOS_ESCRITO = [
  { value: "solicitud_vacaciones", label: "Solicitud de Vacaciones" },
  { value: "solicitud_permiso", label: "Solicitud de Permiso" },
  { value: "queja_despido", label: "Queja por Despido Injustificado" },
  { value: "solicitud_incapacidad", label: "Solicitud por Incapacidad" },
  { value: "reclamacion_prestaciones", label: "Reclamación de Prestaciones" },
  { value: "solicitud_aumento", label: "Solicitud de Aumento Salarial" },
  { value: "queja_acoso", label: "Queja por Acoso Laboral" },
  { value: "solicitud_cambio", label: "Solicitud de Cambio de Adscripción" },
  { value: "otros", label: "Otro (especificar)" },
]

export function EscritosGenerator() {
  const [tipo, setTipo] = useState("")
  const [nombre, setNombre] = useState("")
  const [matricula, setMatricula] = useState("")
  const [adscripcion, setAdscripcion] = useState("")
  const [categoria, setCategoria] = useState("")
  const [detalle, setDetalle] = useState("")
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState("")
  const [error, setError] = useState("")

  const limpiar = () => {
    setTipo("")
    setNombre("")
    setMatricula("")
    setAdscripcion("")
    setCategoria("")
    setDetalle("")
    setResultado("")
    setError("")
  }

  const generar = async () => {
    if (!tipo || !detalle.trim()) return

    setLoading(true)
    setError("")
    setResultado("")

    const tipoLabel = TIPOS_ESCRITO.find((t) => t.value === tipo)?.label ?? tipo

    const prompt = `Genera un escrito formal de tipo "${tipoLabel}" con los siguientes datos del trabajador:
- Nombre: ${nombre || "[Nombre del trabajador]"}
- Matrícula: ${matricula || "[Matrícula]"}
- Adscripción: ${adscripcion || "[Adscripción]"}
- Categoría: ${categoria || "[Categoría]"}

Detalle del caso:
${detalle}

El escrito debe:
1. Estar dirigido a la autoridad competente
2. Incluir fundamentos legales basados en el Contrato Colectivo de Trabajo y Estatutos del SNTSS
3. Usar un tono formal y profesional
4. Incluir fecha, lugar, datos del trabajador y firma
5. Estar estructurado con: encabezado, exposición de hechos, fundamentos legales, puntos petitorios y cierre`

    try {
      const history = [
        { role: "user" as const, content: prompt },
      ]
      const respuesta = await consultarBot(history)
      setResultado(respuesta)
    } catch {
      setError("Error al generar el escrito. Verifica que el bot esté funcionando.")
    } finally {
      setLoading(false)
    }
  }

  const copiarPortapapeles = async () => {
    try {
      await navigator.clipboard.writeText(resultado)
    } catch {
      // Fallback
    }
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Generar Escritos</h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
          Crea documentos formales con apoyo de IA basados en el CCT y Estatutos del SNTSS
        </p>
      </div>

      <div style={{
        background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem",
        padding: "1.5rem", marginBottom: "1.5rem",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              Tipo de escrito
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              style={{
                width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
                borderRadius: "0.375rem", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
              }}
            >
              <option value="">Seleccionar tipo...</option>
              {TIPOS_ESCRITO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              Nombre completo
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del trabajador"
              style={{
                width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
                borderRadius: "0.375rem", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              Matrícula
            </label>
            <input
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              placeholder="Número de matrícula"
              style={{
                width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
                borderRadius: "0.375rem", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              Adscripción
            </label>
            <input
              value={adscripcion}
              onChange={(e) => setAdscripcion(e.target.value)}
              placeholder="Hospital / Unidad / Departamento"
              style={{
                width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
                borderRadius: "0.375rem", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
              Categoría
            </label>
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Puesto / Categoría"
              style={{
                width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
                borderRadius: "0.375rem", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.25rem" }}>
            Descripción detallada del caso
          </label>
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Describe a detalle los hechos, fechas, y todo lo relevante para generar el escrito..."
            rows={6}
            style={{
              width: "100%", padding: "0.5rem 0.75rem", border: "1px solid var(--border)",
              borderRadius: "0.375rem", background: "var(--bg)", color: "var(--fg)", fontSize: "0.875rem",
              resize: "vertical", fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={generar}
            disabled={loading || !tipo || !detalle.trim()}
            style={{
              padding: "0.5rem 1.25rem", background: "var(--primary)", color: "var(--primary-fg)",
              border: "none", borderRadius: "0.375rem", fontWeight: 600, fontSize: "0.875rem",
              cursor: loading || !tipo || !detalle.trim() ? "not-allowed" : "pointer",
              opacity: loading || !tipo || !detalle.trim() ? 0.6 : 1,
            }}
          >
            {loading ? "Generando..." : "Generar Escrito"}
          </button>
          <button
            onClick={limpiar}
            disabled={loading}
            style={{
              padding: "0.5rem 1.25rem", background: "transparent", color: "var(--fg)",
              border: "1px solid var(--border)", borderRadius: "0.375rem", fontWeight: 500, fontSize: "0.875rem",
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      {loading && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem",
          padding: "2rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem",
        }}>
          Generando escrito... Esto puede tomar unos segundos.
        </div>
      )}

      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "0.5rem",
          padding: "1rem", color: "#991b1b", fontSize: "0.875rem", marginBottom: "1rem",
        }}>
          {error}
        </div>
      )}

      {resultado && !loading && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem",
          padding: "1.5rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Escrito Generado</h2>
            <button
              onClick={copiarPortapapeles}
              style={{
                padding: "0.375rem 0.75rem", background: "var(--accent)", color: "var(--fg)",
                border: "1px solid var(--border)", borderRadius: "0.375rem", fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Copiar
            </button>
          </div>
          <div
            style={{
              whiteSpace: "pre-wrap", fontSize: "0.875rem", lineHeight: 1.7,
              fontFamily: "'Georgia', 'Times New Roman', serif",
              padding: "1.5rem", background: "var(--bg)", borderRadius: "0.375rem",
              border: "1px solid var(--border)",
            }}
          >
            {resultado}
          </div>
        </div>
      )}
    </div>
  )
}
