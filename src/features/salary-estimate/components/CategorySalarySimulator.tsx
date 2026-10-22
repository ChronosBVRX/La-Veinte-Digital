"use client"

import { useState, useMemo } from "react"
import { Calculator, MagnifyingGlass, XCircle, CheckCircle, Sparkle } from "@phosphor-icons/react"
import {
  CATALOGO_CATEGORIAS,
  normalizeCategoryName,
  matchCategorySearch,
  type CategoriaSalarial,
} from "@/shared/lib/catalogo-categorias"
import {
  calculateSalaryIncrease,
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

const QUICK_CATEGORY_FILTERS = [
  { id: "all", label: "🌟 Todas", query: "" },
  { id: "medicos", label: "🩺 Médicos & Residentes", query: "MEDICO" },
  { id: "enfermeria", label: "💉 Enfermería", query: "ENFERMERA" },
  { id: "limpieza", label: "🧹 Limpieza & Higiene", query: "LIMPIEZA" },
  { id: "asistente", label: "📋 Asistente Médica", query: "ASISTENTE MEDICA" },
  { id: "admon", label: "🧮 Administrativos", query: "ADMON" },
  { id: "farmacia", label: "💊 Farmacia", query: "FARMACIA" },
  { id: "chofer", label: "🚗 Chofer & Ambulancia", query: "CHOFER" },
] as const

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
  const [activeQuickFilterId, setActiveQuickFilterId] = useState<string>("all")

  const [selectedCategoryName, setSelectedCategoryName] = useState<string>(() => {
    if (initialCategoryName) {
      const norm = normalizeCategoryName(initialCategoryName)
      const found = uniqueCategories.find((c) => normalizeCategoryName(c.nombre) === norm)
      if (found) return found.nombre
    }
    return uniqueCategories[0]?.nombre ?? ""
  })

  // 3. Filtrar categorías según la búsqueda inteligente y sinónimos
  const filteredCategories = useMemo(() => {
    let list = uniqueCategories

    // Si hay texto en el input, tiene prioridad y usa búsqueda con sinónimos
    if (searchFilter.trim()) {
      list = uniqueCategories.filter((c) => matchCategorySearch(c.nombre, searchFilter))
    } else if (activeQuickFilterId !== "all") {
      const qf = QUICK_CATEGORY_FILTERS.find((f) => f.id === activeQuickFilterId)
      if (qf && qf.query) {
        list = uniqueCategories.filter((c) => matchCategorySearch(c.nombre, qf.query))
      }
    }

    return list
  }, [uniqueCategories, searchFilter, activeQuickFilterId])

  // 4. Categoría actualmente activa
  const currentCategory = useMemo<CategoriaSalarial | null>(() => {
    if (selectedCategoryName) {
      const found = uniqueCategories.find(
        (c) => normalizeCategoryName(c.nombre) === normalizeCategoryName(selectedCategoryName),
      )
      if (found) return found
    }
    return filteredCategories[0] ?? null
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

  const handleQuickFilterClick = (filterId: string) => {
    setActiveQuickFilterId(filterId)
    setSearchFilter("")
    const qf = QUICK_CATEGORY_FILTERS.find((f) => f.id === filterId)
    if (qf && qf.query) {
      const matches = uniqueCategories.filter((c) => matchCategorySearch(c.nombre, qf.query))
      if (matches.length > 0) {
        handleSelectCategory(matches[0].nombre)
      }
    }
  }

  const handleClearSearch = () => {
    setSearchFilter("")
    setActiveQuickFilterId("all")
  }

  // Estilos temáticos
  const containerStyle: React.CSSProperties = {
    background: isDark ? "rgba(15, 23, 42, 0.55)" : "var(--card, #ffffff)",
    border: isDark ? "1px solid rgba(255, 255, 255, 0.22)" : "1px solid var(--border, #e2e8f0)",
    borderRadius: "var(--radius-lg, 0.75rem)",
    padding: "1rem",
    color: isDark ? "#ffffff" : "var(--fg, #0f172a)",
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
    boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "0.72rem",
    fontWeight: 800,
    color: isDark ? "#c7d2fe" : "var(--muted, #64748b)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.75rem",
    borderRadius: "0.5rem",
    fontSize: "0.875rem",
    background: isDark ? "rgba(15, 23, 42, 0.75)" : "#ffffff",
    border: isDark ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid var(--border, #cbd5e1)",
    color: isDark ? "#ffffff" : "var(--fg, #0f172a)",
    boxSizing: "border-box",
    outline: "none",
  }

  return (
    <div data-testid="category-salary-simulator" style={containerStyle}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: isDark ? "rgba(191, 219, 254, 0.22)" : "rgba(37, 99, 235, 0.12)",
              color: isDark ? "#bfdbfe" : "var(--primary, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Calculator size={16} weight="bold" />
          </span>
          <div>
            <span style={{ fontSize: "0.875rem", fontWeight: 800, color: isDark ? "#ffffff" : "var(--fg, #0f172a)" }}>
              Simulador de aumento por categoría
            </span>
            <div style={{ fontSize: "0.6875rem", color: isDark ? "#94a3b8" : "var(--muted, #64748b)" }}>
              {uniqueCategories.length} categorías oficiales contractuales
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 800,
            color: isDark ? "#86efac" : "#15803d",
            background: isDark ? "rgba(34, 197, 94, 0.2)" : "rgba(34, 197, 94, 0.1)",
            border: isDark ? "1px solid rgba(74, 222, 128, 0.3)" : "1px solid rgba(34, 197, 94, 0.25)",
            padding: "0.2rem 0.55rem",
            borderRadius: "999px",
            letterSpacing: "0.04em",
          }}
        >
          Convenio 2026
        </span>
      </div>

      {/* Buscador inteligente */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            data-testid="category-search-input"
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value)
              setActiveQuickFilterId("all")
              // Si el usuario escribe y coincide con al menos una, seleccionamos la primera automáticamente
              const matches = uniqueCategories.filter((c) => matchCategorySearch(c.nombre, e.target.value))
              if (matches.length > 0 && e.target.value.trim().length >= 3) {
                handleSelectCategory(matches[0].nombre)
              }
            }}
            placeholder="Escribe tu puesto (ej. Enfermera, Médico No Familiar, Limpieza, Chofer, Residente...)"
            style={{ ...inputStyle, paddingLeft: "2rem", paddingRight: searchFilter ? "2rem" : "0.75rem" }}
          />
          <MagnifyingGlass
            size={16}
            style={{
              position: "absolute",
              left: "0.65rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: isDark ? "#94a3b8" : "#64748b",
            }}
          />
          {searchFilter && (
            <button
              type="button"
              onClick={handleClearSearch}
              title="Borrar búsqueda"
              style={{
                position: "absolute",
                right: "0.6rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: isDark ? "#cbd5e1" : "#64748b",
                display: "flex",
                alignItems: "center",
              }}
            >
              <XCircle size={18} weight="fill" />
            </button>
          )}
        </div>

        {/* Píldoras de filtro rápido por rama */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", overflowX: "auto", paddingBottom: "0.2rem" }}>
          {QUICK_CATEGORY_FILTERS.map((f) => {
            const isSelected = activeQuickFilterId === f.id && !searchFilter.trim()
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleQuickFilterClick(f.id)}
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: isSelected ? 800 : 600,
                  padding: "0.25rem 0.55rem",
                  borderRadius: "999px",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  border: isSelected
                    ? isDark
                      ? "1px solid #38bdf8"
                      : "1px solid #2563eb"
                    : isDark
                      ? "1px solid rgba(255, 255, 255, 0.15)"
                      : "1px solid var(--border, #cbd5e1)",
                  background: isSelected
                    ? isDark
                      ? "rgba(56, 189, 248, 0.22)"
                      : "rgba(37, 99, 235, 0.12)"
                    : isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "#ffffff",
                  color: isSelected
                    ? isDark
                      ? "#38bdf8"
                      : "#1d4ed8"
                    : isDark
                      ? "#cbd5e1"
                      : "var(--muted, #64748b)",
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Tarjetas de Selección Rápida cuando hay pocos resultados */}
        {filteredCategories.length > 0 && filteredCategories.length <= 6 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginTop: "0.15rem" }}>
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: isDark ? "#93c5fd" : "var(--primary, #2563eb)" }}>
              Coincidencias encontradas (toca una para calcular):
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.35rem" }}>
              {filteredCategories.map((c) => {
                const isCurrent = currentCategory?.nombre === c.nombre
                return (
                  <button
                    key={c.nombre}
                    type="button"
                    onClick={() => handleSelectCategory(c.nombre)}
                    style={{
                      textAlign: "left",
                      padding: "0.45rem 0.6rem",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      transition: "all 0.15s ease",
                      border: isCurrent
                        ? isDark
                          ? "1.5px solid #4ade80"
                          : "1.5px solid #16a34a"
                        : isDark
                          ? "1px solid rgba(255, 255, 255, 0.15)"
                          : "1px solid var(--border, #cbd5e1)",
                      background: isCurrent
                        ? isDark
                          ? "rgba(34, 197, 94, 0.18)"
                          : "rgba(34, 197, 94, 0.1)"
                        : isDark
                          ? "rgba(255, 255, 255, 0.04)"
                          : "#ffffff",
                      color: isDark ? "#ffffff" : "var(--fg, #0f172a)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.4rem",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontWeight: isCurrent ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.nombre}
                      </span>
                      <span style={{ fontSize: "0.625rem", color: isDark ? "#94a3b8" : "var(--muted, #64748b)" }}>
                        Base: {formatCurrency(c.sueldoQuincenal)}
                      </span>
                    </div>
                    {isCurrent && <CheckCircle size={14} weight="fill" color={isDark ? "#4ade80" : "#16a34a"} />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Dropdown nativo accesible */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
            <label htmlFor="category-select" style={labelStyle}>
              Categoría a simular ({filteredCategories.length} disponibles)
            </label>
            {filteredCategories.length === 0 && (
              <span style={{ fontSize: "0.6875rem", color: isDark ? "#fca5a5" : "#dc2626" }}>
                Sin resultados
              </span>
            )}
          </div>
          <select
            id="category-select"
            data-testid="category-dropdown-select"
            value={currentCategory?.nombre ?? ""}
            onChange={(e) => handleSelectCategory(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
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
                {c.nombre} · Sueldo actual: {formatCurrency(c.sueldoQuincenal)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Si no hay resultados de búsqueda, sugerencias amigables */}
      {filteredCategories.length === 0 && (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.5rem",
            background: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.06)",
            border: isDark ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid rgba(239, 68, 68, 0.2)",
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
          }}
        >
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: isDark ? "#fca5a5" : "#dc2626" }}>
            No encontramos &quot;{searchFilter}&quot;
          </span>
          <span style={{ fontSize: "0.6875rem", color: isDark ? "#cbd5e1" : "var(--muted, #64748b)" }}>
            Prueba buscando por palabras clave generales como: <strong>Médico</strong>, <strong>Enfermera</strong>, <strong>Limpieza</strong>, <strong>Residente</strong>, <strong>Chofer</strong> o <strong>Administrativo</strong>.
          </span>
          <button
            type="button"
            onClick={handleClearSearch}
            style={{
              alignSelf: "flex-start",
              fontSize: "0.6875rem",
              fontWeight: 700,
              padding: "0.2rem 0.5rem",
              borderRadius: "0.25rem",
              background: isDark ? "rgba(255, 255, 255, 0.12)" : "#ffffff",
              border: isDark ? "1px solid rgba(255, 255, 255, 0.2)" : "1px solid var(--border, #cbd5e1)",
              color: isDark ? "#ffffff" : "var(--fg, #0f172a)",
              cursor: "pointer",
              marginTop: "0.2rem",
            }}
          >
            Ver todas las categorías
          </button>
        </div>
      )}

      {/* Resultados de la simulación */}
      {currentCategory && simulationResult && (
        <div
          data-testid="simulation-results"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.08)" : "var(--accent, #f8fafc)",
            border: isDark ? "1px solid rgba(255, 255, 255, 0.15)" : "1px solid var(--border, #e2e8f0)",
            borderRadius: "0.5rem",
            padding: "0.75rem 0.85rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          {/* Encabezado con la categoría y base actual */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.35rem" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 900, color: isDark ? "#ffffff" : "var(--fg, #0f172a)" }}>
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
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                padding: "0.5rem 0.65rem",
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
                padding: "0.5rem 0.65rem",
                borderRadius: "0.375rem",
                background: isDark ? "rgba(34, 197, 94, 0.22)" : "rgba(34, 197, 94, 0.09)",
                border: isDark ? "1px solid rgba(74, 222, 128, 0.45)" : "1px solid rgba(34, 197, 94, 0.35)",
              }}
            >
              <div style={{ fontSize: "0.6875rem", fontWeight: 800, color: isDark ? "#86efac" : "#15803d" }}>
                Nuevo convenio (4.0% + 86.15%)
              </div>
              <div
                style={{
                  fontSize: "1.0625rem",
                  fontWeight: 900,
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
                fontWeight: 800,
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
              borderTop: isDark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid var(--border, #e2e8f0)",
              paddingTop: "0.4rem",
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
