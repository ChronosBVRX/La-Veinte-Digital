"use client";

import React from "react";
import Link from "next/link";
import { Clock } from "@phosphor-icons/react";
import type { UnionDashboardSummary } from "../../lib/dashboard-format";

export interface UnionRecentActivityProps {
  recentActivity: UnionDashboardSummary["recentActivity"];
}

export function UnionRecentActivity({
  recentActivity,
}: UnionRecentActivityProps): React.JSX.Element | null {
  if (recentActivity.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      {/* Encabezado */}
      <div style={{ padding: "0 0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Clock size={16} weight="bold" style={{ color: "var(--muted, #64748b)" }} />
          <h2
            style={{
              margin: 0,
              fontSize: "1.125rem",
              fontWeight: 800,
              color: "var(--fg, #0f172a)",
              letterSpacing: "-0.015em",
            }}
          >
            Actividad reciente
          </h2>
        </div>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--muted, #64748b)" }}>
          Últimos movimientos registrados en la delegación.
        </p>
      </div>

      {/* Timeline visual */}
      <div
        style={{
          background: "var(--card, #ffffff)",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "var(--radius-lg, 0.75rem)",
          padding: "0.75rem 1.125rem",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {recentActivity.map((r, idx) => {
            const isLast = idx === recentActivity.length - 1;
            return (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.625rem 0",
                  borderBottom: isLast ? "none" : "1px solid var(--border, #e2e8f0)",
                  position: "relative",
                }}
              >
                {/* Conector / Timeline dot */}
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--primary, #2563eb)",
                    marginTop: "0.375rem",
                    flexShrink: 0,
                    boxShadow: "0 0 0 3px rgba(37, 99, 235, 0.15)",
                  }}
                />

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    {r.href ? (
                      <Link
                        href={r.href}
                        style={{
                          color: "var(--primary, #2563eb)",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          textDecoration: "none",
                        }}
                      >
                        {r.title}
                      </Link>
                    ) : (
                      <strong style={{ color: "var(--fg, #0f172a)", fontSize: "0.875rem" }}>
                        {r.title}
                      </strong>
                    )}
                    <span
                      style={{
                        color: "var(--muted, #64748b)",
                        marginLeft: "0.5rem",
                        fontSize: "0.8125rem",
                      }}
                    >
                      {r.detail}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--muted, #64748b)",
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {r.timeAgo}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
