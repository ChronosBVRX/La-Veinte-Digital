"use client";

import type { ReactNode } from "react";
import { Card } from "@/shared/components/ui/Card";

export interface RepresentationMetricCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  accentColor?: string;
  loading?: boolean;
  subtext?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function RepresentationMetricCard({
  label,
  value,
  icon,
  accentColor,
  loading = false,
  subtext,
  onClick,
  style,
}: RepresentationMetricCardProps): React.JSX.Element {
  const isInteractive = typeof onClick === "function";

  const cardContent = (
    <Card
      padding="0.875rem 1rem"
      variant={isInteractive ? "interactive" : "default"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        minWidth: 0,
        height: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: accentColor ?? "var(--muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
        {icon ? (
          <span style={{ fontSize: "0.875rem", flexShrink: 0 }} aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem", minHeight: "2rem" }}>
        {loading ? (
          <span
            style={{
              display: "inline-block",
              width: "3rem",
              height: "1.75rem",
              borderRadius: "0.25rem",
              backgroundColor: "var(--accent)",
              animation: "pulse 1.5s infinite ease-in-out",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: accentColor ?? "var(--fg)",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {typeof value === "number" ? value.toLocaleString("es-MX") : value}
          </span>
        )}
      </div>

      {subtext ? (
        <span
          style={{
            fontSize: "0.6875rem",
            color: "var(--muted)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {subtext}
        </span>
      ) : null}
    </Card>
  );

  if (isInteractive) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        style={{ cursor: "pointer", minWidth: 0, height: "100%" }}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
}
