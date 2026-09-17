"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export interface RepresentationListCardProps {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function RepresentationListCard({
  children,
  onClick,
  href,
  className = "",
  style,
}: RepresentationListCardProps): React.JSX.Element {
  const commonStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.875rem 1rem",
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg, 0.5rem)",
    textDecoration: "none",
    color: "var(--fg)",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
    ...style,
  };

  if (href) {
    return (
      <Link href={href} className={`pressable ${className}`} style={commonStyle}>
        {children}
      </Link>
    );
  }

  if (onClick) {
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
        className={`pressable ${className}`}
        style={{ ...commonStyle, cursor: "pointer" }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={className} style={commonStyle}>
      {children}
    </div>
  );
}
