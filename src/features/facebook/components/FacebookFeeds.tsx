"use client"

import { FacebookFeed } from "@/features/facebook/components/FacebookFeed"

interface Props {
  compact?: boolean
}

export function FacebookFeeds({ compact }: Props) {
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
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            marginBottom: "0.75rem",
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#1877F2", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontSize: "0.75rem",
              fontWeight: 700, flexShrink: 0,
            }}>f</span>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>
              SNTSS Sección XX
            </h3>
          </div>
          <FacebookFeed compact={compact} page="seccionxx" label="SNTSS Sección XX" />
        </div>
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            marginBottom: "0.75rem",
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#1877F2", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#fff", fontSize: "0.75rem",
              fontWeight: 700, flexShrink: 0,
            }}>f</span>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, margin: 0 }}>
              SNTSS Nacional
            </h3>
          </div>
          <FacebookFeed compact={compact} page="cen" label="SNTSS Nacional" />
        </div>
      </div>

      {!compact && (
        <>
          <details className="fb-details fb-accordion">
            <summary>
              <span style={{ fontSize: "0.875rem", color: "#1877F2" }}>f</span>
              SNTSS Sección XX
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--muted)" }}>▶</span>
            </summary>
            <FacebookFeed page="seccionxx" label="SNTSS Sección XX" />
          </details>

          <details className="fb-details fb-accordion">
            <summary>
              <span style={{ fontSize: "0.875rem", color: "#1877F2" }}>f</span>
              SNTSS Nacional
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--muted)" }}>▶</span>
            </summary>
            <FacebookFeed page="cen" label="SNTSS Nacional" />
          </details>
        </>
      )}
    </>
  )
}
