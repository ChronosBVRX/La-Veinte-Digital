"use client"

import { useActionState, useState } from "react"
import { Textarea, Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import { Card } from "@/shared/components/ui/Card"
import {
  enviarNotificacion,
  DEFAULT_PUSH_TITLES,
  type EnviarNotificacionInput,
} from "../actions/push-actions"
import type { PushType } from "../services/push-admin"
import {
  Megaphone,
  WarningCircle,
  CalendarCheck,
  FileText,
  ArrowsClockwise,
  PaperPlaneTilt,
  CheckCircle,
  DeviceMobile,
  Gear,
  PencilSimple,
} from "@phosphor-icons/react"

interface SimplePushAlertFormProps {
  userEmail: string
  totalDevices?: number
}

interface CategoryOption {
  type: PushType
  label: string
  description: string
  icon: typeof Megaphone
  color: string
  bgLight: string
  defaultTitle: string
}

const CATEGORIES: CategoryOption[] = [
  {
    type: "GENERAL",
    label: "Aviso General",
    description: "Información institucional para todos",
    icon: Megaphone,
    color: "#2563eb",
    bgLight: "rgba(37, 99, 235, 0.08)",
    defaultTitle: DEFAULT_PUSH_TITLES.GENERAL,
  },
  {
    type: "IMPORTANT_ALERT",
    label: "Urgente / Importante",
    description: "Atención prioritaria inmediata",
    icon: WarningCircle,
    color: "#dc2626",
    bgLight: "rgba(220, 38, 38, 0.08)",
    defaultTitle: DEFAULT_PUSH_TITLES.IMPORTANT_ALERT,
  },
  {
    type: "AGENDA",
    label: "Agenda y Fechas",
    description: "Convocatorias, asambleas o plazos",
    icon: CalendarCheck,
    color: "#059669",
    bgLight: "rgba(5, 150, 105, 0.08)",
    defaultTitle: DEFAULT_PUSH_TITLES.AGENDA,
  },
  {
    type: "DOCUMENT",
    label: "Trámite IMSS",
    description: "Tarjetón, nómina o reglamentos",
    icon: FileText,
    color: "#d97706",
    bgLight: "rgba(217, 119, 6, 0.08)",
    defaultTitle: DEFAULT_PUSH_TITLES.DOCUMENT,
  },
  {
    type: "UPDATE",
    label: "Actualización",
    description: "Novedades y mejoras del sistema",
    icon: ArrowsClockwise,
    color: "#7c3aed",
    bgLight: "rgba(124, 58, 237, 0.08)",
    defaultTitle: DEFAULT_PUSH_TITLES.UPDATE,
  },
]

type SendState = {
  ok: boolean
  error?: string
  sent?: number
  failed?: number
  invalidTokens?: number
} | null

export function SimplePushAlertForm({ userEmail, totalDevices }: SimplePushAlertFormProps) {
  const [selectedType, setSelectedType] = useState<PushType>("GENERAL")
  const [message, setMessage] = useState("")
  const [customTitle, setCustomTitle] = useState("")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [destination, setDestination] = useState("")

  const activeCategory = CATEGORIES.find((c) => c.type === selectedType) ?? CATEGORIES[0]
  const effectiveTitle = customTitle.trim() || activeCategory.defaultTitle

  const [state, formAction, pending] = useActionState<SendState, FormData>(
    async () => {
      const input: EnviarNotificacionInput = {
        title: effectiveTitle,
        message: message.trim(),
        category: selectedType,
        destination: destination.trim() || undefined,
      }
      const res = await enviarNotificacion(input)
      if (res.ok) {
        setMessage("")
        setIsEditingTitle(false)
      }
      return res
    },
    null
  )

  const handleSelectCategory = (type: PushType) => {
    setSelectedType(type)
    // Si no había personalizado el título a mano, limpiar para que use el default de la nueva categoría
    if (!isEditingTitle) {
      setCustomTitle("")
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Estado de envío exitoso */}
      {state?.ok && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "0.75rem",
            padding: "1rem 1.25rem",
            color: "#166534",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 700, fontSize: "0.9375rem" }}>
            <CheckCircle size={22} weight="fill" color="#16a34a" />
            <span>¡Alerta enviada exitosamente!</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#15803d" }}>
            Se entregó a <strong>{state.sent ?? 0} dispositivos</strong>
            {state.failed ? ` (${state.failed} no disponibles)` : ""}. Los trabajadores recibirán la alerta en sus teléfonos.
          </p>
        </div>
      )}

      {/* Estado de error */}
      {state?.ok === false && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.75rem",
            padding: "1rem 1.25rem",
            color: "#991b1b",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.875rem",
          }}
        >
          <WarningCircle size={20} weight="fill" color="#dc2626" />
          <span>{state.error || "No se pudo enviar la alerta. Verifica los datos y reintenta."}</span>
        </div>
      )}

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* PASO 1: Escribe el mensaje */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <label
              htmlFor="push-message-input"
              style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)", display: "flex", alignItems: "center", gap: "0.375rem" }}
            >
              <span>1. Escribe el mensaje de la alerta</span>
              <span style={{ color: "var(--primary)", fontSize: "0.75rem", fontWeight: 600 }}>*Obligatorio</span>
            </label>
            <span style={{ fontSize: "0.75rem", color: message.length > 450 ? "#dc2626" : "var(--muted)" }}>
              {message.length} / 500 caracteres
            </span>
          </div>

          <Textarea
            id="push-message-input"
            name="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe aquí el texto que leerán los compañeros en su celular (ej. Ya están publicados los roles de vacaciones para revisión en el portal institucional)..."
            required
            maxLength={500}
            style={{ fontSize: "0.9375rem", resize: "vertical" }}
          />

          {/* PASO 1.1: Título inteligente con opción a personalizar */}
          <div
            style={{
              marginTop: "0.75rem",
              paddingTop: "0.75rem",
              borderTop: "1px dashed var(--border)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>Título de la alerta:</span>
              {!isEditingTitle ? (
                <strong style={{ fontSize: "0.8125rem", color: "var(--fg)", wordBreak: "break-word" }}>
                  {effectiveTitle}
                </strong>
              ) : null}
            </div>

            {!isEditingTitle ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditingTitle(true)
                  if (!customTitle) setCustomTitle(activeCategory.defaultTitle)
                }}
              >
                <PencilSimple size={14} weight="bold" style={{ marginRight: "0.25rem" }} />
                Personalizar título
              </Button>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem", width: "100%", marginTop: "0.25rem" }}>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Título personalizado..."
                  maxLength={100}
                  style={{ flex: 1 }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditingTitle(false)}
                >
                  Listo
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* PASO 2: Selecciona el tipo de alerta */}
        <Card padding="1.25rem">
          <div style={{ marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
              2. Elige el tipo de notificación
            </span>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Selecciona la categoría para que los trabajadores identifiquen la prioridad en su teléfono.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.625rem",
            }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedType === cat.type
              const IconComp = cat.icon
              return (
                <div
                  key={cat.type}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectCategory(cat.type)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      handleSelectCategory(cat.type)
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    padding: "0.75rem",
                    borderRadius: "0.5rem",
                    border: isSelected ? `2px solid ${cat.color}` : "1px solid var(--border)",
                    background: isSelected ? cat.bgLight : "var(--card)",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                    outline: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div
                      style={{
                        color: isSelected ? cat.color : "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <IconComp size={20} weight={isSelected ? "fill" : "duotone"} />
                    </div>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: isSelected ? 700 : 600,
                        color: isSelected ? cat.color : "var(--fg)",
                      }}
                    >
                      {cat.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.25 }}>
                    {cat.description}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* PASO 3: Vista previa en vivo del teléfono */}
        <Card padding="1.25rem">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <DeviceMobile size={18} weight="duotone" color="var(--primary)" />
              Vista previa en el teléfono del trabajador
            </span>
            {totalDevices !== undefined && totalDevices > 0 && (
              <span
                style={{
                  background: "rgba(16, 185, 129, 0.1)",
                  color: "#059669",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {totalDevices} dispositivos activos
              </span>
            )}
          </div>

          <div
            style={{
              background: "#0f172a",
              color: "#f8fafc",
              borderRadius: "0.75rem",
              padding: "1rem",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "#94a3b8" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: activeCategory.color,
                  }}
                />
                <span style={{ fontWeight: 600, color: "#cbd5e1" }}>La Veinte Digital</span>
                <span>•</span>
                <span>ahora</span>
              </div>
              <span style={{ fontSize: "0.6875rem", opacity: 0.8 }}>Android</span>
            </div>

            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#ffffff", marginTop: "0.125rem" }}>
              {effectiveTitle}
            </div>

            <div
              style={{
                fontSize: "0.8125rem",
                color: message.trim() ? "#e2e8f0" : "#64748b",
                lineHeight: 1.4,
                fontStyle: message.trim() ? "normal" : "italic",
              }}
            >
              {message.trim() || "Aquí aparecerá el texto de tu notificación en la pantalla del celular..."}
            </div>
          </div>
        </Card>

        {/* Opciones avanzadas colapsables (opcional) */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: "none",
              border: "none",
              padding: "0.25rem 0",
              cursor: "pointer",
              fontSize: "0.8125rem",
              color: "var(--muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
            }}
          >
            <Gear size={15} weight="bold" />
            <span>{showAdvanced ? "Ocultar opciones avanzadas" : "Opciones avanzadas (enlace a sección específica)"}</span>
          </button>

          {showAdvanced && (
            <div
              style={{
                marginTop: "0.5rem",
                padding: "1rem",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <Input
                label="Ruta o sección interna al pulsar (opcional)"
                placeholder="Ej. /vacaciones o /documentos-personales"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Si se especifica, al pulsar la notificación en Android se abrirá directamente esa pantalla. Si se deja vacío, abrirá la aplicación normalmente.
              </span>
            </div>
          )}
        </div>

        {/* PASO 4: Botón Enviar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={pending}
            disabled={pending || !message.trim()}
            style={{ width: "100%", justifyContent: "center", fontWeight: 700 }}
          >
            <PaperPlaneTilt size={20} weight="bold" style={{ marginRight: "0.5rem" }} />
            {pending ? "Enviando alerta a dispositivos..." : "Enviar Alerta Push Ahora"}
          </Button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--muted)" }}>
            <span>Operador: <strong>{userEmail}</strong></span>
            <span>Entrega inmediata vía Firebase FCM</span>
          </div>
        </div>
      </form>
    </div>
  )
}
