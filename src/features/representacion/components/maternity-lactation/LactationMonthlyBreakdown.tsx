"use client";

import { useState } from "react";
import { CaretDown, CaretUp, CalendarBlank } from "@phosphor-icons/react";
import type { LactationMonthlySlice } from "../../lib/lactation";

export interface LactationMonthlyBreakdownProps {
  monthlyBreakdown: LactationMonthlySlice[];
}

export function LactationMonthlyBreakdown({ monthlyBreakdown }: LactationMonthlyBreakdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        border: "1px solid var(--border, #e2e8f0)",
        borderRadius: "var(--radius, 0.5rem)",
        overflow: "hidden",
        background: "var(--card, #ffffff)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="lactation-monthly-panel"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          background: open ? "var(--accent, #f8fafc)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--fg, #0f172a)",
          minHeight: "44px",
          boxSizing: "border-box",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          <CalendarBlank size={18} weight="bold" style={{ color: "#0284c7" }} aria-hidden="true" />
          <span>Ver desglose mensual ({monthlyBreakdown.length} meses)</span>
        </span>
        <span style={{ color: "var(--muted, #64748b)" }}>
          {open ? <CaretUp size={16} weight="bold" aria-hidden="true" /> : <CaretDown size={16} weight="bold" aria-hidden="true" />}
        </span>
      </button>

      {open ? (
        <div
          id="lactation-monthly-panel"
          style={{
            padding: "0.75rem 1rem 1rem",
            borderTop: "1px solid var(--border, #e2e8f0)",
            background: "var(--card, #ffffff)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "0.5rem",
            }}
          >
            {monthlyBreakdown.map((m) => (
              <div
                key={`${m.year}-${m.month}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.4rem 0.625rem",
                  background: "var(--accent, #f8fafc)",
                  borderRadius: "var(--radius-sm, 0.375rem)",
                  border: "1px solid var(--border, #e2e8f0)",
                  fontSize: "0.8125rem",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--fg, #0f172a)" }}>
                  {m.label} {m.year}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: "#0284c7",
                    fontSize: "0.75rem",
                    background: "rgba(2, 132, 199, 0.08)",
                    padding: "0.1rem 0.375rem",
                    borderRadius: "999px",
                  }}
                >
                  {m.days} días
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
