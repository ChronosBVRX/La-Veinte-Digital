"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { RadarTopic, RadarStatus, RadarCategory, CalendarDayEvaluation } from "../types"
import { scanRadarAction, updateTopicStatusAction, dispatchCalendarPushAction } from "../actions/radar-actions"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { PageHeader } from "@/shared/components/app/PageHeader"
import {
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  CalendarCheck,
  Bell,
  ArrowsClockwise,
  ArrowUpRight,
  Megaphone,
  WarningCircle,
  Bank,
  Sparkle,
  DeviceMobile,
  Check,
  Funnel,
  ShieldCheck,
} from "@phosphor-icons/react"

interface RadarDashboardProps {
  initialTopics: RadarTopic[]
  todayEvaluation: CalendarDayEvaluation
  upcomingEvaluations: CalendarDayEvaluation[]
}

const CATEGORY_LABELS: Record<RadarCategory, string> = {
  NOMINA: "Nómina y Estímulos",
  ESCALAFON: "Escalafón y Plazas",
  PRESTACIONES: "Prestaciones",
  SALUD_RIESGO: "Salud y Riesgo",
  CLIMA_LABORAL: "Clima Laboral",
  NORMATIVA: "Normativa / CCT",
  OTRO: "General",
}

const CATEGORY_COLORS: Record<RadarCategory, { bg: string; fg: string }> = {
  NOMINA: { bg: "rgba(16, 185, 129, 0.12)", fg: "#059669" },
  ESCALAFON: { bg: "rgba(59, 130, 246, 0.12)", fg: "#2563eb" },
  PRESTACIONES: { bg: "rgba(168, 85, 247, 0.12)", fg: "#9333ea" },
  SALUD_RIESGO: { bg: "rgba(249, 115, 22, 0.12)", fg: "#ea580c" },
  CLIMA_LABORAL: { bg: "rgba(234, 179, 8, 0.15)", fg: "#ca8a04" },
  NORMATIVA: { bg: "rgba(99, 102, 241, 0.12)", fg: "#4f46e5" },
  OTRO: { bg: "rgba(100, 116, 139, 0.12)", fg: "#475569" },
}

