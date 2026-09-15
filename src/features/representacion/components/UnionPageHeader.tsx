"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function UnionPageHeader({
  title,
  subtitle,
  backHref = "/representacion",
  backLabel = "← Representación Sindical",
  actions,
}: {
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: "1rem", minWidth: 0 }}>
      <Link
        href={backHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 32,
          fontSize: "0.8125rem",
          color: "var(--primary)",
          textDecoration: "none",
          fontWeight: 600,
          maxWidth: "100%",
          overflowWrap: "anywhere",
        }}
      >
        {backLabel}
      </Link>
      <h1
        style={{
          margin: "0.25rem 0 0.25rem",
          fontSize: "clamp(1.25rem, 4.5vw, 1.375rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5, maxWidth: "72ch" }}>{subtitle}</p>
      {actions ? (
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>{actions}</div>
      ) : null}
    </div>
  );
}
