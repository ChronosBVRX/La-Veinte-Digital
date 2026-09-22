"use client";

import Link from "next/link";
import { Baby, Drop, ArrowLeft } from "@phosphor-icons/react";

export interface MaternityLactationNavProps {
  activeTab: "maternidad" | "lactancia";
}

export function MaternityLactationNav({ activeTab }: MaternityLactationNavProps): React.JSX.Element {
  const isMaternity = activeTab === "maternidad";
  const isLactation = activeTab === "lactancia";

  return (
    <nav
      aria-label="Navegación contextual de Maternidad y Lactancia"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        marginBottom: "1rem",
        width: "100%",
      }}
    >
      {/* Enlace discreto de regreso a la portada */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link
          href="/representacion/maternidad-lactancia"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            color: "var(--muted, #64748b)",
            textDecoration: "none",
            fontWeight: 600,
            padding: "0.25rem 0",
            minHeight: "36px",
            boxSizing: "border-box",
            transition: "color 0.15s ease",
          }}
        >
          <ArrowLeft size={14} weight="bold" aria-hidden="true" />
          <span>Portada Maternidad y Lactancia</span>
        </Link>
      </div>

      {/* Segmented Control / Pestañas */}
      <div
        role="tablist"
        aria-label="Herramientas del módulo"
        style={{
          display: "flex",
          gap: "0.375rem",
          background: "var(--accent, #f1f5f9)",
          padding: "0.25rem",
          borderRadius: "var(--radius, 0.5rem)",
          border: "1px solid var(--border, #e2e8f0)",
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        <Link
          href="/representacion/maternidad"
          role="tab"
          aria-selected={isMaternity}
          aria-current={isMaternity ? "page" : undefined}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "calc(var(--radius, 0.5rem) - 2px)",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: isMaternity ? 700 : 500,
            color: isMaternity ? "var(--primary, #2563eb)" : "var(--muted, #64748b)",
            background: isMaternity ? "var(--card, #ffffff)" : "transparent",
            boxShadow: isMaternity ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            minHeight: "44px",
            boxSizing: "border-box",
            transition: "all 0.15s ease",
            textAlign: "center",
          }}
        >
          <Baby
            size={18}
            weight={isMaternity ? "fill" : "regular"}
            style={{ flexShrink: 0, color: isMaternity ? "#e11d48" : "inherit" }}
            aria-hidden="true"
          />
          <span>Maternidad</span>
          <span
            style={{
              fontSize: "0.6875rem",
              background: isMaternity ? "rgba(225, 29, 72, 0.1)" : "rgba(100, 116, 139, 0.1)",
              color: isMaternity ? "#be123c" : "var(--muted, #64748b)",
              padding: "0.1rem 0.375rem",
              borderRadius: "999px",
              fontWeight: 600,
            }}
          >
            90 d
          </span>
        </Link>

        <Link
          href="/representacion/lactancia"
          role="tab"
          aria-selected={isLactation}
          aria-current={isLactation ? "page" : undefined}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "calc(var(--radius, 0.5rem) - 2px)",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: isLactation ? 700 : 500,
            color: isLactation ? "var(--primary, #2563eb)" : "var(--muted, #64748b)",
            background: isLactation ? "var(--card, #ffffff)" : "transparent",
            boxShadow: isLactation ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
            minHeight: "44px",
            boxSizing: "border-box",
            transition: "all 0.15s ease",
            textAlign: "center",
          }}
        >
          <Drop
            size={18}
            weight={isLactation ? "fill" : "regular"}
            style={{ flexShrink: 0, color: isLactation ? "#0284c7" : "inherit" }}
            aria-hidden="true"
          />
          <span>Lactancia</span>
          <span
            style={{
              fontSize: "0.6875rem",
              background: isLactation ? "rgba(2, 132, 199, 0.1)" : "rgba(100, 116, 139, 0.1)",
              color: isLactation ? "#0369a1" : "var(--muted, #64748b)",
              padding: "0.1rem 0.375rem",
              borderRadius: "999px",
              fontWeight: 600,
            }}
          >
            365 d
          </span>
        </Link>
      </div>
    </nav>
  );
}
