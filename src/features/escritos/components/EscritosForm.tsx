"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/Button"
import { Input, Textarea } from "@/shared/components/ui/Input"
import { Card } from "@/shared/components/ui/Card"
import {
  TIPOS_ESCRITO,
  type TipoEscritoKey,
  type EscritoDraftV2,
  type DestinatarioItem,
  type AnexoItem,
} from "@/shared/contracts/escrito-draft"
import { saveBlobResource, deleteBlobResource } from "../services/escritos-indexeddb"

export interface EscritosFormProps {
  userId: string
  draft: EscritoDraftV2
  onUpdateDraft: (updated: Partial<EscritoDraftV2>) => void
  onGenerate: () => void
  isGenerating: boolean
  workerProfile?: {
    nombre?: string
    matricula?: string
    categoria?: string
    adscripcion?: string
    seccion?: string
  }
}

const DESTINATARIOS_PREDEFINIDOS = [
  { cargo: "Secretario General", nombre: "Comité Ejecutivo Seccional - Sección XX Michoacán SNTSS" },
  { cargo: "Secretario del Interior y Propaganda", nombre: "Comité Ejecutivo Seccional - Sección XX SNTSS" },
  { cargo: "Secretario de Conflictos", nombre: "Comité Ejecutivo Seccional - Sección XX SNTSS" },
  { cargo: "Secretario de Trabajo", nombre: "Comité Ejecutivo Seccional - Sección XX SNTSS" },
  { cargo: "Representante Sindical Delegacional", nombre: "Delegación Sindical correspondiente" },
  { cargo: "Director de Unidad Médica / Hospital", nombre: "Dirección de Unidad Médica IMSS" },
  { cargo: "Jefe de Personal / Recursos Humanos", nombre: "Departamento de Personal IMSS" },
  { cargo: "Jefatura de Servicio / Enfermería", nombre: "Jefatura de Servicio IMSS" },
  { cargo: "Otro / Personalizado", nombre: "" },
]

