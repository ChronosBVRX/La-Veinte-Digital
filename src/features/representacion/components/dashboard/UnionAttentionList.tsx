"use client";

import React from "react";
import Link from "next/link";
import { Warning, ArrowRight } from "@phosphor-icons/react";
import type { UnionDashboardSummary } from "../../lib/dashboard-format";

export interface UnionAttentionListProps {
  attentionItems: UnionDashboardSummary["attentionItems"];
  attentionCount: number;
}

export function UnionAttentionList({
  attentionItems,
  attentionCount,
}: UnionAttentionListProps): React.JSX.Element | null {
  if (attentionItems.length === 0) return null;

  return (
    <div id="requiere-atencion" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {/* Encabezado */}
      <div style={{ padding: "0 0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#fef3c7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#b45309",
            }}
          >
            <Warning size={14} weight="bold" />
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 800,
              color: "var(--fg, #0f172a)",
              letterSpacing: "-0.015em",
            }}
          >
            Requiere tu atención
          </h2>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 800,
              background: "#fef3c7",
              color: "#92400e",
              padding: "0.15rem 0.5rem",
              borderRadius: "999px",
              border: "1px solid #fde68a",
            }}
          >
            {attentionCount}
          </span>
        </div>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted, #64748b)" }}>
          Trámites y casilleros que necesitan acción inmediata de la representación.
        </p>
      </div>

      {/* Lista de tareas de atención */}
      <div
        style={{
          background: "var(--card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius-lg, 0.75rem)",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {attentionItems.slice(0, 5).map((item, idx) => {
            const isLast = idx === Math.min(attentionItems.length, 5) - 1;
            const isHighUrgency = item.urgency === "high";

            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.875rem 1.125rem",
                  borderBottom: isLast ? "none" : "1px solid var(--border, #e2e8f0)",
                  gap: "1rem",
                  flexWrap: "wrap",
                  background: isHighUrgency ? "rgba(245, 158, 11, 0.02)" : "transparent",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--fg, #0f172a)" }}>
                      {item.title}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted, #64748b)", marginTop: "0.2rem" }}>
                    {item.subtitle}
                  </div>
                </div>

                <Link
                  href={item.actionHref}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: isHighUrgency ? "#ffffff" : "var(--primary, #2563eb)",
                    background: isHighUrgency ? "var(--primary, #2563eb)" : "rgba(37, 99, 235, 0.08)",
                    padding: "0.375rem 0.75rem",
                    borderRadius: "var(--radius, 0.375rem)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    minHeight: "44px",
                    boxSizing: "border-box",
                    boxShadow: isHighUrgency ? "0 1px 2px rgba(37, 99, 235, 0.2)" : "none",
                    transition: "background 0.15s ease, opacity 0.15s ease",
                  }}
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight size={13} weight="bold" />
                </Link>
              </div>
            );
          })}
        </div>

        <div
          style={{
            padding: "0.625rem 1.125rem",
            background: "var(--accent, #f8fafc)",
            borderTop: "1px solid var(--border, #e2e8f0)",
            textAlign: "right",
          }}
        >
          <Link
            href="/representacion/expedientes"
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "var(--primary, #2563eb)",
              textDecoration: "none",
            }}
          >
            Ver todos los expedientes en proceso →
          </Link>
        </div>
      </div>
    </div>
  );
}
