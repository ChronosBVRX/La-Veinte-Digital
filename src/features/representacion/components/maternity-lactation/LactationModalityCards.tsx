"use client";

import { Handshake } from "@phosphor-icons/react";
import type { LactationModalityOption } from "../../lib/lactation";

export interface LactationModalityCardsProps {
  modalities: LactationModalityOption[];
  selectedModality: string;
  onSelectModality: (id: string) => void;
}

export function LactationModalityCards({
  modalities,
  selectedModality,
  onSelectModality,
}: LactationModalityCardsProps): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <label
        style={{
          display: "block",
          fontSize: "0.875rem",
          fontWeight: 700,
          color: "var(--fg, #0f172a)",
        }}
      >
        Modalidad conforme a la jornada
      </label>

      <div
        role="radiogroup"
        aria-label="Modalidad de lactancia"
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        {modalities.map((option) => {
          const isSelected = selectedModality === option.id;
          return (
            <label
              key={option.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                padding: "0.875rem",
                borderRadius: "var(--radius, 0.5rem)",
                border: isSelected
                  ? "2px solid #0284c7"
                  : "1px solid var(--border, #e2e8f0)",
                background: isSelected
                  ? "rgba(2, 132, 199, 0.04)"
                  : "var(--card, #ffffff)",
                cursor: "pointer",
                boxShadow: isSelected ? "0 1px 4px rgba(2, 132, 199, 0.12)" : "none",
                transition: "border-color 0.15s ease, background 0.15s ease",
                minHeight: "44px",
                boxSizing: "border-box",
              }}
            >
              <input
                type="radio"
                name="lactation-modality"
                value={option.id}
                checked={isSelected}
                onChange={() => onSelectModality(option.id)}
                style={{
                  marginTop: "0.2rem",
                  accentColor: "#0284c7",
                  width: "18px",
                  height: "18px",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "0.375rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      color: isSelected ? "#0369a1" : "var(--fg, #0f172a)",
                    }}
                  >
                    {option.title}
                  </span>
                  {option.requiresAgreement ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        background: "rgba(217, 119, 6, 0.1)",
                        color: "#b45309",
                        border: "1px solid rgba(217, 119, 6, 0.25)",
                        padding: "0.1rem 0.5rem",
                        borderRadius: "999px",
                      }}
                    >
                      <Handshake size={12} weight="bold" aria-hidden="true" />
                      <span>Requiere acuerdo</span>
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--muted, #64748b)", lineHeight: 1.4 }}>
                  {option.detail}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
