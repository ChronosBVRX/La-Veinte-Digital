"use client"

import { useState, useEffect, useCallback, type CSSProperties } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { getAllCalendars, publishCalendar } from "../services/calendar-service"

const CONTAINER: CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "1rem",
}

const HEADER: CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  marginBottom: "1.5rem",
}

const TAB_BAR: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  marginBottom: "1.5rem",
  borderBottom: "1px solid var(--border)",
  paddingBottom: "0.5rem",
}

type Tab = "calendars" | "rules" | "conflicts"

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("calendars")

  return (
    <div style={CONTAINER}>
      <h1 style={HEADER}>Administración de Vacaciones</h1>

      <div style={TAB_BAR}>
        <Button
          variant={activeTab === "calendars" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("calendars")}
        >
          Calendarios
        </Button>
        <Button
          variant={activeTab === "rules" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("rules")}
        >
          Reglas
        </Button>
        <Button
          variant={activeTab === "conflicts" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("conflicts")}
        >
          Conflictos
        </Button>
      </div>

      {activeTab === "calendars" && <CalendarManager />}
      {activeTab === "rules" && <RuleManager />}
      {activeTab === "conflicts" && <ConflictViewer />}
    </div>
  )
}

function CalendarManager() {
  const [calendars, setCalendars] = useState<import("../domain/types").AnnualVacationCalendar[]>([])
  const [loading, setLoading] = useState(true)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const supabase = createClient()

  const reloadCalendars = useCallback(async () => {
    try {
      const list = await getAllCalendars(supabase)
      setCalendars(list)
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Error al cargar calendarios", error: true })
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    getAllCalendars(supabase)
      .then((list) => {
        if (active) {
          setCalendars(list)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setMessage({ text: err instanceof Error ? err.message : "Error al cargar calendarios", error: true })
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [supabase])

  async function handlePublish(cal: import("../domain/types").AnnualVacationCalendar) {
    const missingEndDates = cal.roles.filter((r) => r.enabled && !r.endDate)
    if (missingEndDates.length > 0) {
      setMessage({
        text: `No se puede publicar el calendario: ${missingEndDates.length} rol(es) no tienen fecha de término (end_date).`,
        error: true,
      })
      return
    }

    setPublishingId(cal.id)
    setMessage(null)
    try {
      const res = await publishCalendar(supabase, cal.id)
      if (res.success) {
        setMessage({ text: `Calendario ${cal.year} (${cal.version}) publicado con éxito.` })
        await reloadCalendars()
      } else {
        setMessage({ text: res.error || "Error al publicar calendario", error: true })
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Error desconocido al publicar", error: true })
    } finally {
      setPublishingId(null)
    }
  }

  return (
    <div>
      <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: "var(--radius)", padding: "0.75rem 1rem", fontSize: "0.85rem", color: "#92400e", marginBottom: "1rem" }}>
        <strong>⚠️ Política de Integridad Normativa:</strong> No cargar ni publicar la tabla 2026 como si fuera el calendario oficial 2027. Los roles 2027 deben ser emitidos por la Comisión Mixta oficial antes de su publicación.
      </div>

      {message && (
        <div style={{
          background: message.error ? "#fee2e2" : "#f0fdf4",
          border: `1px solid ${message.error ? "#ef4444" : "#22c55e"}`,
          borderRadius: "var(--radius)",
          padding: "0.75rem 1rem",
          fontSize: "0.85rem",
          color: message.error ? "#991b1b" : "#166534",
          marginBottom: "1rem",
        }}>
          {message.text}
        </div>
      )}

      <Card padding="1.25rem" style={{ marginBottom: "1rem" }}>
        <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Calendarios del Sistema</h3>
        {loading ? (
          <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Cargando calendarios...</p>
        ) : calendars.length === 0 ? (
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            <p>No hay calendarios registrados en el sistema.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {calendars.map((c) => {
              const missingEndDates = c.roles.filter((r) => r.enabled && !r.endDate)
              const hasRoles = c.roles.length > 0
              const canPublish = c.status !== "PUBLISHED" && hasRoles && missingEndDates.length === 0

              return (
                <div
                  key={c.id}
                  style={{
                    padding: "1rem",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "1rem", marginRight: "0.5rem" }}>
                        Año {c.year} — {c.version}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          fontWeight: 600,
                          background: c.status === "PUBLISHED" ? "#dcfce7" : "#fef3c7",
                          color: c.status === "PUBLISHED" ? "#166534" : "#92400e",
                        }}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.status !== "PUBLISHED" && (
                      <Button
                        size="sm"
                        disabled={!canPublish || publishingId === c.id}
                        loading={publishingId === c.id}
                        onClick={() => handlePublish(c)}
                      >
                        Publicar calendario
                      </Button>
                    )}
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
                    Fuente: {c.sourceName} | Roles: {c.roles.length}
                    {c.publishedAt && ` | Publicado: ${new Date(c.publishedAt).toLocaleDateString("es-MX")}`}
                  </div>

                  {missingEndDates.length > 0 && c.status !== "PUBLISHED" && (
                    <div style={{ fontSize: "0.78rem", color: "#b91c1c", marginTop: "0.25rem", marginBottom: "0.5rem" }}>
                      ⚠️ Bloqueo de publicación: {missingEndDates.length} rol(es) no tienen fecha de término (end_date). Todos los roles deben tener fecha de término antes de publicar.
                    </div>
                  )}

                  {c.roles.length > 0 && (
                    <details style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                      <summary style={{ cursor: "pointer", color: "var(--primary)" }}>
                        Ver {c.roles.length} roles del calendario
                      </summary>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem", marginTop: "0.5rem" }}>
                        {c.roles.map((r) => (
                          <div key={r.id || r.roleNumber} style={{ padding: "0.5rem", background: "var(--accent)", borderRadius: "var(--radius-sm)" }}>
                            <div style={{ fontWeight: 600 }}>
                              Rol #{r.roleNumber} {r.roleGroup ? `(Grupo ${r.roleGroup})` : ""}
                            </div>
                            <div>Inicio: {r.startDate}</div>
                            <div>Término: {r.endDate || <span style={{ color: "#b91c1c" }}>Sin término</span>}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function RuleManager() {
  return (
    <Card padding="1.25rem">
      <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Reglas Configurables</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <RuleItem
          code="CCT_47_ANNUAL_DAYS"
          label="Días anuales CCT"
          source="CCT 2025-2027 - Cláusula 47"
          enabled
        />
        <RuleItem
          code="PROC_ANTICIPACION_SEMESTRAL"
          label="Anticipación semestral (máx. 120 días)"
          source="Procedimiento 1A74-003-025"
          enabled
        />
        <RuleItem
          code="PROC_ANTICIPACION_CUATRIMESTRAL"
          label="Anticipación cuatrimestral (máx. 105 días)"
          source="Procedimiento 1A74-003-025"
          enabled
        />
        <RuleItem
          code="PROC_V20_NO_FRACTION"
          label="V20 - Sin fraccionamiento"
          source="Procedimiento 1A74-003-025 - Anexo 2"
          enabled
        />
      </div>
    </Card>
  )
}

function RuleItem({ code, label, source, enabled }: { code: string; label: string; source: string; enabled: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "0.5rem 0.75rem", borderRadius: "var(--radius)",
      background: "var(--accent)",
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{code} — {source}</div>
      </div>
      <div style={{
        padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)",
        fontSize: "0.7rem", fontWeight: 600,
        background: enabled ? "#dcfce7" : "#fef3c7",
        color: enabled ? "#166534" : "#92400e",
      }}>
        {enabled ? "Activa" : "Inactiva"}
      </div>
    </div>
  )
}

function ConflictViewer() {
  return (
    <Card padding="1.25rem">
      <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Conflictos Normativos Detectados</h3>
      <div style={{ padding: "1rem", background: "var(--accent)", borderRadius: "var(--radius)", fontSize: "0.85rem", color: "var(--muted)" }}>
        <p><strong>Conflicto conocido:</strong> CCT 2025-2027 establece mínimo 16 días hábiles. Algunas filas del Anexo 1 muestran rangos desde 15 días.</p>
        <p style={{ marginTop: "0.5rem" }}>
          <strong>Resolución:</strong> El sistema utiliza los valores del CCT vigente para el derecho sustantivo.
          Las tablas administrativas se conservan como metadato operativo.
        </p>
      </div>
    </Card>
  )
}
