"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function UnionPageHeader({
  title,
  subtitle,
  backHref = "/representacion",
  actions,
}: {
  title: string;
  subtitle: string;
  backHref?: string;
  actions?: ReactNode;
}): React.JSX.Element {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <Link
        href={backHref}
        style={{ fontSize: "0.8125rem", color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
      >
        ← Representación Sindical
      </Link>
      <h1 style={{ margin: "0.375rem 0 0.25rem", fontSize: "1.375rem", fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h1>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>{subtitle}</p>
      {actions ? <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{actions}</div> : null}
    </div>
  );
}