export function EscritosForm({
  userId,
  draft,
  onUpdateDraft,
  onGenerate,
  isGenerating,
  workerProfile,
}: EscritosFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [destinatarioMode, setDestinatarioMode] = useState<"preset" | "manual">(() => {
    const isKnown = DESTINATARIOS_PREDEFINIDOS.some(
      (d) => d.cargo === draft.destino.cargo && d.nombre === draft.destino.nombre
    )
    return isKnown ? "preset" : "manual"
  })
  const [anexoUploading, setAnexoUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const currentTipoDef = TIPOS_ESCRITO[draft.tipo] || TIPOS_ESCRITO.solicitud

  const handleTipoSelect = (tipo: TipoEscritoKey) => {
    onUpdateDraft({
      tipo,
      asunto: draft.asunto || `${TIPOS_ESCRITO[tipo].titulo}: Solicitud formal`,
    })
  }

  const handleDestinatarioSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === "Otro / Personalizado") {
      setDestinatarioMode("manual")
      onUpdateDraft({ destino: { cargo: "", nombre: "" } })
    } else {
      setDestinatarioMode("preset")
      const found = DESTINATARIOS_PREDEFINIDOS.find((d) => d.cargo === val)
      if (found) {
        onUpdateDraft({ destino: { cargo: found.cargo, nombre: found.nombre } })
      }
    }
  }

  // Manejo de atenciones múltiples
  const addAtencion = () => {
    const nuevo: DestinatarioItem = {
      id: `at_${Math.random().toString(36).slice(2, 7)}`,
      cargo: "",
      nombre: "",
    }
    onUpdateDraft({ atencion: [...draft.atencion, nuevo] })
  }

  const updateAtencion = (index: number, field: "cargo" | "nombre", value: string) => {
    const updated = [...draft.atencion]
    if (updated[index]) {
      updated[index] = { ...updated[index], [field]: value }
      onUpdateDraft({ atencion: updated })
    }
  }

  const moveAtencion = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= draft.atencion.length) return
    const updated = [...draft.atencion]
    const item = updated[index]
    if (!item) return
    updated.splice(index, 1)
    updated.splice(targetIndex, 0, item)
    onUpdateDraft({ atencion: updated })
  }

  const removeAtencion = (index: number) => {
    const updated = draft.atencion.filter((_, i) => i !== index)
    onUpdateDraft({ atencion: updated })
  }

  // Manejo de copias múltiples (c.c.p.)
  const addCopia = () => {
    const nuevo: DestinatarioItem = {
      id: `cp_${Math.random().toString(36).slice(2, 7)}`,
      cargo: "",
      nombre: "",
    }
    onUpdateDraft({ copias: [...draft.copias, nuevo] })
  }

  const updateCopia = (index: number, field: "cargo" | "nombre", value: string) => {
    const updated = [...draft.copias]
    if (updated[index]) {
      updated[index] = { ...updated[index], [field]: value }
      onUpdateDraft({ copias: updated })
    }
  }

  const moveCopia = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= draft.copias.length) return
    const updated = [...draft.copias]
    const item = updated[index]
    if (!item) return
    updated.splice(index, 1)
    updated.splice(targetIndex, 0, item)
    onUpdateDraft({ copias: updated })
  }

  const removeCopia = (index: number) => {
    const updated = draft.copias.filter((_, i) => i !== index)
    onUpdateDraft({ copias: updated })
  }

  // Manejo de imágenes adjuntas directo a IndexedDB
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setAnexoUploading(true)
    setErrorMsg(null)

    try {
      const newAnexos: AnexoItem[] = [...draft.anexos]

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith("image/")) {
          setErrorMsg("Solo se admiten archivos de imagen (JPG, PNG, WebP).")
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          setErrorMsg("Cada imagen no debe exceder los 10MB.")
          continue
        }

        const anexoId = `anx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const storageRef = await saveBlobResource(
          userId,
          draft.id,
          "anexo",
          anexoId,
          file
        )

        const previewUrl = URL.createObjectURL(file)

        newAnexos.push({
          id: anexoId,
          nombre: file.name.replace(/\.[^/.]+$/, ""),
          descripcion: "",
          tipo: file.type,
          size: file.size,
          storageRef,
          previewUrl,
        })
      }

      onUpdateDraft({ anexos: newAnexos })
    } catch (err) {
      console.error("Error guardando anexo en IndexedDB:", err)
      setErrorMsg("Error al procesar la imagen adjunta.")
    } finally {
      setAnexoUploading(false)
      if (e.target) e.target.value = ""
    }
  }

  const removeAnexo = async (index: number) => {
    const anexo = draft.anexos[index]
    if (anexo) {
      if (anexo.storageRef) {
        await deleteBlobResource(userId, anexo.storageRef).catch(() => {})
      }
      if (anexo.previewUrl && anexo.previewUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(anexo.previewUrl)
        } catch {
          // noop
        }
      }
    }
    const updated = draft.anexos.filter((_, i) => i !== index)
    onUpdateDraft({ anexos: updated })
  }

  const updateAnexoDescripcion = (index: number, descripcion: string) => {
    const updated = [...draft.anexos]
    if (updated[index]) {
      updated[index] = { ...updated[index], descripcion }
      onUpdateDraft({ anexos: updated })
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!draft.destino.cargo.trim() && !draft.destino.nombre.trim()) {
      setErrorMsg("Por favor especifica a quién va dirigido el escrito (cargo o nombre).")
      return
    }

    if (!draft.hechos.trim()) {
      setErrorMsg("Por favor describe lo que ocurrió o los antecedentes del caso.")
      return
    }

    if (!draft.peticion.trim()) {
      setErrorMsg("Por favor escribe con claridad lo que solicitas en tu escrito.")
      return
    }

    onGenerate()
  }

  return (
    <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Banner de perfil del trabajador */}
      {workerProfile?.nombre && (
        <div
          style={{
            background: "var(--accent)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "0.875rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.25rem" }}>👤</span>
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
                {workerProfile.nombre}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {workerProfile.categoria || "Trabajador IMSS"} {workerProfile.matricula ? `• Matrícula: ${workerProfile.matricula}` : ""}
              </div>
            </div>
          </div>
          <span style={{ fontSize: "0.75rem", background: "var(--card)", padding: "0.25rem 0.5rem", borderRadius: "0.375rem", border: "1px solid var(--border)", color: "var(--muted)" }}>
            {workerProfile.seccion || "Sección XX Michoacán"}
          </span>
        </div>
      )}

      {/* Pregunta 1: Tipo de Escrito */}
      <div>
        <label style={{ display: "block", fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.75rem" }}>
          1. ¿Qué tipo de escrito necesitas redactar?
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
          {(Object.keys(TIPOS_ESCRITO) as TipoEscritoKey[]).map((key) => {
            const def = TIPOS_ESCRITO[key]
            const isSelected = draft.tipo === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTipoSelect(key)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "1rem 0.75rem",
                  borderRadius: "0.75rem",
                  border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: isSelected ? "var(--accent)" : "var(--card)",
                  color: isSelected ? "var(--primary)" : "var(--fg)",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: "1.75rem", marginBottom: "0.375rem" }}>{def.icono}</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{def.titulo}</span>
              </button>
            )
          })}
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
          {currentTipoDef.subtitulo}
        </p>
      </div>

      {/* Pregunta 2: Destinatario */}
      <div>
        <label style={{ display: "block", fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.5rem" }}>
          2. ¿A quién va dirigido el escrito?
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <select
            value={destinatarioMode === "preset" ? draft.destino.cargo : "Otro / Personalizado"}
            onChange={handleDestinatarioSelect}
            style={{
              padding: "0.625rem 0.875rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--fg)",
              fontSize: "0.875rem",
              width: "100%",
            }}
          >
            {DESTINATARIOS_PREDEFINIDOS.map((d) => (
              <option key={d.cargo} value={d.cargo}>
                {d.cargo} {d.nombre ? `(${d.nombre})` : ""}
              </option>
            ))}
          </select>

          {destinatarioMode === "manual" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <Input
                label="Nombre del destinatario"
                placeholder="Ej. Dr. Juan Pérez"
                value={draft.destino.nombre}
                onChange={(e) => onUpdateDraft({ destino: { ...draft.destino, nombre: e.target.value } })}
              />
              <Input
                label="Cargo institucional o sindical"
                placeholder="Ej. Director HGZ No. 1"
                value={draft.destino.cargo}
                onChange={(e) => onUpdateDraft({ destino: { ...draft.destino, cargo: e.target.value } })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Pregunta 3: Hechos */}
      <div>
        <label style={{ display: "block", fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.375rem" }}>
          3. ¿Qué hechos o antecedentes ocurrieron?
        </label>
        <Textarea
          placeholder={currentTipoDef.placeholderHechos}
          value={draft.hechos}
          onChange={(e) => onUpdateDraft({ hechos: e.target.value })}
          rows={4}
        />
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--muted)" }}>
          Escríbelo con tus propias palabras; el asistente se encargará de darle estructura formal.
        </p>
      </div>

      {/* Pregunta 4: Petición */}
      <div>
        <label style={{ display: "block", fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.375rem" }}>
          4. ¿Qué solicitas concretamente?
        </label>
        <Textarea
          placeholder={currentTipoDef.placeholderPeticion}
          value={draft.peticion}
          onChange={(e) => onUpdateDraft({ peticion: e.target.value })}
          rows={3}
        />
      </div>

      {/* Pregunta 5: Adjuntar imágenes */}
      <div>
        <label style={{ display: "block", fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.375rem" }}>
          5. Adjuntar imágenes (fotografías, credencial, comprobantes)
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div
            style={{
              border: "1.5px dashed var(--border)",
              borderRadius: "0.75rem",
              padding: "1rem",
              textAlign: "center",
              background: "var(--card)",
            }}
          >
            <input
              type="file"
              id="escrito-images-input"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageUpload}
              style={{ display: "none" }}
              disabled={anexoUploading}
            />
            <label
              htmlFor="escrito-images-input"
              style={{
                display: "inline-block",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "var(--primary)",
                fontWeight: 600,
              }}
            >
              {anexoUploading ? "Procesando imágenes..." : "📷 Seleccionar imágenes desde el dispositivo"}
            </label>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
              Formatos soportados: JPG, PNG, WebP (máx. 10MB por imagen).
            </div>
          </div>

          {/* Lista de anexos adjuntos */}
          {draft.anexos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {draft.anexos.map((anexo, idx) => (
                <Card key={anexo.id} padding="0.75rem" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {anexo.previewUrl ? (
                    <img
                      src={anexo.previewUrl}
                      alt={anexo.nombre}
                      style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "0.375rem", border: "1px solid var(--border)" }}
                    />
                  ) : (
                    <div style={{ width: "48px", height: "48px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0.375rem" }}>
                      📷
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>
                      Anexo {idx + 1}: {anexo.nombre}
                    </div>
                    <input
                      type="text"
                      placeholder="Breve descripción o pie de foto (opcional)"
                      value={anexo.descripcion}
                      onChange={(e) => updateAnexoDescripcion(idx, e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.75rem",
                        borderRadius: "0.25rem",
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        color: "var(--fg)",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAnexo(idx)}
                    aria-label={`Eliminar anexo ${idx + 1}`}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      fontSize: "1rem",
                      cursor: "pointer",
                      padding: "0.5rem",
                    }}
                  >
                    🗑
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Acordeón de Opciones Avanzadas */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            background: "none",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "0.5rem 0",
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--fg)",
            cursor: "pointer",
          }}
        >
          <span>⚙️ Opciones avanzadas y destinatarios secundarios</span>
          <span>{showAdvanced ? "▲" : "▼"}</span>
        </button>

        {showAdvanced && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
            <Input
              label="Título de referencia interna"
              placeholder="Ej. Solicitud de cambio de turno agosto"
              value={draft.titulo}
              onChange={(e) => onUpdateDraft({ titulo: e.target.value })}
            />

            <Input
              label="Asunto formal del oficio"
              placeholder="Ej. Solicitud de reubicación temporal por causas de salud"
              value={draft.asunto}
              onChange={(e) => onUpdateDraft({ asunto: e.target.value })}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <Input
                label="Lugar / Ciudad"
                placeholder="Ej. Morelia, Mich."
                value={draft.ciudad}
                onChange={(e) => onUpdateDraft({ ciudad: e.target.value })}
              />
              <Input
                label="Fecha de emisión"
                type="date"
                value={draft.fecha}
                onChange={(e) => onUpdateDraft({ fecha: e.target.value })}
              />
            </div>

            {/* Atenciones adicionales (At'n:) */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>
                  Destinatarios de atención adicional (At&apos;n:)
                </label>
                <Button variant="ghost" size="sm" type="button" onClick={addAtencion}>
                  + Añadir At&apos;n
                </Button>
              </div>
              {draft.atencion.map((at, idx) => (
                <div key={at.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto", gap: "0.375rem", alignItems: "center", marginBottom: "0.5rem" }}>
                  <Input
                    placeholder="Nombre (ej. Lic. Rosa Flores)"
                    value={at.nombre}
                    onChange={(e) => updateAtencion(idx, "nombre", e.target.value)}
                  />
                  <Input
                    placeholder="Cargo (ej. Subdirectora Administrativa)"
                    value={at.cargo}
                    onChange={(e) => updateAtencion(idx, "cargo", e.target.value)}
                  />
                  <Button variant="ghost" size="sm" type="button" disabled={idx === 0} onClick={() => moveAtencion(idx, "up")}>
                    ▲
                  </Button>
                  <Button variant="ghost" size="sm" type="button" disabled={idx === draft.atencion.length - 1} onClick={() => moveAtencion(idx, "down")}>
                    ▼
                  </Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => removeAtencion(idx)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            {/* Copias para archivo (c.c.p.) */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)" }}>
                  Copias de conocimiento (c.c.p.)
                </label>
                <Button variant="ghost" size="sm" type="button" onClick={addCopia}>
                  + Añadir c.c.p.
                </Button>
              </div>
              {draft.copias.map((cp, idx) => (
                <div key={cp.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto auto", gap: "0.375rem", alignItems: "center", marginBottom: "0.5rem" }}>
                  <Input
                    placeholder="Nombre o Representación"
                    value={cp.nombre}
                    onChange={(e) => updateCopia(idx, "nombre", e.target.value)}
                  />
                  <Input
                    placeholder="Cargo o Instancia"
                    value={cp.cargo}
                    onChange={(e) => updateCopia(idx, "cargo", e.target.value)}
                  />
                  <Button variant="ghost" size="sm" type="button" disabled={idx === 0} onClick={() => moveCopia(idx, "up")}>
                    ▲
                  </Button>
                  <Button variant="ghost" size="sm" type="button" disabled={idx === draft.copias.length - 1} onClick={() => moveCopia(idx, "down")}>
                    ▼
                  </Button>
                  <Button variant="ghost" size="sm" type="button" onClick={() => removeCopia(idx)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            {/* Fundamentación normativa verificada */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                id="fundamentar-check"
                checked={draft.incluirFundamentos}
                onChange={(e) => onUpdateDraft({ incluirFundamentos: e.target.checked })}
                style={{ width: "1rem", height: "1rem", accentColor: "var(--primary)" }}
              />
              <label htmlFor="fundamentar-check" style={{ fontSize: "0.8125rem", color: "var(--fg)", cursor: "pointer" }}>
                Fundamentar con normas y cláusulas del Contrato Colectivo de Trabajo vigentes
              </label>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{ padding: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", color: "#991b1b", fontSize: "0.8125rem" }}>
          {errorMsg}
        </div>
      )}

      {/* Botón principal de avance */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          variant="primary"
          size="md"
          type="submit"
          loading={isGenerating}
          disabled={isGenerating || anexoUploading}
        >
          ✨ Redactar borrador con IA
        </Button>
      </div>
    </form>
  )
}
