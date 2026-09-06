"use client"

import { useActionState, useState } from "react"
import Link from "next/link"
import { Button } from "@/shared/components/ui/Button"
import { Input, Textarea, Select } from "@/shared/components/ui/Input"
import { Card } from "@/shared/components/ui/Card"
import type { Announcement } from "@/shared/contracts/announcements"
import {
  saveAnnouncementAction,
  publishAnnouncementAction,
  archiveAnnouncementAction,
  duplicateAnnouncementAction,
  type ActionResponse,
} from "../actions/announcement-actions"
import {
  MAX_TITLE_LENGTH,
  MAX_PUSH_SUMMARY_LENGTH,
  MAX_BAR_TEXT_LENGTH,
  MAX_BODY_LENGTH,
} from "../services/announcements-validate"
import {
  DeviceMobile,
  EnvelopeSimple,
  Eye,
  FloppyDisk,
  PaperPlaneTilt,
  Archive,
  Copy,
  CaretRight,
  Info,
} from "@phosphor-icons/react"

interface AnnouncementFormProps {
  initialData?: Announcement | null
}

const PREDEFINED_DESTINATIONS = [
  { label: "Bandeja de avisos (/avisos)", value: "/avisos" },
  { label: "Calendario de pagos y descansos (/calendario)", value: "/calendario" },
  { label: "Asistente vacacional (/vacaciones)", value: "/vacaciones" },
  { label: "Calculadoras de nómina (/calculadoras)", value: "/calculadoras" },
  { label: "Simulador de nómina (/simulador-nomina)", value: "/simulador-nomina" },
  { label: "Generador de escritos (/escritos)", value: "/escritos" },
  { label: "Documentos personales (/documentos-personales)", value: "/documentos-personales" },
  { label: "Asistente de derechos SNTSS (/asistente)", value: "/asistente" },
  { label: "Guía del Tarjetón (/guia)", value: "/guia" },
  { label: "Ruta personalizada...", value: "custom" },
]

