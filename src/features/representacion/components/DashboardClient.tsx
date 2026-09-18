"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import {
  Users,
  Folder,
  Lockers,
  FileText,
  Baby,
  Drop,
  Ticket,
  ShieldCheck,
  Printer,
  Plus,
  ArrowRight,
  ArrowsClockwise,
  Warning,
  CheckCircle,
} from "@phosphor-icons/react";
import { Card } from "@/shared/components/ui/Card";
import { DashboardQuickSearch } from "./DashboardQuickSearch";
import type { UnionDashboardSummary } from "../lib/dashboard-format";

export interface DashboardClientProps {
  initialData?: UnionDashboardSummary | null;
  isAdmin?: boolean;
}

export function DashboardClient({ initialData = null, isAdmin = false }: DashboardClientProps): React.JSX.Element {
  const [data, setData] = useState<UnionDashboardSummary | null>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/union/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudo actualizar el tablero");
      const json = (await res.json()) as UnionDashboardSummary;
      setData(json);
    } catch {
      setError("No se pudo actualizar la información más reciente.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Si no se proporcionó initialData, cargar en cliente
  useEffect(() => {
    if (!initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount
      void refreshDashboard();
    }
  }, [initialData, refreshDashboard]);

  // Si hay error severo y no hay datos previos
  if (error && !data) {
    return (
      <Card padding="1.5rem">
        <div style={{ textAlign: "center", padding: "1rem" }}>
          <Warning size={32} weight="bold" style={{ color: "var(--primary)", marginBottom: "0.5rem" }} />
          <p role="alert" style={{ margin: "0 0 1rem", fontSize: "0.9375rem", color: "var(--fg)" }}>
            {error}
          </p>
          <button
            type="button"
            onClick={() => void refreshDashboard()}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--primary)",
              color: "var(--primary-fg, #fff)",
              border: "none",
              borderRadius: "var(--radius, 0.375rem)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </Card>
    );
  }

  // Si sigue cargando y no hay datos
  if (!data) {
    return (
      <div style={{ padding: "2rem 0", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ height: "48px", background: "var(--accent)", borderRadius: "var(--radius-lg, 0.75rem)", animation: "pulse 1.5s infinite" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{ height: "88px", background: "var(--accent)", borderRadius: "var(--radius-lg, 0.75rem)", animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  const { metrics, attentionItems, recentActivity, delegation } = data;

  // Módulos operacionales ("¿Qué quieres hacer?")
  const modules = [
    {
      id: "licencias",
      title: "Licencias",
      desc: "Crea, continúa, edita e imprime solicitudes de licencia.",
      href: "/representacion/licencias",
      icon: FileText,
      quickAction: {
        label: "Nueva",
        href: "/representacion/licencias?action=new",
      },
    },
    {
      id: "maternidad",
      title: "Maternidad",
      desc: "Calcula periodos, registra casos y genera documentación.",
      href: "/representacion/maternidad",
      icon: Baby,
    },
    {
      id: "lactancia",
      title: "Lactancia",
      desc: "Consulta periodos y administra solicitudes de lactancia.",
      href: "/representacion/lactancia",
      icon: Drop,
    },
    {
      id: "pasajes",
      title: "Pasajes",
      desc: "Gestiona solicitudes y formatos de pasajes (Cl. 103).",
      href: "/representacion/pasajes",
      icon: Ticket,
    },
    {
      id: "lockers",
      title: "Lockers",
      desc: "Consulta disponibilidad, asigna y libera lockers.",
      href: "/representacion/lockers",
      icon: Lockers,
      badge: metrics.lockers.available !== null ? `${metrics.lockers.available} disponibles` : undefined,
    },
    {
      id: "trabajadores",
      title: "Trabajadores",
      desc: "Consulta y administra el padrón de trabajadores.",
      href: "/representacion/trabajadores",
      icon: Users,
      badge: metrics.workers.total !== null ? `${metrics.workers.total} registrados` : undefined,
    },
    {
      id: "expedientes",
      title: "Expedientes",
      desc: "Consulta expedientes y antecedentes de representación.",
      href: "/representacion/expedientes",
      icon: Folder,
    },
    {
      id: "impresion",
      title: "Impresión",
      desc: "Cola de impresión automática y estación de oficina.",
      href: "/representacion/impresion",
      icon: Printer,
      badge: metrics.print?.hasStation
        ? metrics.print.isOnline
          ? (metrics.print.queuedCount + metrics.print.printingCount) > 0
            ? `${metrics.print.queuedCount} en cola`
            : "● En línea"
          : "⚠ Desconectada"
        : undefined,
    },
    ...(isAdmin
      ? [
          {
            id: "administracion",
            title: "Administración",
            desc: "Comité XXI, miembros y auditoría del sistema.",
            href: "/representacion/administracion",
            icon: ShieldCheck,
            badge: "Admin",
          },
        ]
      : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* 1. ENCABEZADO Y BUSCADOR RÁPIDO */}
      <Card padding="1.25rem 1.5rem">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                color: "var(--primary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {delegation.section || "SNTSS · SECCIÓN XX MICHOACÁN"}
            </div>
            <h1
              style={{
                margin: "0.25rem 0",
                fontSize: "1.625rem",
                fontWeight: 800,
                color: "var(--fg)",
                letterSpacing: "-0.02em",
              }}
            >
              Centro de Representación Sindical
            </h1>
            <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--muted)" }}>
              {delegation.name} · {delegation.facility} · Consulta la situación de la delegación y accede rápidamente a tus herramientas de representación.
            </p>
          </div>

          {/* Buscador unificado */}
          <div style={{ marginTop: "0.25rem" }}>
            <DashboardQuickSearch />
          </div>
        </div>
      </Card>

      {/* 2. FRANJA DE INFORMACIÓN GENERAL ("SITUACIÓN ACTUAL") */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
            padding: "0 0.25rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--fg)" }}>
            Situación actual
          </h2>
          <button
            type="button"
            aria-label="Actualizar métricas"
            onClick={() => void refreshDashboard()}
            disabled={refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              fontSize: "0.8125rem",
              cursor: refreshing ? "default" : "pointer",
              padding: "0.25rem 0.5rem",
              borderRadius: "var(--radius, 0.375rem)",
            }}
          >
            <ArrowsClockwise
              size={14}
              weight="bold"
              className={refreshing ? "animate-spin" : undefined}
            />
            <span>{refreshing ? "Actualizando…" : "Actualizar"}</span>
          </button>
        </div>

        {/* Tarjetas de métricas responsivas */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {/* Métricas: Trabajadores */}
          <Link
            href="/representacion/trabajadores"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Card
              padding="0.875rem 1rem"
              style={{
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted)" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Trabajadores
                </span>
                <Users size={18} weight="bold" style={{ color: "var(--primary)" }} />
              </div>
              <div style={{ margin: "0.5rem 0 0.25rem" }}>
                <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1 }}>
                  {metrics.workers.error ? "No disponible" : (metrics.workers.total ?? 0)}
                </div>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                {!metrics.workers.error && metrics.workers.active !== null ? (
                  <>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                    <span>{metrics.workers.active} activos</span>
                  </>
                ) : (
                  <span>Registrados en padrón</span>
                )}
              </div>
            </Card>
          </Link>

          {/* Métricas: Expedientes */}
          <Link
            href="/representacion/expedientes"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Card
              padding="0.875rem 1rem"
              style={{
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted)" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Expedientes
                </span>
                <Folder size={18} weight="bold" style={{ color: "var(--primary)" }} />
              </div>
              <div style={{ margin: "0.5rem 0 0.25rem" }}>
                <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1 }}>
                  {metrics.cases.error ? "No disponible" : (metrics.cases.total ?? 0)}
                </div>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                Historial institucional
              </div>
            </Card>
          </Link>

          {/* Métricas: Lockers */}
          <Link
            href="/representacion/lockers"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Card
              padding="0.875rem 1rem"
              style={{
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted)" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Lockers
                </span>
                <Lockers size={18} weight="bold" style={{ color: "var(--primary)" }} />
              </div>
              <div style={{ margin: "0.5rem 0 0.25rem" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1.1 }}>
                  {metrics.lockers.error
                    ? "No disponible"
                    : `${metrics.lockers.assigned ?? 0} de ${metrics.lockers.total ?? 0} asignados`}
                </div>
                {/* Barra sutil de ocupación */}
                {!metrics.lockers.error && metrics.lockers.occupancyPercentage !== null ? (
                  <div
                    style={{
                      width: "100%",
                      height: "5px",
                      background: "var(--accent, #e2e8f0)",
                      borderRadius: "999px",
                      marginTop: "0.375rem",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, metrics.lockers.occupancyPercentage)}%`,
                        height: "100%",
                        background: metrics.lockers.occupancyPercentage > 90 ? "#eab308" : "var(--primary)",
                        borderRadius: "999px",
                      }}
                    />
                  </div>
                ) : null}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
                <span>{metrics.lockers.available ?? 0} disponibles</span>
                {metrics.lockers.occupancyPercentage !== null ? (
                  <span>{metrics.lockers.occupancyPercentage}%</span>
                ) : null}
              </div>
            </Card>
          </Link>

          {/* Métricas: Trámites en proceso */}
          <Link
            href="/representacion/expedientes"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Card
              padding="0.875rem 1rem"
              style={{
                height: "100%",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                cursor: "pointer",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted)" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Trámites en proceso
                </span>
                <FileText size={18} weight="bold" style={{ color: "var(--primary)" }} />
              </div>
              <div style={{ margin: "0.5rem 0 0.25rem" }}>
                <div style={{ fontSize: "1.625rem", fontWeight: 800, color: "var(--fg)", lineHeight: 1 }}>
                  {metrics.procedures.error ? "No disponible" : (metrics.procedures.inProgress ?? 0)}
                </div>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {metrics.procedures.drafts ?? 0} borradores · {metrics.procedures.underReview ?? 0} en revisión
              </div>
            </Card>
          </Link>

          {/* Métricas: Requieren atención */}
          <Card
            padding="0.875rem 1rem"
            style={{
              height: "100%",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderLeft: metrics.attentionCount > 0 ? "4px solid #b45309" : "1px solid var(--border)",
              background: metrics.attentionCount > 0 ? "rgba(245, 158, 11, 0.04)" : "var(--card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: "var(--muted)" }}>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: metrics.attentionCount > 0 ? "#b45309" : "var(--muted)",
                }}
              >
                Pendientes
              </span>
              {metrics.attentionCount > 0 ? (
                <Warning size={18} weight="bold" style={{ color: "#b45309" }} />
              ) : (
                <CheckCircle size={18} weight="bold" style={{ color: "#16a34a" }} />
              )}
            </div>
            <div style={{ margin: "0.5rem 0 0.25rem" }}>
              <div
                style={{
                  fontSize: "1.625rem",
                  fontWeight: 800,
                  color: metrics.attentionCount > 0 ? "#b45309" : "#16a34a",
                  lineHeight: 1,
                }}
              >
                {metrics.attentionCount}
              </div>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {metrics.attentionCount > 0 ? "Requieren atención" : "Al día sin pendientes"}
            </div>
          </Card>
        </div>
      </div>

      {/* 3. SECCIÓN PRINCIPAL: "¿QUÉ QUIERES HACER?" */}
      <div>
        <div style={{ marginBottom: "0.875rem", padding: "0 0.25rem" }}>
          <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.25rem", fontWeight: 800, color: "var(--fg)" }}>
            ¿Qué quieres hacer?
          </h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>
            Selecciona una herramienta para comenzar.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
            gap: "0.875rem",
          }}
        >
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg, 0.75rem)",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: "115px",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <Link
                  href={m.href}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius, 0.5rem)",
                        background: "rgba(37, 99, 235, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--primary)",
                      }}
                    >
                      <Icon size={20} weight="bold" />
                    </div>

                    {/* Badge dinámico secundario */}
                    {m.badge ? (
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 700,
                          background: "var(--accent)",
                          color: "var(--muted)",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "999px",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {m.badge}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--fg)", marginBottom: "0.25rem" }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.4 }}>
                    {m.desc}
                  </div>
                </Link>

                {/* Acción rápida opcional (ej: + Nueva en licencias) */}
                {m.quickAction ? (
                  <div style={{ marginTop: "0.75rem", paddingTop: "0.625rem", borderTop: "1px solid var(--border)" }}>
                    <Link
                      href={m.quickAction.href}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: "var(--primary)",
                        textDecoration: "none",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "var(--radius, 0.375rem)",
                        background: "rgba(37, 99, 235, 0.06)",
                      }}
                    >
                      <Plus size={12} weight="bold" />
                      <span>{m.quickAction.label}</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SECCIÓN "REQUIERE TU ATENCIÓN" (Solo si existen pendientes reales) */}
      {attentionItems.length > 0 ? (
        <div id="requiere-atencion">
          <div style={{ marginBottom: "0.75rem", padding: "0 0.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Warning size={20} weight="bold" style={{ color: "#b45309" }} />
              <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 800, color: "var(--fg)" }}>
                Requiere tu atención
              </h2>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                }}
              >
                {metrics.attentionCount}
              </span>
            </div>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted)" }}>
              Trámites y casilleros que necesitan acción inmediata de la representación.
            </p>
          </div>

          <Card padding="0.5rem 0.875rem">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {attentionItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.625rem 0.5rem",
                    borderBottom: "1px solid var(--border)",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg)" }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                      {item.subtitle}
                    </div>
                  </div>

                  <Link
                    href={item.actionHref}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: item.urgency === "high" ? "#fff" : "var(--primary)",
                      background: item.urgency === "high" ? "var(--primary)" : "rgba(37, 99, 235, 0.08)",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "var(--radius, 0.375rem)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>{item.actionLabel}</span>
                    <ArrowRight size={12} weight="bold" />
                  </Link>
                </div>
              ))}

              <div style={{ padding: "0.5rem 0.5rem 0.25rem", textAlign: "right" }}>
                <Link
                  href="/representacion/expedientes"
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--primary)",
                    textDecoration: "none",
                  }}
                >
                  Ver todos los expedientes en proceso →
                </Link>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {/* 5. SECCIÓN ACTIVIDAD RECIENTE */}
      {recentActivity.length > 0 ? (
        <div>
          <div style={{ marginBottom: "0.75rem", padding: "0 0.25rem" }}>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.125rem", fontWeight: 800, color: "var(--fg)" }}>
              Actividad reciente
            </h2>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted)" }}>
              Últimos movimientos registrados en la delegación.
            </p>
          </div>

          <Card padding="0.75rem 1rem">
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {recentActivity.map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: "0.5rem",
                    borderBottom: "1px solid var(--border)",
                    fontSize: "0.8125rem",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    {r.href ? (
                      <Link
                        href={r.href}
                        style={{
                          color: "var(--primary)",
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        {r.title}
                      </Link>
                    ) : (
                      <strong style={{ color: "var(--fg)" }}>{r.title}</strong>
                    )}
                    <span style={{ color: "var(--muted)", marginLeft: "0.5rem" }}>
                      {r.detail}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>
                    {r.timeAgo}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
