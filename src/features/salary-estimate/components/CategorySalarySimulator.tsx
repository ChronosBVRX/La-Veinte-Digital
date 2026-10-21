"use client"

import { useState, useMemo } from "react"
import { Calculator, MagnifyingGlass, Sparkle } from "@phosphor-icons/react"
import {
  CATALOGO_CATEGORIAS,
  normalizeCategoryName,
  type CategoriaSalarial,
} from "@/shared/lib/catalogo-categorias"
import {
  calculateSalaryIncrease,
  CLAUSULA_63_BIS_COEF_VIGENTE,
  type SalaryEstimateResult,
} from "@/features/salary-estimate/lib/calculate-salary-increase"
import { formatCurrency } from "@/features/calculators/lib/money"

export interface CategorySalarySimulatorProps {
  /**
   * "dark" para incrustar dentro de la tarjeta azul SalaryIncreaseCard.
   * "light" para el modal o fondos claros.
   */
  theme?: "dark" | "light"
  initialCategoryName?: string | null
  onCategorySelect?: (cat: CategoriaSalarial) => void
}

export function CategorySalarySimulator({
  theme = "dark",
  initialCategoryName,
  onCategorySelect,
}: CategorySalarySimulatorProps) {
  const isDark = theme === "dark"

  // 1. Obtener y desduplicar categorías del catálogo oficial
  const uniqueCategories = useMemo<CategoriaSalarial[]>(() => {
    const map = new Map<string, CategoriaSalarial>()
    for (const cat of CATALOGO_CATEGORIAS) {
      const key = normalizeCategoryName(cat.nombre)
      if (!map.has(key)) {
        map.set(key, cat)
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    )
  }, [])

  // 2. Estado de búsqueda y selección
  const [searchFilter, setSearchFilter] = useState("")
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>(() => {
    if (initialCategoryName) {
      const norm = normalizeCategoryName(initialCategoryName)
      const found = uniqueCategories.find((c) => normalizeCategoryName(c.nombre) === norm)
      if (found) return found.nombre
    }
    return uniqueCategories[0]?.nombre ?? ""
  })

  // 3. Filtrar categorías según la búsqueda
  const filteredCategories = useMemo(() => {
    if (!searchFilter.trim()) return uniqueCategories
    const query = normalizeCategoryName(searchFilter)
    return uniqueCategories.filter((c) =>
      normalizeCategoryName(c.nombre).includes(query),
    )
  }, [uniqueCategories, searchFilter])

  // 4. Categoría actualmente activa
  const currentCategory = useMemo<CategoriaSalarial | null>(() => {
    if (!selectedCategoryName) return filteredCategories[0] ?? null
    return (
      uniqueCategories.find(
        (c) => normalizeCategoryName(c.nombre) === normalizeCategoryName(selectedCategoryName),
      ) ??
      filteredCategories[0] ??
      null
    )
  }, [uniqueCategories, filteredCategories, selectedCategoryName])

  // 5. Cálculo del aumento sobre la categoría seleccionada
  const simulationResult = useMemo<SalaryEstimateResult | null>(() => {
    if (!currentCategory) return null
    return calculateSalaryIncrease({
      tabular: currentCategory.sueldoQuincenal,
      concept11: currentCategory.concepto011,
      hasPayslip: true,
    })
  }, [currentCategory])

  const handleSelectCategory = (catName: string) => {
    setSelectedCategoryName(catName)
    const cat = uniqueCategories.find((c) => c.nombre === catName)
    if (cat && onCategorySelect) {
      onCategorySelect(cat)
    }
  }

  // Estilos temáticos
  const containerStyle: React.CSSProperties = {
    background: isDark ? "rgba(15, 23, 42, 0.45)" : "var(--card, #ffffff)",
    border: isDark ? "1px solid rgba(255, 255, 255, 0.22)" : "1px solid var(--border, #e2e8f0)",
    borderRadius: "var(--radius-md, 0.5rem)",
    padding: "0.85rem",
    color: isDark ? "#ffffff" : "var(--fg, #0f172a)",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: isDark ? "#c7d2fe" : "var(--muted, #64748b)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.45rem 0.65rem",
    borderRadius: "0.375rem",
    fontSize: "0.8125rem",
    background: isDark ? "rgba(15, 23, 42, 0.6)" : "#ffffff",
    border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1px solid var(--border, #cbd5e1)",
    color: isDark ? "#ffffff" : "var(--fg, #0f172a)",
    boxSizing: "border-box",
  }

  return (
    <div data-testid="category-salary-simulator" style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: isDark ? "rgba(191, 219, 254, 0.2)" : "rgba(37, 99, 235, 0.12)",
              color: isDark ? "#bfdbfe" : "var(--primary, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Calculator size={14} weight="bold" />
          </span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: isDark ? "#ffffff" : "var(--fg, #0f172a)" }}>
            Simulador de aumento por categoría
          </span>
        </div>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            color: isDark ? "#86efac" : "#15803d",
            background: isDark ? "rgba(34, 197, 94, 0.18)" : "rgba(34, 197, 94, 0.1)",
            padding: "0.15rem 0.45rem",
            borderRadius: "1rem",
          }}
        >
          Tabulador 2026
        </span>
      </div>

      {/* Selector y buscador de categorías */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            data-testid="category-search-input"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar categoría (ej. Enfermera, Médico, Chofer...)"
            style={{ ...inputStyle, paddingLeft: "1.75rem" }}
          />
          <MagnifyingGlass
            size={14}
            style={{
              position: "absolute",
              left: "0.55rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: isDark ? "#94a3b8" : "#64748b",
            }}
          />
        </div>

        <div>
          <label htmlFor="category-select" style={labelStyle}>
            Categoría seleccionada ({filteredCategories.length} disponibles)
          </label>
          <select
            id="category-select"
            data-testid="category-dropdown-select"
            value={currentCategory?.nombre ?? ""}
            onChange={(e) => handleSelectCategory(e.target.value)}
            style={{ ...inputStyle, marginTop: "0.2rem", cursor: "pointer" }}
          >
            {filteredCategories.map((c) => (
              <option
                key={c.nombre}
                value={c.nombre}
                style={{
                  background: isDark ? "#0f172a" : "#ffffff",
                  color: isDark ? "#ffffff" : "#0f172a",
                }}
              >
                {c.nombre} · Sueldo base actual: {formatCurrency(c.sueldoQuincenal)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultados de la simulación */}
      {currentCategory && simulationResult && (
        <div
          data-testid="simulation-results"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.07)" : "var(--accent, #f8fafc)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid var(--border, #e2e8f0)",
            borderRadius: "0.375rem",
            padding: "0.65rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {/* Encabezado con la categoría y base actual */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 800, color: isDark ? "#ffffff" : "var(--fg, #0f172a)" }}>
              {currentCategory.nombre}
            </span>
            <span style={{ fontSize: "0.6875rem", color: isDark ? "#c7d2fe" : "var(--muted, #64748b)" }}>
              Base actual: {formatCurrency(currentCategory.sueldoQuincenal)} (Tabular) + {formatCurrency(currentCategory.concepto011)} (C11)
            </span>
          </div>

          {/* Comparativa entre negociaciones para esta categoría */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.45rem",
            }}
          >
            <div
              style={{
                padding: "0.45rem 0.6rem",
                borderRadius: "0.375rem",
                background: isDark ? "rgba(255, 255, 255, 0.06)" : "#ffffff",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid var(--border, #e2e8f0)",
              }}
            >
              <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: isDark ? "#94a3b8" : "var(--muted, #64748b)" }}>
                Propuesta anterior (2.9% + 86.05%)
              </div>
              <div
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 700,
                  color: isDark ? "#94a3b8" : "var(--muted, #64748b)",
                  textDecoration: "line-through",
                  marginTop: "0.15rem",
                }}
              >
                +{formatCurrency(simulationResult.previousProposalIncrease ?? 0)}
              </div>
            </div>

            <div
              style={{
                padding: "0.45rem 0.6rem",
                borderRadius: "0.375rem",
                background: isDark ? "rgba(34, 197, 94, 0.18)" : "rgba(34, 197, 94, 0.08)",
                border: isDark ? "1px solid rgba(74, 222, 128, 0.4)" : "1px solid rgba(34, 197, 94, 0.3)",
              }}
            >
              <div style={{ fontSize: "0.6875rem", fontWeight: 700, color: isDark ? "#86efac" : "#15803d" }}>
                Nuevo convenio (4.0% + 86.15%)
              </div>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 800,
                  color: isDark ? "#ffffff" : "#16a34a",
                  marginTop: "0.15rem",
                }}
              >
                +{formatCurrency(simulationResult.estimatedFortnightlyIncrease)}
              </div>
            </div>
          </div>

          {/* Ganancia diferencial lograda */}
          {(simulationResult.differentialGain ?? 0) > 0 && (
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: isDark ? "#86efac" : "#166534",
              }}
            >
              ▲ Ganancia adicional lograda: +{formatCurrency(simulationResult.differentialGain ?? 0)} quincenales sobre la propuesta previa
            </div>
          )}

          {/* Desglose de nuevos importes */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.6875rem",
              color: isDark ? "#cbd5e1" : "var(--muted, #64748b)",
              borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.1)" : "1px solid var(--border, #e2e8f0)",
              paddingTop: "0.35rem",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <span>Nuevo tabular proyectado: <strong>{formatCurrency(simulationResult.estimatedTabular)}</strong></span>
            <span>Nuevo Concepto 11 proyectado: <strong>{formatCurrency(simulationResult.estimatedConcept11)}</strong></span>
          </div>

          {/* Nota de certeza jurídica sobre antigüedad */}
          <div
            style={{
              fontSize: "0.6875rem",
              lineHeight: 1.4,
              color: isDark ? "#c7d2fe" : "var(--muted, #64748b)",
              fontStyle: "italic",
            }}
          >
            * El sueldo tabular (002) y la ayuda para renta (011) son importes fijos fijados por categoría y jornada en el CCT. Este aumento es idéntico e independiente de la antigüedad del trabajador.
          </div>
        </div>
      )}
    </div>
  )
}