export function AnnouncementForm({ initialData }: AnnouncementFormProps) {
  const isEditing = Boolean(initialData?.id)
  const isReadOnly = initialData?.status === "PUBLISHED" || initialData?.status === "ARCHIVED"

  const [title, setTitle] = useState(initialData?.title ?? "")
  const [kind, setKind] = useState(initialData?.kind ?? "announcement")
  const [pushSummary, setPushSummary] = useState(initialData?.push_summary ?? "")
  const [body, setBody] = useState(initialData?.body ?? "")
  const [barText, setBarText] = useState(initialData?.bar_text ?? "")
  const [showInInbox, setShowInInbox] = useState(initialData?.show_in_inbox ?? true)
  const [showInBar, setShowInBar] = useState(initialData?.show_in_bar ?? false)
  const [destinationPreset, setDestinationPreset] = useState(() => {
    if (!initialData?.destination_path) return "/avisos"
    const match = PREDEFINED_DESTINATIONS.find((d) => d.value === initialData.destination_path)
    return match ? match.value : "custom"
  })
  const [customDestination, setCustomDestination] = useState(initialData?.destination_path ?? "")
  const [publishAt, setPublishAt] = useState(() => {
    if (!initialData?.publish_at) return ""
    return new Date(initialData.publish_at).toISOString().slice(0, 16)
  })
  const [expiresAt, setExpiresAt] = useState(() => {
    if (!initialData?.expires_at) return ""
    return new Date(initialData.expires_at).toISOString().slice(0, 16)
  })
  const [showPreview, setShowPreview] = useState(false)
  const [showNormativaFields, setShowNormativaFields] = useState(
    Boolean(initialData?.source_document || initialData?.source_reference)
  )

  const [saveState, saveAction, savePending] = useActionState(
    saveAnnouncementAction,
    undefined as ActionResponse | undefined
  )

  const [publishState, publishAction, publishPending] = useActionState(
    publishAnnouncementAction,
    undefined as ActionResponse | undefined
  )

  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveAnnouncementAction,
    undefined as ActionResponse | undefined
  )

  const [dupState, duplicateAction, duplicatePending] = useActionState(
    duplicateAnnouncementAction,
    undefined as ActionResponse | undefined
  )

  const finalDestination = destinationPreset === "custom" ? customDestination : destinationPreset

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Alertas de retroalimentación de Server Actions */}
      {saveState?.error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.875rem", color: "#991b1b", fontSize: "0.875rem" }}>
          {saveState.error}
        </div>
      )}
      {publishState?.error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.875rem", color: "#991b1b", fontSize: "0.875rem" }}>
          {publishState.error}
        </div>
      )}
      {archiveState?.error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.875rem", color: "#991b1b", fontSize: "0.875rem" }}>
          {archiveState.error}
        </div>
      )}
      {dupState?.error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.875rem", color: "#991b1b", fontSize: "0.875rem" }}>
          {dupState.error}
        </div>
      )}

      {isReadOnly && (
        <div style={{ background: "var(--accent)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Estado del aviso: <strong style={{ color: "var(--primary)" }}>{initialData?.status}</strong> (Revisión #{initialData?.revision})
            </span>
            <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.8125rem" }}>
              Los avisos publicados o archivados no se editan directamente para preservar la fidelidad del historial. Puedes duplicarlo como un nuevo borrador.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <form action={duplicateAction}>
              <input type="hidden" name="id" value={initialData?.id} />
              <Button variant="secondary" size="sm" type="submit" loading={duplicatePending}>
                <Copy size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
                Duplicar como borrador
              </Button>
            </form>
            {initialData?.status === "PUBLISHED" && (
              <form action={archiveAction}>
                <input type="hidden" name="id" value={initialData?.id} />
                <Button variant="ghost" size="sm" type="submit" loading={archivePending}>
                  <Archive size={16} weight="bold" style={{ marginRight: "0.375rem" }} />
                  Archivar
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      <form action={saveAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}
        {initialData?.revision && <input type="hidden" name="revision" value={initialData.revision} />}
        <input type="hidden" name="destination_path" value={finalDestination} />

        <Card padding="1.5rem">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem" }}>1. Datos principales</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <Input
                label="Título del aviso *"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_TITLE_LENGTH}
                disabled={isReadOnly}
                required
                placeholder="Ej. Convocatoria para el periodo vacacional 2027"
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "0.75rem", color: title.length > MAX_TITLE_LENGTH ? "red" : "var(--muted)" }}>
                  {title.length} / {MAX_TITLE_LENGTH}
                </span>
              </div>
            </div>

            <div>
              <Select
                label="Tipo de comunicado"
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "announcement" | "tip" | "tool")}
                disabled={isReadOnly}
              >
                <option value="announcement">Comunicado general institucional</option>
                <option value="tip">Consejo o tip normativo (CCT / Derechos)</option>
                <option value="tool">Novedad o guía de herramienta</option>
              </Select>
            </div>

            <div>
              <Textarea
                label="Contenido completo *"
                name="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={MAX_BODY_LENGTH}
                disabled={isReadOnly}
                required
                rows={6}
                placeholder="Escribe el texto detallado del comunicado para la bandeja de la app..."
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "0.75rem", color: body.length > MAX_BODY_LENGTH ? "red" : "var(--muted)" }}>
                  {body.length} / {MAX_BODY_LENGTH}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card padding="1.5rem">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem" }}>2. Canales de visibilidad</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: isReadOnly ? "default" : "pointer" }}>
              <input
                type="checkbox"
                name="show_in_inbox"
                checked={showInInbox}
                onChange={(e) => setShowInInbox(e.target.checked)}
                disabled={isReadOnly}
                style={{ width: "18px", height: "18px", marginTop: "0.15rem" }}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: "0.9375rem", display: "block" }}>
                  Mostrar en Bandeja de avisos (/avisos)
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                  El trabajador podrá consultar y leer el comunicado completo dentro de la plataforma.
                </span>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: isReadOnly ? "default" : "pointer" }}>
              <input
                type="checkbox"
                name="show_in_bar"
                checked={showInBar}
                onChange={(e) => setShowInBar(e.target.checked)}
                disabled={isReadOnly}
                style={{ width: "18px", height: "18px", marginTop: "0.15rem" }}
              />
              <div>
                <span style={{ fontWeight: 600, fontSize: "0.9375rem", display: "block" }}>
                  Mostrar en Barra informativa móvil (inferior)
                </span>
                <span style={{ color: "var(--muted)", fontSize: "0.8125rem" }}>
                  Rotará como píldora en la barra compacta de la aplicación en dispositivos móviles.
                </span>
              </div>
            </label>

            {showInBar && (
              <div style={{ paddingLeft: "2rem" }}>
                <Input
                  label="Texto corto para la barra móvil (opcional, máx 120 caracteres)"
                  name="bar_text"
                  value={barText}
                  onChange={(e) => setBarText(e.target.value)}
                  maxLength={MAX_BAR_TEXT_LENGTH}
                  disabled={isReadOnly}
                  placeholder="Ej. Convocatoria vacacional abierta hasta el 15 de oct."
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.75rem", color: barText.length > MAX_BAR_TEXT_LENGTH ? "red" : "var(--muted)" }}>
                    {barText.length} / {MAX_BAR_TEXT_LENGTH}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card padding="1.5rem">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem" }}>3. Notificación Push y Destino</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <Input
                label="Resumen para notificación push (máx 200 caracteres)"
                name="push_summary"
                value={pushSummary}
                onChange={(e) => setPushSummary(e.target.value)}
                maxLength={MAX_PUSH_SUMMARY_LENGTH}
                disabled={isReadOnly}
                placeholder="Texto breve que aparecerá en el teléfono cuando se despache push."
              />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "0.75rem", color: pushSummary.length > MAX_PUSH_SUMMARY_LENGTH ? "red" : "var(--muted)" }}>
                  {pushSummary.length} / {MAX_PUSH_SUMMARY_LENGTH}
                </span>
              </div>
            </div>

            <div>
              <Select
                label="Botón de destino al pulsar (CTA)"
                value={destinationPreset}
                onChange={(e) => setDestinationPreset(e.target.value)}
                disabled={isReadOnly}
              >
                {PREDEFINED_DESTINATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>

            {destinationPreset === "custom" && (
              <div>
                <Input
                  label="Ruta relativa interna (ej. /perfil)"
                  value={customDestination}
                  onChange={(e) => setCustomDestination(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="/ruta-interna"
                />
              </div>
            )}
          </div>
        </Card>

        <Card padding="1.5rem">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem" }}>4. Fechas de vigencia</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "0.375rem" }}>
                Publicar a partir de (opcional)
              </label>
              <input
                type="datetime-local"
                name="publish_at"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                disabled={isReadOnly}
                style={{
                  width: "100%",
                  minHeight: "var(--control-md)",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg)",
                  color: "var(--fg)",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Zona horaria Ciudad de México</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 500, marginBottom: "0.375rem" }}>
                Fecha de vencimiento (opcional)
              </label>
              <input
                type="datetime-local"
                name="expires_at"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                disabled={isReadOnly}
                style={{
                  width: "100%",
                  minHeight: "var(--control-md)",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg)",
                  color: "var(--fg)",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>El aviso se marca como vencido tras esta fecha</span>
            </div>
          </div>
        </Card>

        {/* Sección de fundamentación normativa para tips */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem" }}>
          <button
            type="button"
            onClick={() => setShowNormativaFields(!showNormativaFields)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              color: "var(--primary)",
              padding: 0,
            }}
          >
            <Info size={16} weight="bold" />
            {showNormativaFields ? "Ocultar fundamentación jurídica" : "Añadir fundamentación jurídica (para tips normativos)"}
          </button>

          {showNormativaFields && (
            <div style={{ marginTop: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
              <Input
                label="Documento fuente"
                name="source_document"
                defaultValue={initialData?.source_document ?? ""}
                disabled={isReadOnly}
                placeholder="Ej. CCT SNTSS 2025-2027"
              />
              <Input
                label="Cláusula o Artículo"
                name="source_reference"
                defaultValue={initialData?.source_reference ?? ""}
                disabled={isReadOnly}
                placeholder="Ej. Cláusula 47"
              />
              <Input
                label="Versión"
                name="source_version"
                defaultValue={initialData?.source_version ?? ""}
                disabled={isReadOnly}
                placeholder="Ej. V1 2025-2027"
              />
              <Input
                label="Página"
                name="source_page"
                defaultValue={initialData?.source_page ?? ""}
                disabled={isReadOnly}
                placeholder="Ej. Pág. 34"
              />
            </div>
          )}
        </div>

        {/* Botonera de acciones */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
              {showPreview ? "Ocultar previsualización" : "Vista previa"}
            </Button>
          </div>

          {!isReadOnly && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Button
                variant="secondary"
                size="md"
                type="submit"
                loading={savePending}
              >
                <FloppyDisk size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
                Guardar borrador
              </Button>
            </div>
          )}
        </div>
      </form>

      {/* Formulario independiente para Publicar ahora (cuando ya existe el borrador) */}
      {!isReadOnly && initialData?.id && (
        <form action={publishAction} style={{ marginTop: "-0.5rem" }}>
          <input type="hidden" name="id" value={initialData.id} />
          <input type="hidden" name="revision" value={initialData.revision} />
          <input type="hidden" name="publish_at" value={publishAt} />
          <input type="hidden" name="expires_at" value={expiresAt} />
          <Card padding="1.25rem" style={{ background: "var(--accent)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <h4 style={{ margin: "0 0 0.25rem", fontSize: "0.9375rem", fontWeight: 700 }}>
                  ¿Listo para hacer visible este aviso?
                </h4>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
                  Se publicará inmediatamente en la bandeja de los trabajadores y/o en la barra informativa según lo configurado.
                </p>
              </div>
              <Button variant="primary" size="md" type="submit" loading={publishPending}>
                <PaperPlaneTilt size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
                Publicar aviso
              </Button>
            </div>
          </Card>
        </form>
      )}

      {/* Panel de Vista Previa */}
      {showPreview && (
        <Card padding="1.5rem" style={{ border: "2px dashed var(--primary)" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 1rem", color: "var(--primary)" }}>
            Vista Previa en Tiempo Real
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
            {/* Simulación Push Android */}
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
                Notificación en celular Android
              </span>
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "1rem", padding: "1rem", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "10px", fontWeight: 700 }}>
                    20
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--fg)" }}>La Veinte Digital</span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--muted)", marginLeft: "auto" }}>ahora</span>
                </div>
                <h4 style={{ fontSize: "0.875rem", fontWeight: 700, margin: "0 0 0.25rem", color: "#0f172a" }}>
                  {title || "Título del aviso"}
                </h4>
                <p style={{ fontSize: "0.8125rem", color: "#475569", margin: 0, lineHeight: 1.4 }}>
                  {pushSummary || body.slice(0, 140) || "Resumen del aviso..."}
                </p>
              </div>
            </div>

            {/* Simulación Tarjeta Bandeja */}
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "0.5rem" }}>
                En Bandeja de Comunicados (/avisos)
              </span>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                  <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "var(--accent)", color: "var(--primary)", padding: "0.15rem 0.5rem", borderRadius: "0.25rem", textTransform: "uppercase" }}>
                    {kind}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Hoy</span>
                </div>
                <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.375rem" }}>
                  {title || "Título del aviso"}
                </h4>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem", lineHeight: 1.4 }}>
                  {body.slice(0, 160) || "Contenido del aviso..."}
                </p>
                <div style={{ display: "flex", alignItems: "center", color: "var(--primary)", fontSize: "0.8125rem", fontWeight: 600 }}>
                  <span>Leer aviso completo</span>
                  <CaretRight size={14} weight="bold" style={{ marginLeft: "0.25rem" }} />
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
