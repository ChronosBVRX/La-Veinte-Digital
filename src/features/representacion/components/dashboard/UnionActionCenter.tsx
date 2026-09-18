"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Baby,
  Drop,
  Ticket,
  Users,
  Folder,
  Lockers,
  Printer,
  ShieldCheck,
  Plus,
  ArrowRight,
} from "@phosphor-icons/react";
import type { UnionDashboardSummary } from "../../lib/dashboard-format";

export interface UnionActionCenterProps {
  metrics: UnionDashboardSummary["metrics"];
  isAdmin: boolean;
}

export function UnionActionCenter({ metrics, isAdmin }: UnionActionCenterProps): React.JSX.Element {
  const printInfo = metrics.print;
  const printTotalQueue = (printInfo?.queuedCount ?? 0) + (printInfo?.printingCount ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Encabezado de la sección */}
      <div style={{ padding: "0 0.25rem" }}>
        <h2
          style={{
            margin: "0 0 0.25rem",
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "var(--fg, #0f172a)",
            letterSpacing: "-0.02em",
          }}
        >
          ¿Qué quieres hacer?
        </h2>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted, #64748b)" }}>
          Selecciona una herramienta para comenzar.
        </p>
      </div>

      {/* SECCIÓN 1: TRÁMITES */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 800,
            color: "var(--primary, #2563eb)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "0 0.25rem",
          }}
        >
          Trámites
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "0.875rem",
          }}
        >
          {/* Módulo: Licencias (Destacado) */}
          <div
            style={{
              background: "var(--card, #ffffff)",
              border: "1px solid rgba(37, 99, 235, 0.22)",
              borderRadius: "var(--radius-lg, 0.75rem)",
              padding: "1.125rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.05)",
              position: "relative",
              transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "var(--radius-md, 0.5rem)",
                    background: "rgba(37, 99, 235, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--primary, #2563eb)",
                  }}
                >
                  <FileText size={24} weight="bold" />
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    color: "var(--primary, #2563eb)",
                    background: "rgba(37, 99, 235, 0.06)",
                    padding: "0.15rem 0.5rem",
                    borderRadius: "999px",
                  }}
                >
                  Prioritario
                </span>
              </div>

              <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                Licencias
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                Crea, continúa, edita e imprime solicitudes de licencia.
              </div>
            </div>

            <div
              style={{
                marginTop: "1rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/representacion/licencias?action=new"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  background: "var(--primary, #2563eb)",
                  padding: "0.5rem 0.875rem",
                  borderRadius: "var(--radius, 0.375rem)",
                  textDecoration: "none",
                  minHeight: "44px",
                  boxSizing: "border-box",
                  boxShadow: "0 1px 3px rgba(37, 99, 235, 0.2)",
                  transition: "background 0.15s ease",
                }}
              >
                <Plus size={14} weight="bold" />
                <span>Nueva</span>
              </Link>

              <Link
                href="/representacion/licencias"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--primary, #2563eb)",
                  textDecoration: "none",
                  padding: "0.5rem 0.625rem",
                  minHeight: "44px",
                  boxSizing: "border-box",
                }}
              >
                <span>Ver historial</span>
                <ArrowRight size={13} weight="bold" />
              </Link>
            </div>
          </div>

          {/* Módulo: Maternidad */}
          <Link
            href="/representacion/maternidad"
            style={{ textDecoration: "none", color: "inherit", display: "flex" }}
          >
            <div
              style={{
                flex: 1,
                background: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius-lg, 0.75rem)",
                padding: "1.125rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md, 0.5rem)",
                      background: "rgba(37, 99, 235, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    <Baby size={22} weight="bold" />
                  </div>
                  <ArrowRight size={16} weight="bold" style={{ color: "var(--muted, #64748b)" }} />
                </div>

                <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                  Maternidad
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  Calcula periodos, registra casos y genera documentación.
                </div>
              </div>
            </div>
          </Link>

          {/* Módulo: Lactancia */}
          <Link
            href="/representacion/lactancia"
            style={{ textDecoration: "none", color: "inherit", display: "flex" }}
          >
            <div
              style={{
                flex: 1,
                background: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius-lg, 0.75rem)",
                padding: "1.125rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md, 0.5rem)",
                      background: "rgba(37, 99, 235, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    <Drop size={22} weight="bold" />
                  </div>
                  <ArrowRight size={16} weight="bold" style={{ color: "var(--muted, #64748b)" }} />
                </div>

                <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                  Lactancia
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  Consulta periodos y administra solicitudes de lactancia.
                </div>
              </div>
            </div>
          </Link>

          {/* Módulo: Pasajes */}
          <Link
            href="/representacion/pasajes"
            style={{ textDecoration: "none", color: "inherit", display: "flex" }}
          >
            <div
              style={{
                flex: 1,
                background: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius-lg, 0.75rem)",
                padding: "1.125rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md, 0.5rem)",
                      background: "rgba(37, 99, 235, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    <Ticket size={22} weight="bold" />
                  </div>
                  <ArrowRight size={16} weight="bold" style={{ color: "var(--muted, #64748b)" }} />
                </div>

                <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                  Pasajes
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  Gestiona solicitudes y formatos de pasajes (Cl. 103).
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* SECCIÓN 2: GESTIÓN */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 800,
            color: "var(--muted, #64748b)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "0 0.25rem",
          }}
        >
          Gestión
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "0.875rem",
          }}
        >
          {/* Módulo: Trabajadores */}
          <Link
            href="/representacion/trabajadores"
            style={{ textDecoration: "none", color: "inherit", display: "flex" }}
          >
            <div
              style={{
                flex: 1,
                background: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius-lg, 0.75rem)",
                padding: "1.125rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md, 0.5rem)",
                      background: "rgba(37, 99, 235, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    <Users size={22} weight="bold" />
                  </div>
                  {metrics.workers.total !== null ? (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        background: "var(--accent, #f1f5f9)",
                        color: "var(--muted, #64748b)",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        border: "1px solid var(--border, #e2e8f0)",
                      }}
                    >
                      {metrics.workers.total} registrados
                    </span>
                  ) : null}
                </div>

                <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                  Trabajadores
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  Consulta y administra el padrón de trabajadores.
                </div>
              </div>
            </div>
          </Link>

          {/* Módulo: Expedientes */}
          <Link
            href="/representacion/expedientes"
            style={{ textDecoration: "none", color: "inherit", display: "flex" }}
          >
            <div
              style={{
                flex: 1,
                background: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius-lg, 0.75rem)",
                padding: "1.125rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md, 0.5rem)",
                      background: "rgba(37, 99, 235, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    <Folder size={22} weight="bold" />
                  </div>
                  <ArrowRight size={16} weight="bold" style={{ color: "var(--muted, #64748b)" }} />
                </div>

                <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                  Expedientes
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  Consulta expedientes y antecedentes de representación.
                </div>
              </div>
            </div>
          </Link>

          {/* Módulo: Lockers */}
          <Link
            href="/representacion/lockers"
            style={{ textDecoration: "none", color: "inherit", display: "flex" }}
          >
            <div
              style={{
                flex: 1,
                background: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius-lg, 0.75rem)",
                padding: "1.125rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md, 0.5rem)",
                      background: "rgba(37, 99, 235, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    <Lockers size={22} weight="bold" />
                  </div>
                  {metrics.lockers.available !== null ? (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        background: "var(--accent, #f1f5f9)",
                        color: "var(--muted, #64748b)",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        border: "1px solid var(--border, #e2e8f0)",
                      }}
                    >
                      {metrics.lockers.available} disponibles
                    </span>
                  ) : null}
                </div>

                <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                  Lockers
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  Consulta disponibilidad, asigna y libera lockers.
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* SECCIÓN 3: OFICINA Y SISTEMA */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <div
          style={{
            fontSize: "0.6875rem",
            fontWeight: 800,
            color: "var(--muted, #64748b)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "0 0.25rem",
          }}
        >
          Oficina y Sistema
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "0.875rem",
          }}
        >
          {/* Módulo: Impresión */}
          <Link
            href="/representacion/impresion"
            style={{ textDecoration: "none", color: "inherit", display: "flex" }}
          >
            <div
              style={{
                flex: 1,
                background: "var(--card, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                borderRadius: "var(--radius-lg, 0.75rem)",
                padding: "1.125rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "var(--radius-md, 0.5rem)",
                      background: "rgba(37, 99, 235, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--primary, #2563eb)",
                    }}
                  >
                    <Printer size={22} weight="bold" />
                  </div>
                  {printInfo?.hasStation ? (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        border: "1px solid",
                        ...(printInfo.isOnline
                          ? printTotalQueue > 0
                            ? { background: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" }
                            : { background: "#f0fdf4", borderColor: "#bbf7d0", color: "#15803d" }
                          : { background: "#fffbeb", borderColor: "#fde68a", color: "#b45309" }),
                      }}
                    >
                      {printInfo.isOnline
                        ? printTotalQueue > 0
                          ? `${printTotalQueue} en cola`
                          : "● En línea"
                        : "⚠ Desconectada"}
                    </span>
                  ) : null}
                </div>

                <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                  Impresión
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  Cola de impresión automática y estación de oficina.
                </div>
              </div>
            </div>
          </Link>

          {/* Módulo: Administración (solo si isAdmin) */}
          {isAdmin ? (
            <Link
              href="/representacion/administracion"
              style={{ textDecoration: "none", color: "inherit", display: "flex" }}
            >
              <div
                style={{
                  flex: 1,
                  background: "var(--card, #ffffff)",
                  border: "1px solid var(--border, #e2e8f0)",
                  borderRadius: "var(--radius-lg, 0.75rem)",
                  padding: "1.125rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                  cursor: "pointer",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--radius-md, 0.5rem)",
                        background: "rgba(37, 99, 235, 0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--primary, #2563eb)",
                      }}
                    >
                      <ShieldCheck size={22} weight="bold" />
                    </div>
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        background: "rgba(37, 99, 235, 0.08)",
                        color: "var(--primary, #2563eb)",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        border: "1px solid rgba(37, 99, 235, 0.2)",
                      }}
                    >
                      Admin
                    </span>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: "1.0625rem", color: "var(--fg, #0f172a)", marginBottom: "0.25rem" }}>
                    Administración
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                    Comité XXI, miembros y auditoría del sistema.
                  </div>
                </div>
              </div>
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
