"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface RepresentationSectionHeaderProps {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  actions?: ReactNode;
}

export function RepresentationSectionHeader({
  title,
  subtitle,
  backHref = "/representacion",
  backLabel = "← Representación Sindical",
  primaryAction,
  secondaryAction,
  actions,
}: RepresentationSectionHeaderProps): React.JSX.Element {
  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: "1rem",
        marginBottom: "1rem",
        minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
        {backHref ? (
          <Link
            href={backHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: "0.8125rem",
              color: "var(--primary)",
              textDecoration: "none",
              fontWeight: 600,
              marginBottom: "0.25rem",
              minHeight: 28,
            }}
          >
            {backLabel}
          </Link>
        ) : null}
        <h1
          style={{
            margin: "0.125rem 0 0.25rem",
            fontSize: "clamp(1.375rem, 4vw, 1.625rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--fg)",
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--muted)",
            lineHeight: 1.45,
            maxWidth: "70ch",
            overflowWrap: "anywhere",
          }}
        >
          {subtitle}
        </p>
      </div>

      {(actions || primaryAction || secondaryAction) ? (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          {secondaryAction}
          {primaryAction}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
