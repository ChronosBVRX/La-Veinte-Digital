"use client";

import React from "react";
import { DashboardQuickSearch } from "../DashboardQuickSearch";
import type { UnionDashboardSummary } from "../../lib/dashboard-format";

export interface UnionControlHeroProps {
  delegation: UnionDashboardSummary["delegation"];
}

export function UnionControlHero({ delegation }: UnionControlHeroProps): React.JSX.Element {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(248, 250, 252, 0.8) 60%, var(--card, #ffffff) 100%)",
        border: "1px solid rgba(37, 99, 235, 0.16)",
        borderLeft: "4px solid var(--primary, #2563eb)",
        borderRadius: "var(--radius-lg, 0.75rem)",
        padding: "1.25rem 1.5rem",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 800,
              color: "var(--primary, #2563eb)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: "rgba(37, 99, 235, 0.08)",
              padding: "0.125rem 0.5rem",
              borderRadius: "999px",
            }}
          >
            {delegation.section || "SNTSS · SECCIÓN XX MICHOACÁN"}
          </span>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              color: "var(--muted, #64748b)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Comité Delegacional
          </span>
        </div>

        <h1
          style={{
            margin: "0.25rem 0 0.125rem",
            fontSize: "1.625rem",
            fontWeight: 800,
            color: "var(--fg, #0f172a)",
            letterSpacing: "-0.025em",
            lineHeight: 1.2,
          }}
        >
          Centro de Representación Sindical
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--muted, #64748b)",
            lineHeight: 1.4,
          }}
        >
          {delegation.name} · {delegation.facility} · Todo lo que necesitas para la atención diaria de la delegación.
        </p>
      </div>

      {/* Buscador unificado e integrado */}
      <div style={{ width: "100%" }}>
        <DashboardQuickSearch />
      </div>
    </div>
  );
}
