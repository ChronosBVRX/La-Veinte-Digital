"use client"

import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import type { ResolvedSalaryCategory } from "../lib/types"
import type { CategoryMatch } from "../lib/category-resolver"
import { HelpCircle } from "lucide-react"

interface CategoryResolutionCardProps {
  matches: CategoryMatch[]
  onSelect: (category: ResolvedSalaryCategory) => void
  onRetry: () => void
}

export function CategoryResolutionCard({ matches, onSelect, onRetry }: CategoryResolutionCardProps) {
  return (
    <div style={{ maxWidth: "560px", margin: "2rem auto" }}>
      <Card padding="1.5rem">
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(234,179,8,0.1)", display: "flex",
            alignItems: "center", justifyContent: "center",
            margin: "0 auto 0.75rem",
          }}>
            <HelpCircle size={24} style={{ color: "var(--warning)" }} />
          </div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>
            Encontramos m&aacute;s de una categor&iacute;a parecida
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.25rem" }}>
            &iquest;Cu&aacute;l aparece en tu tarjet&oacute;n?
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {matches.map((m, i) => (
            <button
              key={i}
              onClick={() => onSelect(m.category)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "0.75rem 1rem", borderRadius: "var(--radius)",
                border: "1px solid var(--border)", background: "var(--bg)",
                cursor: "pointer", fontSize: "0.875rem", width: "100%",
                textAlign: "left", transition: "all var(--transition)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "rgba(37,99,235,0.04)" }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg)" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{m.category.categoryName}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                  ${m.category.biweeklyBaseSalary.toFixed(2)} quincenal
                </div>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {m.reasons.join(", ")}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <Button variant="ghost" onClick={onRetry}>
            Volver a mi perfil
          </Button>
        </div>

        <p style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "center", marginTop: "0.75rem" }}>
          Selecciona el nombre m&aacute;s parecido al que aparece junto a tu plaza.
        </p>
      </Card>
    </div>
  )
}
