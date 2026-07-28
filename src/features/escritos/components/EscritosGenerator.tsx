"use client"

import { useState } from "react"
import { consultarBot } from "@/features/asistente/services/bot"
import { EscritosForm } from "./EscritosForm"
import { EscritosResult } from "./EscritosResult"

export function EscritosGenerator() {
  const [form, setForm] = useState({ tipo: "", nombre: "", matricula: "", adscripcion: "", categoria: "", detalle: "" })
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState("")
  const [error, setError] = useState("")

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

  const limpiar = () => {
    setForm({ tipo: "", nombre: "", matricula: "", adscripcion: "", categoria: "", detalle: "" })
    setResultado("")
    setError("")
  }

  const generar = async () => {
    if (!form.tipo || !form.detalle.trim()) return

    setLoading(true)
    setError("")
    setResultado("")

    const tipoLabel = form.tipo === "solicitud_vacaciones" ? "Solicitud de Vacaciones"
      : form.tipo === "solicitud_permiso" ? "Solicitud de Permiso"
      : form.tipo === "queja_despido" ? "Queja por Despido Injustificado"
      : form.tipo === "solicitud_incapacidad" ? "Solicitud por Incapacidad"
      : form.tipo === "reclamacion_prestaciones" ? "Reclamación de Prestaciones"
      : form.tipo === "solicitud_aumento" ? "Solicitud de Aumento Salarial"
      : form.tipo === "queja_acoso" ? "Queja por Acoso Laboral"
      : form.tipo === "solicitud_cambio" ? "Solicitud de Cambio de Adscripción"
      : form.tipo

    const prompt = `Genera un escrito formal de tipo "${tipoLabel}" con los siguientes datos del trabajador:
- Nombre: ${form.nombre || "[Nombre del trabajador]"}
- Matrícula: ${form.matricula || "[Matrícula]"}
- Adscripción: ${form.adscripcion || "[Adscripción]"}
- Categoría: ${form.categoria || "[Categoría]"}

Detalle del caso:
${form.detalle}

El escrito debe:
1. Estar dirigido a la autoridad competente
2. Incluir fundamentos legales basados en el Contrato Colectivo de Trabajo y Estatutos del SNTSS
3. Usar un tono formal y profesional
4. Incluir fecha, lugar, datos del trabajador y firma
5. Estar estructurado con: encabezado, exposición de hechos, fundamentos legales, puntos petitorios y cierre`

    try {
      const respuesta = await consultarBot([{ role: "user", content: prompt }])
      setResultado(respuesta)
    } catch {
      setError("Error al generar el escrito. Verifica que el bot esté funcionando.")
    } finally {
      setLoading(false)
    }
  }

  const copiarPortapapeles = async () => {
    try { await navigator.clipboard.writeText(resultado) } catch { }
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Generar Escritos</h1>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0.25rem 0 0 0" }}>
          Crea documentos formales con apoyo de IA basados en el CCT y Estatutos del SNTSS
        </p>
      </div>

      <EscritosForm
        {...form}
        loading={loading}
        onChange={updateField}
        onGenerate={generar}
        onClear={limpiar}
      />

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

      {resultado && !loading && <EscritosResult resultado={resultado} onCopy={copiarPortapapeles} />}
    </div>
  )
}
