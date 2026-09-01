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
import {
  DIRECTORIO_DESTINATARIOS,
  VALOR_DESTINO_MANUAL,
  CATEGORIAS_DESTINATARIOS,
  type DestinatarioCategoria,
} from "@/features/escritos/data/directorio-destinatarios"
import { DestinatarioResumen } from "./DestinatarioResumen"
import { DestinatarioSelectorModal } from "./DestinatarioSelectorModal"

export interface EscritosFormProps {
  userId: string
  draft: EscritoDraftV2
  onUpdateDraft: (updated: Partial<EscritoDraftV2>) => void
  onGenerate: () => void
  onManualEdit: () => void
  isGenerating: boolean
  generationError?: string | null
  onRetryAI?: () => void
  workerProfile?: {
    nombre?: string
    matricula?: string
    categoria?: string
    adscripcion?: string
    seccion?: string
  }
}

export function EscritosForm({
  userId,
  draft,
  onUpdateDraft,
  onGenerate,
  onManualEdit,
  isGenerating,
  generationError,
  onRetryAI,
  workerProfile,
}: EscritosFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isSelectorModalOpen, setIsSelectorModalOpen] = useState(false)
  const [selectorInitialTab, setSelectorInitialTab] = useState<"directorio" | "manual">("directorio")
  const [anexoUploading, setAnexoUploading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const currentTipoDef = TIPOS_ESCRITO[draft.tipo] || TIPOS_ESCRITO.solicitud

  const handleTipoSelect = (tipo: TipoEscritoKey) => {
    onUpdateDraft({
      tipo,
      asunto: draft.asunto || `${TIPOS_ESCRITO[tipo].titulo}: Solicitud formal`,
    })
  }

  // Manejo del selector de destinatarios
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === VALOR_DESTINO_MANUAL) {
      setSelectorInitialTab("manual")
      setIsSelectorModalOpen(true)
    } else {
      const found = DIRECTORIO_DESTINATARIOS.find((d) => d.id === val)
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
    setValidationError(null)

    try {
      const newAnexos: AnexoItem[] = [...draft.anexos]

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!file.type.startsWith("image/")) {
          setValidationError("Solo se admiten archivos de imagen (JPG, PNG, WebP).")
          continue
        }
        if (file.size > 10 * 1024 * 1024) {
          setValidationError("Cada imagen no debe exceder los 10MB.")
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
      setValidationError("Error al procesar la imagen adjunta.")
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

  const validateBasicFields = (): boolean => {
    setValidationError(null)

    if (!draft.destino.cargo.trim() && !draft.destino.nombre.trim()) {
      setValidationError("Por favor especifica a quién va dirigido el escrito.")
      return false
    }

    if (!draft.hechos.trim()) {
      setValidationError("Por favor describe con tus palabras lo ocurrido o tus antecedentes.")
      return false
    }

    if (!draft.peticion.trim()) {
      setValidationError("Por favor indica qué necesitas que te respondan o resuelvan.")
      return false
    }

    return true
  }

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateBasicFields()) {
      onGenerate()
    }
  }

  const handleManualSubmit = () => {
    if (!draft.destino.cargo.trim() && !draft.destino.nombre.trim()) {
      setValidationError("Por favor especifica a quién va dirigido el escrito.")
      return
    }
    onManualEdit()
  }

  // Agrupación para el select nativo
  const categoriesOrder: DestinatarioCategoria[] = [
    "comite_ejecutivo",
    "secretarias",
    "comisiones",
    "subcomisiones",
    "comites_delegacionales",
  ]

  const currentSelectedId =
    DIRECTORIO_DESTINATARIOS.find(
      (d) => d.nombre === draft.destino.nombre && d.cargo === draft.destino.cargo
    )?.id || (draft.destino.nombre || draft.destino.cargo ? VALOR_DESTINO_MANUAL : "")

  return (
    <form onSubmit={handleAiSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <label
            htmlFor="escrito-destinatario"
            style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}
          >
            2. ¿A quién va dirigido el escrito?
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsSelectorModalOpen(true)}
            style={{ fontSize: "0.8125rem" }}
          >
            🔍 Buscar en Directorio Oficial
          </Button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Visor Compacto del Destinatario */}
          {(draft.destino.nombre || draft.destino.cargo) && (
            <DestinatarioResumen
              destino={draft.destino}
              onChangeRequest={() => setIsSelectorModalOpen(true)}
            />
          )}

          {/* Select de compatibilidad accesible y E2E */}
          <select
            id="escrito-destinatario"
            name="destinatario"
            value={currentSelectedId}
            onChange={handleSelectChange}
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
            <option value="" disabled>
              -- Selecciona un integrante sindical o escribe uno manual --
            </option>
            {categoriesOrder.map((catKey) => {
              const items = DIRECTORIO_DESTINATARIOS.filter((d) => d.categoria === catKey)
              if (items.length === 0) return null
              const catDef = CATEGORIAS_DESTINATARIOS[catKey]
              return (
                <optgroup key={catKey} label={`${catDef.icono} ${catDef.titulo}`}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre} — {item.cargo}
                    </option>
                  ))}
                </optgroup>
              )
            })}
            <optgroup label="✍️ Destinatario personalizado">
              <option value={VALOR_DESTINO_MANUAL}>
                ✍️ Destinatario manual (Director de Unidad, Jefatura, etc.)
              </option>
            </optgroup>
          </select>
        </div>
      </div>

      {/* Modal de selección y búsqueda de destinatario */}
      <DestinatarioSelectorModal
        isOpen={isSelectorModalOpen}
        onClose={() => setIsSelectorModalOpen(false)}
        currentDestino={draft.destino}
        onSelectDestino={(d) => onUpdateDraft({ destino: d })}
        initialTab={selectorInitialTab}
      />

      {/* Pregunta 3: Lugar y Fecha */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <Input
          id="escrito-ciudad"
          name="ciudad"
          label="¿Dónde te encuentras? (Lugar / Ciudad)"
          placeholder="Ej. Morelia, Mich."
          value={draft.ciudad}
          onChange={(e) => onUpdateDraft({ ciudad: e.target.value })}
        />
        <Input
          id="escrito-fecha"
          name="fecha"
          type="date"
          label="¿En qué fecha se emite?"
          value={draft.fecha}
          onChange={(e) => onUpdateDraft({ fecha: e.target.value })}
        />
      </div>

      {/* Pregunta 4: Hechos */}
      <div>
        <label
          htmlFor="escrito-hechos"
          style={{ display: "block", fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.375rem" }}
        >
          3. Cuéntanos con tus palabras qué pasó (Hechos y antecedentes)
        </label>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
          No te preocupes por la ortografía ni por el lenguaje formal. Describe lo sucedido libremente; la IA ordenará tus notas y les dará formato oficial.
        </p>
        <Textarea
          id="escrito-hechos"
          name="hechos"
          rows={4}
          placeholder={currentTipoDef.placeholderHechos}
          value={draft.hechos}
          onChange={(e) => onUpdateDraft({ hechos: e.target.value })}
          required
        />
      </div>

      {/* Pregunta 5: Petición */}
      <div>
        <label
          htmlFor="escrito-peticion"
          style={{ display: "block", fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.375rem" }}
        >
          4. ¿Qué necesitas que te respondan o resuelvan? (Petición concreta)
        </label>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
          Indica con claridad lo que solicitas que la autoridad o representación sindical realice.
        </p>
        <Textarea
          id="escrito-peticion"
          name="peticion"
          rows={3}
          placeholder={currentTipoDef.placeholderPeticion}
          value={draft.peticion}
          onChange={(e) => onUpdateDraft({ peticion: e.target.value })}
          required
        />
      </div>

      {/* Pregunta 6: Anexos y Fotografías */}
      <div>
        <label style={{ display: "block", fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", marginBottom: "0.375rem" }}>
          5. Fotografías y documentos de respaldo (Opcional)
        </label>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--muted)" }}>
          Puedes anexar oficios previos, sellos de recibido, capturas o fotografías de evidencia. Se insertarán al final del documento.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.875rem",
              borderRadius: "0.5rem",
              border: "2px dashed var(--border)",
              background: "var(--accent)",
              cursor: anexoUploading ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--primary)",
              textAlign: "center",
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={anexoUploading}
              style={{ display: "none" }}
            />
            {anexoUploading ? "⏳ Procesando imagen..." : "📎 Adjuntar fotografía o imagen de respaldo"}
          </label>

          {draft.anexos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {draft.anexos.map((anexo, idx) => (
                <Card
                  key={anexo.id}
                  padding="0.75rem"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    background: "var(--card)",
                  }}
                >
                  {anexo.previewUrl && (
                    <img
                      src={anexo.previewUrl}
                      alt={anexo.nombre}
                      style={{
                        width: "48px",
                        height: "48px",
                        objectFit: "cover",
                        borderRadius: "0.25rem",
                        border: "1px solid var(--border)",
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
              id="escrito-asunto"
              name="asunto"
              placeholder="Ej. Solicitud de reubicación temporal por causas de salud"
              value={draft.asunto}
              onChange={(e) => onUpdateDraft({ asunto: e.target.value })}
            />

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

      {validationError && (
        <div style={{ padding: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", color: "#991b1b", fontSize: "0.8125rem" }}>
          {validationError}
        </div>
      )}

      {/* Banner de Degradación o Error de IA */}
      {generationError && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "0.75rem", padding: "1rem", color: "#92400e" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: "0.375rem" }}>
            ⚠️ La redacción inteligente no está disponible en este momento
          </div>
          <div style={{ fontSize: "0.875rem", marginBottom: "0.875rem", color: "#78350f" }}>
            {generationError}. Tus datos, antecedentes y petición se encuentran intactos. Puedes intentar nuevamente o redactar directamente en el editor manual.
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onRetryAI || onGenerate}
              loading={isGenerating}
            >
              🔄 Reintentar con IA
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleManualSubmit}
            >
              ✍️ Continuar en modo manual
            </Button>
          </div>
        </div>
      )}

      {/* Dos modos claramente diferenciados */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          borderTop: "1px solid var(--border)",
          paddingTop: "1.25rem",
        }}
      >
        <Button
          variant="ghost"
          size="md"
          type="button"
          onClick={handleManualSubmit}
          disabled={isGenerating || anexoUploading}
          style={{ color: "var(--fg)" }}
        >
          ✏️ Quiero escribirlo manualmente
        </Button>

        <Button
          variant="primary"
          size="md"
          type="submit"
          loading={isGenerating}
          disabled={isGenerating || anexoUploading}
        >
          ✨ Ayúdame a redactarlo con IA
        </Button>
      </div>
    </form>
  )
}
