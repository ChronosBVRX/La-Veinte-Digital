"use client";

import type { ReactNode } from "react";

export interface RepresentationTableColumn {
  label: string;
  align?: "left" | "center" | "right";
  width?: string | number;
}

export interface RepresentationTableProps {
  columns: RepresentationTableColumn[];
  children: ReactNode;
  caption?: string;
  minWidth?: number | string;
  style?: React.CSSProperties;
}

export function RepresentationTable({
  columns,
  children,
  caption,
  minWidth = 720,
  style,
}: RepresentationTableProps): React.JSX.Element {
  return (
    <div
      style={{
        overflowX: "auto",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg, 0.5rem)",
        backgroundColor: "var(--card)",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
        ...style,
      }}
    >
      <table style={{ width: "100%", minWidth, borderCollapse: "collapse" }}>
        {caption ? (
          <caption
            className="sr-only"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr style={{ backgroundColor: "var(--accent)" }}>
            {columns.map((col, idx) => (
              <th
                key={idx}
                scope="col"
                style={{
                  textAlign: col.align ?? "left",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  padding: "0.625rem 0.75rem",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export const representationTableCellStyle: React.CSSProperties = {
  padding: "0.625rem 0.75rem",
  fontSize: "0.8125rem",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};
