"use client"

import { useState } from "react"
import { TrendUp, TrendDown, PlusCircle, MinusCircle, Equals, CaretDown, CaretUp } from "@phosphor-icons/react"
import { Badge } from "@/shared/components/ui/Badge"
import { Button } from "@/shared/components/ui/Button"
import type { SimulationResult, ConceptDelta } from "../services/simulate"

interface ScenarioComparisonProps {
  result: SimulationResult
}

function ConceptRow({ delta }: { delta: ConceptDelta }) {
  const isNew = delta.appeared
  const isGone = delta.disappeared
  const increased = delta.delta > 0 && !isNew
  const decreased = delta.delta < 0 && !isGone
  const unchanged = delta.delta === 0

  return (
    <div
      className="concept-row"
      style={{
        padding: "var(--space-3) 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="concept-row-desktop" style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        fontSize: "var(--text-sm)",
      }}>
        <div style={{ width: 24, display: "flex", justifyContent: "center" }}>
          {isNew && <PlusCircle size={18} weight="fill" color="var(--success)" />}
          {isGone && <MinusCircle size={18} weight="fill" color="var(--error)" />}
          {increased && <TrendUp size={18} weight="fill" color="var(--success)" />}
          {decreased && <TrendDown size={18} weight="fill" color="var(--error)" />}
          {unchanged && <Equals size={18} color="var(--muted)" />}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{delta.name}</div>
          {isNew && <span style={{ fontSize: "var(--text-xs)", color: "var(--success)" }}>Nuevo concepto</span>}
          {isGone && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)" }}>Ya no aplica</span>}
        </div>

        <div style={{ textAlign: "right", minWidth: 160 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            {!isNew && (
              <span style={{ color: "var(--muted)", fontSize: "var(--text-xs)" }}>
                ${delta.baselineAmount.toLocaleString("es-MX")}
              </span>
            )}
            {(increased || decreased || isNew) && (
              <>
                <span style={{ color: "var(--muted)" }}>→</span>
                <span style={{
                  fontWeight: 700,
                  color: isNew || increased ? "var(--success)" : "var(--error)",
                }}>
                  ${delta.scenarioAmount.toLocaleString("es-MX")}
                </span>
              </>
            )}
          </div>
          {!unchanged && (
            <Badge variant={delta.delta > 0 ? "success" : "error"} size="sm">
              {delta.delta > 0 ? "+" : ""}${delta.delta.toLocaleString("es-MX")}
            </Badge>
          )}
        </div>
      </div>

      <div className="concept-row-mobile" style={{
        display: "none",
        fontSize: "var(--text-sm)",
        gap: "var(--space-1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          {isNew && <PlusCircle size={16} weight="fill" color="var(--success)" />}
          {isGone && <MinusCircle size={16} weight="fill" color="var(--error)" />}
          {increased && <TrendUp size={16} weight="fill" color="var(--success)" />}
          {decreased && <TrendDown size={16} weight="fill" color="var(--error)" />}
          <span style={{ fontWeight: 600 }}>{delta.name}</span>
        </div>
        <div style={{ display: "flex", gap: "var(--space-1)", color: "var(--muted)", fontSize: "var(--text-xs)", marginTop: "0.25rem" }}>
          {!isNew && <span>Antes: ${delta.baselineAmount.toLocaleString("es-MX")}</span>}
          {(increased || decreased || isNew) && (
            <span style={{ color: isNew || increased ? "var(--success)" : "var(--error)", fontWeight: 600 }}>
              {isNew ? "Nuevo: " : "Ahora: "}${delta.scenarioAmount.toLocaleString("es-MX")}
            </span>
          )}
        </div>
        {!unchanged && (
          <div style={{ marginTop: "0.125rem" }}>
            <Badge variant={delta.delta > 0 ? "success" : "error"} size="sm">
              {delta.delta > 0 ? "+" : ""}${delta.delta.toLocaleString("es-MX")}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}

export function ScenarioComparison({ result }: ScenarioComparisonProps) {
  const [showAll, setShowAll] = useState(false)

  const deltas = result.conceptDeltas.filter((d) => d.baselineAmount !== d.scenarioAmount)

  if (deltas.length === 0) {
    return (
      <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--muted)", fontSize: "var(--text-sm)" }}>
        <Equals size={24} color="var(--muted)" />
        <p>No hay cambios en los conceptos. La quincena sería igual.</p>
      </div>
    )
  }

  const visible = showAll ? deltas : deltas.slice(0, 3)
  const hasMore = deltas.length > 3

  return (
    <div>
      {visible.map((delta) => (
        <ConceptRow key={delta.code} delta={delta} />
      ))}

      {hasMore && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            trailingIcon={showAll ? <CaretUp size={14} /> : <CaretDown size={14} />}
          >
            {showAll
              ? "Mostrar solo los principales"
              : `Ver desglose completo (${deltas.length} conceptos)`}
          </Button>
        </div>
      )}

      <style>{`
        @media (max-width: 480px) {
          .concept-row-desktop { display: none !important; }
          .concept-row-mobile { display: flex !important; flex-direction: column; }
        }
      `}</style>
    </div>
  )
}
