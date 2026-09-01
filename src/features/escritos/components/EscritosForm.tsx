"use client"

import { useState, useCallback, type ChangeEvent } from "react"
import Link from "next/link"
import { Input, Textarea, Select } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { COMITE_SECCIONAL, VALOR_DESTINO_MANUAL } from "@/features/escritos/data/comite-seccional"
import {
  TIPOS_ESCRITO,
  type TipoEscritoKey,
  type EscritoDraftV2,
  type AnexoItem,
} from "@/shared/contracts/escrito-draft"

interface ProfileData {
  full_name: string
  matricula: string
  categoria: string
  adscripcion: string
}

interface EscritosFormProps {
  profile: ProfileData | null
  draft: EscritoDraftV2
  onUpdateDraft: (updated: Partial<EscritoDraftV2>) => void
  onGenerate: () => void
  onClear: () => void
  loading: boolean
}

export function EscritosForm({
  profile,
  draft,
  onUpdateDraft,
  onGenerate,
  onClear,
  loading,
}: EscritosFormProps) {
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false)
  const [modoManualDestino, setModoManualDestino] = useState(false)
  const [cargoManual, setCargoManual] = useState(draft.destino.cargo || "")
  const [nombreManual, setNombreManual] = useState(draft.destino.nombre || "")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const tipoActual = (TIPOS_ESCRITO[draft.tipo as TipoEscritoKey] || TIPOS_ESCRITO.solicitud)

  const destinoOptions = COMITE_SECCIONAL.map((g) => (
    <optgroup key={g.group} label={g.group}>
      {g.items.map((i) => (
        <option key={i.value} value={i.value}>{i.label}</option>
      ))}
    </optgroup>
  ))

  const handleTipoChange = (key: TipoEscritoKey) => {
    onUpdateDraft({
      tipo: key,
      asunto: draft.asunto || TIPOS_ESCRITO[key].ejemploAsunto,
    })
  }

  const handleDestinoSelectChange = (value: string) => {
    if (value === VALOR_DESTINO_MANUAL) {
      setModoManualDestino(true)
      onUpdateDraft({ destino: { cargo: cargoManual, nombre: nombreManual } })
      return
    }
    setModoManualDestino(false)
    if (!value || !value.includes("|")) {
      onUpdateDraft({ destino: { cargo: "", nombre: "" } })
      return
    }
    const [cargo, nombre] = value.split("|")
    onUpdateDraft({ destino: { cargo: cargo || "", nombre: nombre || "" } })
  }

  const handleManualDestinoUpdate = (field: "cargo" | "nombre", val: string) => {
    if (field === "cargo") {
      setCargoManual(val)
      onUpdateDraft({ destino: { cargo: val, nombre: nombreManual } })
    } else {
      setNombreManual(val)
      onUpdateDraft({ destino: { cargo: cargoManual, nombre: val } })
    }
  }

  const handleAtencionChange = (val: string) => {
    if (!val || !val.includes("|")) {
      onUpdateDraft({ atencion: [] })
      return
    }
    const [cargo, nombre] = val.split("|")
    onUpdateDraft({ atencion: [{ cargo: cargo || "", nombre: nombre || "" }] })
  }

  const handleCopiaChange = (val: string) => {
    if (!val || !val.includes("|")) {
      onUpdateDraft({ copias: [] })
      return
    }
    const [cargo, nombre] = val.split("|")
    onUpdateDraft({ copias: [{ cargo: cargo || "", nombre: nombre || "" }] })
  }

  const handleAddFotos = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const nuevasFotos: AnexoItem[] = []
    let processed = 0

    files.forEach((f, idx) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        nuevasFotos.push({
          id: `anx_${Date.now()}_${idx}`,
          nombre: f.name.replace(/\.[^/.]+$/, "") || `Anexo ${draft.anexos.length + idx + 1}`,
          descripcion: "Fotografía de evidencia adjunta",
          dataUrl,
        })
        processed++
        if (processed === files.length) {
          onUpdateDraft({ anexos: [...draft.anexos, ...nuevasFotos] })
        }
      }
      reader.readAsDataURL(f)
    })
  }, [draft.anexos, onUpdateDraft])

  const handleRemoveAnexo = (id: string) => {
    onUpdateDraft({ anexos: draft.anexos.filter((a) => a.id !== id) })
  }

  const handleUpdateAnexoDesc = (id: string, descripcion: string) => {
    onUpdateDraft({
      anexos: draft.anexos.map((a) => (a.id === id ? { ...a, descripcion } : a)),
    })
  }

  const validateAndGenerate = () => {
    const errors: Record<string, string> = {}

    if (!draft.destino.cargo.trim() && !draft.destino.nombre.trim()) {
      errors.destino = "Por favor indica a quién va dirigido el escrito."
    }
    if (!draft.ciudad.trim()) {
      errors.ciudad = "Por favor especifica el lugar o municipio."
    }
    if (!draft.fecha.trim()) {
      errors.fecha = "Por favor selecciona la fecha del escrito."
    }
    if (!draft.hechos.trim()) {
      errors.hechos = "Describe los hechos de lo ocurrido. No necesitas usar términos legales."
    }
    if (!draft.peticion.trim()) {
      errors.peticion = "Indica concretamente qué solución o solicitud estás esperando."
    }

    setValidationErrors(errors)

    if (Object.keys(errors).length === 0) {
      onGenerate()
    }
  }

  const destinoPillValue = modoManualDestino
    ? `${cargoManual ? cargoManual + " - " : ""}${nombreManual}`.trim()
    : `${draft.destino.cargo ? draft.destino.cargo + " - " : ""}${draft.destino.nombre}`.trim()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Tarjeta de perfil compacto */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--primary), #1e40af)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "1.1rem",
              flexShrink: 0,
            }}
          >
            👤
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.full_name ?? "Trabajador(a)"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile?.matricula ? `Mat. ${profile.matricula} · ` : ""}
              {profile?.categoria ?? ""}
              {profile?.adscripcion ? ` (${profile.adscripcion})` : ""}
            </div>
          </div>
        </div>
        <Link
          href="/profile"
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
            border: "1px solid var(--border)",
            borderRadius: "999px",
            padding: "0.35rem 0.75rem",
            background: "var(--bg)",
          }}
        >
          Editar perfil
        </Link>
      </div>

      {/* Formulario Principal de 3 Pasos */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <div style={{ marginBottom: "1.25rem" }}>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "0.15rem 0.5rem",
              borderRadius: "999px",
              background: "var(--accent)",
              color: "var(--primary)",
            }}
          >
            Paso 1 de 3
          </span>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: "0.35rem 0 0", color: "var(--fg)" }}>
            Datos de tu escrito
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0.2rem 0 0" }}>
            Responde las preguntas con tus propias palabras. La IA estructurará un borrador formal.
          </p>
        </div>

        {/* 1. ¿Qué necesitas escribir? */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--fg)" }}>
            1. ¿Qué necesitas escribir?
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "0.5rem",
            }}
          >
            {(Object.keys(TIPOS_ESCRITO) as TipoEscritoKey[]).map((key) => {
              const def = TIPOS_ESCRITO[key]
              const selected = draft.tipo === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTipoChange(key)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: selected ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: selected ? "var(--accent)" : "var(--bg)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>{def.icono}</div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: selected ? "var(--primary)" : "var(--fg)" }}>
                    {def.titulo}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem", lineHeight: 1.3 }}>
                    {def.descripcion}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. ¿A quién va dirigido? */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--fg)" }}>
            2. ¿A quién va dirigido?
          </label>

          {!modoManualDestino ? (
            <div>
              <Select
                label="Selecciona la autoridad o representante sindical"
                value={draft.destino.cargo && draft.destino.nombre ? `${draft.destino.cargo}|${draft.destino.nombre}` : ""}
                onChange={(e) => handleDestinoSelectChange(e.target.value)}
              >
                <option value="">— Selecciona del Comité Seccional —</option>
                {destinoOptions}
                <option value={VALOR_DESTINO_MANUAL}>— Otra persona (destinatario manual) —</option>
              </Select>
              <button
                type="button"
                onClick={() => setModoManualDestino(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary)",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  padding: "0.35rem 0",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                ¿Destinatario fuera del comité? Escribir manualmente →
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: "1rem",
                background: "var(--accent)",
                borderRadius: "0.5rem",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "var(--muted)" }}>
                Destinatario Manual
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                <Input
                  label="Cargo (ej. Director de la UMF No. 80)"
                  value={cargoManual}
                  onChange={(e) => handleManualDestinoUpdate("cargo", e.target.value)}
                  placeholder="Ej. Jefe de Servicios Administrativos"
                />
                <Input
                  label="Nombre del destinatario"
                  value={nombreManual}
                  onChange={(e) => handleManualDestinoUpdate("nombre", e.target.value)}
                  placeholder="Ej. Dr. Mario Silva Pérez"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setModoManualDestino(false)
                  setCargoManual("")
                  setNombreManual("")
                  onUpdateDraft({ destino: { cargo: "", nombre: "" } })
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                  padding: 0,
                  alignSelf: "flex-start",
                }}
              >
                ← Volver a lista del Comité Seccional
              </button>
            </div>
          )}

          {destinoPillValue && (
            <div
              style={{
                marginTop: "0.5rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                background: "var(--bg)",
                borderLeft: "3px solid var(--primary)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--fg)",
              }}
            >
              ✉ Dirigido a: {destinoPillValue}
            </div>
          )}

          {validationErrors.destino && (
            <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: "0.25rem 0 0" }}>
              {validationErrors.destino}
            </p>
          )}
        </div>

        {/* 3. ¿Cuándo y dónde ocurrió? */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--fg)" }}>
            3. ¿Cuándo y dónde ocurrió?
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
            <div>
              <Input
                label="Fecha del escrito"
                type="date"
                value={draft.fecha}
                onChange={(e) => onUpdateDraft({ fecha: e.target.value })}
              />
              {validationErrors.fecha && (
                <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: "0.25rem 0 0" }}>
                  {validationErrors.fecha}
                </p>
              )}
            </div>
            <div>
              <Input
                label="Lugar / Municipio"
                value={draft.ciudad}
                onChange={(e) => onUpdateDraft({ ciudad: e.target.value })}
                placeholder="Ej. Morelia, Michoacán"
              />
              {validationErrors.ciudad && (
                <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: "0.25rem 0 0" }}>
                  {validationErrors.ciudad}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 4. ¿Qué ocurrió? (Hechos) */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.35rem", color: "var(--fg)" }}>
            4. ¿Qué ocurrió? (Hechos)
          </label>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
            Cuéntanos con tus propias palabras. No necesitas usar términos legales ni artículos.
          </p>
          <Textarea
            label=""
            value={draft.hechos}
            onChange={(e) => onUpdateDraft({ hechos: e.target.value })}
            placeholder={tipoActual.placeholderHechos}
            rows={5}
          />
          {validationErrors.hechos && (
            <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: "0.25rem 0 0" }}>
              {validationErrors.hechos}
            </p>
          )}
        </div>

        {/* 5. ¿Qué quieres solicitar? (Petición) */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.35rem", color: "var(--fg)" }}>
            5. ¿Qué quieres solicitar? (Petición concreta)
          </label>
          <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.5rem" }}>
            ¿Qué solución o respuesta puntual esperas que realice el destinatario?
          </p>
          <Textarea
            label=""
            value={draft.peticion}
            onChange={(e) => onUpdateDraft({ peticion: e.target.value })}
            placeholder={tipoActual.placeholderPeticion}
            rows={3}
          />
          {validationErrors.peticion && (
            <p style={{ fontSize: "0.75rem", color: "#ef4444", margin: "0.25rem 0 0" }}>
              {validationErrors.peticion}
            </p>
          )}
        </div>

        {/* 6. Anexos de evidencia */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.35rem", color: "var(--fg)" }}>
            6. Fotografías o comprobantes de evidencia (Opcional)
          </label>
          <Input
            label="Adjuntar imágenes"
            type="file"
            multiple
            accept="image/*"
            onChange={handleAddFotos}
          />

          {draft.anexos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
              {draft.anexos.map((anexo, idx) => (
                <div
                  key={anexo.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                  }}
                >
                  {anexo.dataUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={anexo.dataUrl}
                      alt={anexo.nombre}
                      style={{ width: 44, height: 44, objectFit: "cover", borderRadius: "0.25rem" }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Anexo {idx + 1}: {anexo.nombre}</div>
                    <input
                      value={anexo.descripcion}
                      onChange={(e) => handleUpdateAnexoDesc(anexo.id, e.target.value)}
                      placeholder="Descripción del anexo..."
                      style={{
                        width: "100%",
                        padding: "0.2rem 0.4rem",
                        fontSize: "0.75rem",
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.25rem",
                        marginTop: "0.2rem",
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveAnexo(anexo.id)}
                    style={{ color: "#ef4444" }}
                    aria-label={`Eliminar anexo ${idx + 1}`}
                  >
                    🗑
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Opciones avanzadas (acordeón en el mismo formulario) */}
        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <button
            type="button"
            onClick={() => setMostrarAvanzado((v) => !v)}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.25rem 0",
            }}
          >
            <span>⚙</span>
            {mostrarAvanzado ? "Ocultar opciones avanzadas" : "Mostrar opciones avanzadas (Asunto, Copias, Fundamentos)"}
          </button>

          {mostrarAvanzado && (
            <div
              style={{
                marginTop: "1rem",
                padding: "1rem",
                background: "var(--accent)",
                borderRadius: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <Input
                label="Título interno del escrito"
                value={draft.titulo}
                onChange={(e) => onUpdateDraft({ titulo: e.target.value })}
                placeholder="Ej. Solicitud de cambio de adscripción"
              />

              <Input
                label="Asunto formal del oficio"
                value={draft.asunto}
                onChange={(e) => onUpdateDraft({ asunto: e.target.value })}
                placeholder="Ej. Solicitud de días a cuenta de vacaciones"
              />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                <Select
                  label="Con atención a (At'n)"
                  value={draft.atencion[0]?.cargo ? `${draft.atencion[0].cargo}|${draft.atencion[0].nombre}` : ""}
                  onChange={(e) => handleAtencionChange(e.target.value)}
                >
                  <option value="">Ninguno</option>
                  {destinoOptions}
                </Select>

                <Select
                  label="Con copia para (c.c.p.)"
                  value={draft.copias[0]?.cargo ? `${draft.copias[0].cargo}|${draft.copias[0].nombre}` : ""}
                  onChange={(e) => handleCopiaChange(e.target.value)}
                >
                  <option value="">Ninguno</option>
                  {destinoOptions}
                </Select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="chk-fundamentos"
                  defaultChecked
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <label htmlFor="chk-fundamentos" style={{ fontSize: "0.8125rem", color: "var(--fg)", cursor: "pointer" }}>
                  Incorporar fundamentos normativos del CCT y Estatutos si existen fuentes verificadas
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción del formulario */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <Button
            variant="primary"
            onClick={validateAndGenerate}
            loading={loading}
            disabled={loading}
            style={{ flex: 1, minWidth: 200, padding: "0.75rem 1.25rem", fontSize: "0.9375rem" }}
          >
            {loading ? "Redactando con IA..." : "✦ Redactar escrito con IA"}
          </Button>
          <Button variant="secondary" onClick={onClear} disabled={loading}>
            Limpiar
          </Button>
        </div>
      </div>
    </div>
  )
}
