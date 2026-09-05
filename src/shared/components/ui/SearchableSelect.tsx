"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Input } from "./Input"
import { useBackLayer } from "@/shared/navigation/useBackLayer"

export interface SearchableOption {
  label: string
  value: string
}

interface Props {
  label: string
  name: string
  defaultValue?: string | null
  options: SearchableOption[]
  placeholder?: string
}

export function SearchableSelect({ label, name, defaultValue, options, placeholder }: Props) {
  const initial = defaultValue?.trim() ?? ""
  const [query, setQuery] = useState(initial)
  const [selectedValue, setSelectedValue] = useState(initial)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    if (!query || selectedValue === query) return []
    const q = query.toLowerCase()
    return options.filter((opt) => opt.label.toLowerCase().includes(q)).slice(0, 10)
  }, [options, query, selectedValue])

  // Capa transitoria canónica: Atrás cierra el desplegable (p. ej. popover
  // dentro de un modal) antes que retroceder de ruta.
  // Todos los cierres desembocan en setIsOpen(false): click fuera, selección y Atrás.
  const dropdownVisible = isOpen && filtered.length > 0
  useBackLayer(dropdownVisible, () => setIsOpen(false), "searchable-select")

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const handleSelect = (opt: SearchableOption) => {
    setSelectedValue(opt.value)
    setQuery(opt.label)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <Input
        label={label}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (selectedValue) setSelectedValue("")
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder ?? `Buscar ${label.toLowerCase()}...`}
        autoComplete="off"
      />
      <input type="hidden" name={name} value={selectedValue} />
      {isOpen && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
          marginTop: "0.25rem", background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", maxHeight: "200px", overflowY: "auto",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          {filtered.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem", border: "none",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                background: "transparent", cursor: "pointer", color: "var(--fg)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