export function RadarDashboard({
  initialTopics,
  todayEvaluation,
  upcomingEvaluations,
}: RadarDashboardProps) {
  const [activeTab, setActiveTab] = useState<"radar" | "calendario">("radar")
  const [topics, setTopics] = useState<RadarTopic[]>(initialTopics)
  const [statusFilter, setStatusFilter] = useState<RadarStatus | "ALL">("ALL")
  const [categoryFilter, setCategoryFilter] = useState<RadarCategory | "ALL">("ALL")
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Conteo de métricas
  const totalCount = topics.length
  const pendingCount = topics.filter((t) => t.status === "PENDING").length
  const approvedCount = topics.filter((t) => t.status === "APPROVED").length
  const rejectedCount = topics.filter((t) => t.status === "REJECTED").length

  // Filtrado de temas
  const filteredTopics = topics.filter((topic) => {
    if (statusFilter !== "ALL" && topic.status !== statusFilter) return false
    if (categoryFilter !== "ALL" && topic.category !== categoryFilter) return false
    return true
  })

  // Acción: Escanear fuentes
  const handleScan = () => {
    setFeedback(null)
    startTransition(async () => {
      const res = await scanRadarAction()
      if (res.ok) {
        setFeedback({ message: res.message || "Escaneo completado.", type: "success" })
        // En una app real revalidatePath actualiza el server component, pero sincronizamos estado local
        window.location.reload()
      } else {
        setFeedback({ message: res.error || "Error al escanear fuentes.", type: "error" })
      }
    })
  }

  // Acción: Cambiar estado de un tema
  const handleUpdateStatus = (topicId: string, newStatus: RadarStatus) => {
    setFeedback(null)
    startTransition(async () => {
      const res = await updateTopicStatusAction(topicId, newStatus)
      if (res.ok) {
        setTopics((prev) =>
          prev.map((t) => (t.id === topicId ? { ...t, status: newStatus } : t))
        )
        setFeedback({
          message: newStatus === "APPROVED" ? "Tema aprobado (pasa)." : "Tema descartado (no pasa).",
          type: "success",
        })
      } else {
        setFeedback({ message: res.error || "Error al actualizar tema.", type: "error" })
      }
    })
  }

  // Acción: Enviar Push de calendario
  const handleSendCalendarPush = (isTest = false) => {
    setFeedback(null)
    const formData = new FormData()
    formData.append("isTest", isTest ? "true" : "false")
    formData.append("targetDate", todayEvaluation.date)

    startTransition(async () => {
      const res = await dispatchCalendarPushAction(undefined, formData)
      if (res.ok) {
        setFeedback({ message: res.message || "Notificación enviada correctamente.", type: "success" })
      } else {
        setFeedback({ message: res.error || "Error al despachar notificación.", type: "error" })
      }
    })
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Encabezado Principal */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
        <PageHeader
          eyebrow="Administración Inteligente"
          title="Radar Laboral & Notificaciones de Calendario"
          description="Escucha activa de temas de interés sindical con IA y control automatizado de alertas de pago bancario, vacaciones e interactivo."
        />
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {activeTab === "radar" && (
            <Button variant="primary" size="md" onClick={handleScan} loading={isPending}>
              <ArrowsClockwise size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
              Escanear Fuentes Ahora
            </Button>
          )}
        </div>
      </div>

      {/* Banner de Feedback */}
      {feedback && (
        <Card
          padding="1rem"
          style={{
            borderLeft: `4px solid ${feedback.type === "success" ? "#059669" : "#dc2626"}`,
            background: feedback.type === "success" ? "rgba(16, 185, 129, 0.08)" : "rgba(220, 38, 38, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {feedback.type === "success" ? (
              <CheckCircle size={20} weight="fill" color="#059669" />
            ) : (
              <WarningCircle size={20} weight="fill" color="#dc2626" />
            )}
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>
              {feedback.message}
            </span>
          </div>
        </Card>
      )}

      {/* Selector de Pestañas Principales */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        <button
          onClick={() => setActiveTab("radar")}
          style={{
            padding: "0.625rem 1.25rem",
            borderRadius: "0.5rem",
            fontSize: "0.9375rem",
            fontWeight: 700,
            cursor: "pointer",
            border: "none",
            background: activeTab === "radar" ? "var(--primary)" : "transparent",
            color: activeTab === "radar" ? "#ffffff" : "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.15s ease",
          }}
        >
          <MagnifyingGlass size={18} weight="bold" />
          Radar de Temas ({totalCount})
        </button>

        <button
          onClick={() => setActiveTab("calendario")}
          style={{
            padding: "0.625rem 1.25rem",
            borderRadius: "0.5rem",
            fontSize: "0.9375rem",
            fontWeight: 700,
            cursor: "pointer",
            border: "none",
            background: activeTab === "calendario" ? "var(--primary)" : "transparent",
            color: activeTab === "calendario" ? "#ffffff" : "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.15s ease",
          }}
        >
          <CalendarCheck size={18} weight="bold" />
          Alertas de Calendario
          {todayEvaluation.hasEvents && (
            <span
              style={{
                background: activeTab === "calendario" ? "#ffffff" : "#ef4444",
                color: activeTab === "calendario" ? "var(--primary)" : "#ffffff",
                fontSize: "0.6875rem",
                fontWeight: 800,
                padding: "0.1rem 0.4rem",
                borderRadius: "999px",
              }}
            >
              {todayEvaluation.alerts.length} HOY
            </span>
          )}
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          PESTAÑA 1: RADAR DE TEMAS
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "radar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Métricas del Radar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
            <Card padding="1rem">
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Total Detectados
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--fg)", marginTop: "0.25rem" }}>
                {totalCount}
              </div>
            </Card>

            <Card padding="1rem">
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#d97706", textTransform: "uppercase" }}>
                Pendientes (Por revisar)
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#d97706", marginTop: "0.25rem" }}>
                {pendingCount}
              </div>
            </Card>

            <Card padding="1rem">
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#059669", textTransform: "uppercase" }}>
                Aprobados (Pasan)
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669", marginTop: "0.25rem" }}>
                {approvedCount}
              </div>
            </Card>

            <Card padding="1rem">
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>
                Descartados (No pasan)
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--muted)", marginTop: "0.25rem" }}>
                {rejectedCount}
              </div>
            </Card>
          </div>

          {/* Filtros de Estado y Categoría */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", justifyContent: "space-between" }}>
            {/* Filtro Estado */}
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
              {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((st) => {
                const label = st === "ALL" ? "Todos" : st === "PENDING" ? "Pendientes" : st === "APPROVED" ? "Aprobados" : "Descartados"
                const active = statusFilter === st
                return (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    style={{
                      padding: "0.4rem 0.75rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.8125rem",
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                      background: active ? "rgba(37, 99, 235, 0.08)" : "var(--card)",
                      color: active ? "var(--primary)" : "var(--fg)",
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {/* Filtro Categoría */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Funnel size={16} color="var(--muted)" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as RadarCategory | "ALL")}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--fg)",
                }}
              >
                <option value="ALL">Todas las Categorías</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de Temas */}
          {filteredTopics.length === 0 ? (
            <Card padding="2rem" style={{ textAlign: "center" }}>
              <MagnifyingGlass size={36} color="var(--muted)" style={{ margin: "0 auto 0.75rem" }} />
              <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                No se encontraron temas con estos filtros
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
                Haz clic en &quot;Escanear Fuentes Ahora&quot; para buscar nuevas conversaciones públicas.
              </p>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {filteredTopics.map((topic) => {
                const catColor = CATEGORY_COLORS[topic.category] || CATEGORY_COLORS.OTRO
                const isApproved = topic.status === "APPROVED"
                const isRejected = topic.status === "REJECTED"

                return (
                  <Card key={topic.id} padding="1.25rem">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      {/* Cabecera de la tarjeta */}
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                          {/* Categoría */}
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "0.25rem",
                              background: catColor.bg,
                              color: catColor.fg,
                              textTransform: "uppercase",
                            }}
                          >
                            {CATEGORY_LABELS[topic.category]}
                          </span>

                          {/* Relevancia */}
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 800,
                              padding: "0.2rem 0.5rem",
                              borderRadius: "0.25rem",
                              background:
                                topic.relevanceScore >= 80
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : topic.relevanceScore >= 60
                                  ? "rgba(59, 130, 246, 0.15)"
                                  : "rgba(100, 116, 139, 0.15)",
                              color:
                                topic.relevanceScore >= 80
                                  ? "#059669"
                                  : topic.relevanceScore >= 60
                                  ? "#2563eb"
                                  : "#64748b",
                            }}
                          >
                            RELEVANCIA {topic.relevanceScore}/100
                          </span>

                          {/* Cláusula CCT relacionada */}
                          {topic.relatedClause && (
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                fontWeight: 600,
                                padding: "0.2rem 0.5rem",
                                borderRadius: "0.25rem",
                                background: "rgba(99, 102, 241, 0.1)",
                                color: "#4f46e5",
                              }}
                            >
                              {topic.relatedClause}
                            </span>
                          )}
                        </div>

                        {/* Fuente y enlace */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                          <span>{topic.source}</span>
                          <span>·</span>
                          <a
                            href={topic.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--primary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                          >
                            Abrir fuente <ArrowUpRight size={14} />
                          </a>
                        </div>
                      </div>

                      {/* Título de la noticia / publicación */}
                      <div>
                        <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "0 0 0.375rem", color: "var(--fg)" }}>
                          {topic.title}
                        </h3>
                        {topic.snippet && (
                          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0, lineHeight: 1.4 }}>
                            {topic.snippet}
                          </p>
                        )}
                      </div>

                      {/* Caja de Evaluación con IA (Tema clave & Justificación) */}
                      <div
                        style={{
                          background: "var(--accent)",
                          borderRadius: "0.5rem",
                          padding: "0.75rem 1rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.25rem",
                          fontSize: "0.8125rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--fg)", fontWeight: 700 }}>
                          <Sparkle size={16} weight="fill" color="#9333ea" />
                          <span>Punto Clave para el Trabajador:</span>
                        </div>
                        <div style={{ color: "var(--fg)", lineHeight: 1.35 }}>
                          {topic.keyTopic}
                        </div>
                        {topic.justification && (
                          <div style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                            {topic.justification}
                          </div>
                        )}
                      </div>

                      {/* Barra de Acciones de Moderación: ¿Pasa o No Pasa? */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          paddingTop: "0.5rem",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        {/* Estado actual */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)" }}>
                            Estado:
                          </span>
                          {isApproved && (
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#059669", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <CheckCircle size={16} weight="fill" /> Aprobado (Pasa a la base)
                            </span>
                          )}
                          {isRejected && (
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#dc2626", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <XCircle size={16} weight="fill" /> Descartado (No pasa)
                            </span>
                          )}
                          {!isApproved && !isRejected && (
                            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#d97706" }}>
                              Pendiente de moderación
                            </span>
                          )}
                        </div>

                        {/* Botones de acción */}
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                          {!isApproved && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleUpdateStatus(topic.id, "APPROVED")}
                              disabled={isPending}
                            >
                              <Check size={16} weight="bold" style={{ marginRight: "0.25rem" }} />
                              Aprobar (Pasa)
                            </Button>
                          )}

                          {!isRejected && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStatus(topic.id, "REJECTED")}
                              disabled={isPending}
                            >
                              <XCircle size={16} weight="bold" style={{ marginRight: "0.25rem" }} />
                              Descartar (No pasa)
                            </Button>
                          )}

                          {isApproved && (
                            <>
                              <Link
                                href={`/admin/avisos/nuevo?title=${encodeURIComponent(topic.title)}&body=${encodeURIComponent(topic.snippet || topic.keyTopic)}`}
                                style={{ textDecoration: "none" }}
                              >
                                <Button variant="secondary" size="sm">
                                  <Megaphone size={16} weight="bold" style={{ marginRight: "0.25rem" }} />
                                  Crear Aviso Oficial
                                </Button>
                              </Link>
                              <Link
                                href={`/admin/push?title=${encodeURIComponent(topic.title)}&body=${encodeURIComponent(topic.keyTopic)}`}
                                style={{ textDecoration: "none" }}
                              >
                                <Button variant="secondary" size="sm">
                                  <Bell size={16} weight="bold" style={{ marginRight: "0.25rem" }} />
                                  Enviar Push
                                </Button>
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PESTAÑA 2: NOTIFICACIONES DE CALENDARIO (BANCOS, VACACIONES, INTERACTIVO)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "calendario" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Tarjeta de Eventos de HOY */}
          <Card
            padding="1.5rem"
            style={{
              border: todayEvaluation.hasEvents ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border)",
              background: todayEvaluation.hasEvents
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0.01) 100%)"
                : "var(--card)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      padding: "0.2rem 0.5rem",
                      borderRadius: "0.25rem",
                      background: todayEvaluation.hasEvents ? "#059669" : "var(--muted)",
                      color: "#ffffff",
                      textTransform: "uppercase",
                    }}
                  >
                    {todayEvaluation.hasEvents ? "Hitos Detectados Hoy" : "Sin eventos hoy"}
                  </span>
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
                    Fecha actual en México: {todayEvaluation.date}
                  </span>
                </div>
              </div>

              {todayEvaluation.hasEvents ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {todayEvaluation.alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: "0.75rem",
                        alignItems: "flex-start",
                        background: "var(--card)",
                        padding: "0.875rem 1rem",
                        borderRadius: "0.5rem",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        style={{
                          background: alert.kind.startsWith("pago") ? "rgba(16, 185, 129, 0.15)" : "rgba(234, 179, 8, 0.15)",
                          color: alert.kind.startsWith("pago") ? "#059669" : "#d97706",
                          padding: "0.5rem",
                          borderRadius: "0.5rem",
                          display: "flex",
                          flexShrink: 0,
                        }}
                      >
                        {alert.kind.startsWith("pago") ? <Bank size={24} weight="duotone" /> : <CalendarCheck size={24} weight="duotone" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
                            {alert.title}
                          </h4>
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.4rem",
                              borderRadius: "0.25rem",
                              background: "rgba(37, 99, 235, 0.1)",
                              color: "var(--primary)",
                            }}
                          >
                            {alert.badge}
                          </span>
                        </div>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Previsualización del Push */}
                  {todayEvaluation.pushPayload && (
                    <div
                      style={{
                        background: "var(--accent)",
                        borderRadius: "0.625rem",
                        padding: "1rem",
                        border: "1px dashed var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.375rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)" }}>
                        <DeviceMobile size={16} weight="bold" />
                        <span>Vista previa del mensaje Push que llegará a los teléfonos:</span>
                      </div>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--fg)" }}>
                        🔔 {todayEvaluation.pushPayload.title}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--fg)", whiteSpace: "pre-line", lineHeight: 1.4 }}>
                        {todayEvaluation.pushPayload.body}
                      </div>
                    </div>
                  )}

                  {/* Botones de Despacho Manual */}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => handleSendCalendarPush(false)}
                      disabled={isPending}
                    >
                      <Bell size={18} weight="bold" style={{ marginRight: "0.5rem" }} />
                      Despachar Notificación Push del Día a Todos
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleSendCalendarPush(true)}
                      disabled={isPending}
                    >
                      Enviar Notificación de Prueba a mi Teléfono
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "0.875rem", color: "var(--muted)" }}>
                  Hoy no corresponde pago en ningún banco, ni inicio de vacaciones, ni inicio/término de rol interactivo.
                  Revisa la lista de los próximos días a continuación.
                </div>
              )}
            </div>
          </Card>

          {/* Información del Sistema Automatizado de Notificaciones */}
          <Card padding="1.25rem">
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <div style={{ background: "rgba(37, 99, 235, 0.1)", color: "var(--primary)", padding: "0.5rem", borderRadius: "0.5rem", display: "flex" }}>
                <ShieldCheck size={24} weight="duotone" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
                  Automatización Matutina Diaria
                </h3>
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.45 }}>
                  El cron matutino de La Veinte Digital consulta diariamente el calendario laboral a las <strong>08:00 AM (CDMX)</strong> vía <code>/api/cron/calendar-reminders</code>.
                  Si detecta dispersión en bancos (Santander, BBVA, Banamex, cheque, jubilados), inicio de vacaciones o inicio/fin de interactivo, <strong>despacha la notificación automáticamente de forma idempotente</strong> (máximo 1 envío por día para evitar duplicados).
                </p>
              </div>
            </div>
          </Card>

          {/* Próximos Eventos de Nómina y Rol Interactivo (Siguientes 14 Días) */}
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--fg)" }}>
              Próximas Fechas Programadas (Siguientes 14 Días)
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {upcomingEvaluations.length === 0 ? (
                <Card padding="1.25rem">
                  <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                    No hay eventos de nómina ni vacaciones en los próximos 14 días.
                  </span>
                </Card>
              ) : (
                upcomingEvaluations.map((ev) => (
                  <Card key={ev.date} padding="0.875rem 1.25rem">
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--primary)", minWidth: "90px" }}>
                          {ev.date}
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                          {ev.alerts.map((a, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                padding: "0.15rem 0.45rem",
                                borderRadius: "0.25rem",
                                background: a.kind.startsWith("pago")
                                  ? "rgba(16, 185, 129, 0.12)"
                                  : a.kind.includes("vacaciones")
                                  ? "rgba(168, 85, 247, 0.12)"
                                  : "rgba(234, 179, 8, 0.15)",
                                color: a.kind.startsWith("pago")
                                  ? "#059669"
                                  : a.kind.includes("vacaciones")
                                  ? "#9333ea"
                                  : "#ca8a04",
                              }}
                            >
                              {a.title}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Programado para envío automático a las 08:00 AM
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
