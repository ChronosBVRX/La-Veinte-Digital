"use client"

import { FacebookFeed } from "@/features/facebook/components/FacebookFeed"

interface Props {
  compact?: boolean
}

export function FacebookFeeds({ compact }: Props) {
  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <FacebookFeed compact page="seccionxx" label="Sección XX Michoacán" />
        <FacebookFeed compact page="cen" label="CEN SNTSS" />
      </div>
    )
  }

  return (
    <>
      <style>{`
        .fb-grid { display: grid; gap: 1.25rem; }
        .fb-details { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--card); margin-top: 0.75rem; }
        .fb-details:first-of-type { margin-top: 0; }
        .fb-details summary { cursor: pointer; padding: 0.875rem 1.25rem; font-weight: 600; font-size: 0.9375rem; display: flex; align-items: center; gap: 0.5rem; user-select: none; }
        .fb-details summary::-webkit-details-marker { display: none; }
        .fb-details[open] summary { border-bottom: 1px solid var(--border); }
        @media (min-width: 768px) {
          .fb-grid { grid-template-columns: 1fr 1fr; }
          .fb-accordion { display: none !important; }
        }
        @media (max-width: 767px) {
          .fb-desktop { display: none !important; }
        }
      `}</style>

      <div className="fb-grid fb-desktop">
        <FacebookFeed page="seccionxx" label="Sección XX Michoacán" />
        <FacebookFeed page="cen" label="CEN SNTSS" />
      </div>

      <details className="fb-details fb-accordion">
        <summary>
          <span style={{ fontSize: "0.875rem", color: "#1877F2" }}>f</span>
          Sección XX Michoacán
          <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--muted)" }}>▶</span>
        </summary>
        <FacebookFeed page="seccionxx" label="Sección XX Michoacán" />
      </details>

      <details className="fb-details fb-accordion">
        <summary>
          <span style={{ fontSize: "0.875rem", color: "#1877F2" }}>f</span>
          CEN SNTSS
          <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--muted)" }}>▶</span>
        </summary>
        <FacebookFeed page="cen" label="CEN SNTSS" />
      </details>
    </>
  )
}
