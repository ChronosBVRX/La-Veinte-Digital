"use client"

import { useState, useMemo } from "react"
import { Modal } from "@/shared/components/ui/Modal"
import { Input } from "@/shared/components/ui/Input"
import { Button } from "@/shared/components/ui/Button"
import type { DestinoCargoNombre } from "@/shared/contracts/escrito-draft"
import {
  CATEGORIAS_DESTINATARIOS,
  buscarDestinatarios,
  type DestinatarioItem,
  type DestinatarioCategoria,
} from "@/features/escritos/data/directorio-destinatarios"

export interface DestinatarioSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  currentDestino: DestinoCargoNombre
  onSelectDestino: (destino: DestinoCargoNombre) => void
  initialTab?: "directorio" | "manual"
}

export function DestinatarioSelectorModal({
  isOpen,
  onClose,
  currentDestino,
  onSelectDestino,
  initialTab = "directorio",
}: DestinatarioSelectorModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [tabOverride, setTabOverride] = useState<"directorio" | "manual" | null>(null)
  const [manualCargo, setManualCargo] = useState(currentDestino.cargo || "")
  const [manualNombre, setManualNombre] = useState(currentDestino.nombre || "")

  const activeTab = tabOverride ?? initialTab

  const filteredItems = useMemo(() => {
    return buscarDestinatarios(searchTerm)
  }, [searchTerm])

  const groupedItems = useMemo(() => {
    const groups: Partial<Record<DestinatarioCategoria, DestinatarioItem[]>> = {}
    for (const item of filteredItems) {
      if (!groups[item.categoria]) {
        groups[item.categoria] = []
      }
      groups[item.categoria]!.push(item)
    }
    return groups
  }, [filteredItems])

  const handleSelectOfficial = (item: DestinatarioItem) => {
    onSelectDestino({
      cargo: item.cargo,
      nombre: item.nombre,
    })
    onClose()
  }

  const handleApplyManual = () => {
    if (!manualCargo.trim() && !manualNombre.trim()) return
    onSelectDestino({
      cargo: manualCargo.trim(),
      nombre: manualNombre.trim(),
    })
    onClose()
  }

  const categoryOrder: DestinatarioCategoria[] = [
    "comite_ejecutivo",
    "secretarias",
    "comisiones",
    "subcomisiones",
    "comites_delegacionales",
  ]

  return (
    <Modal open={isOpen} onClose={onClose} title="Seleccionar Destinatario del Escrito">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "75vh" }}>
        {/* Toggle Directorio Oficial vs Destinatario Manual */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            background: "var(--accent)",
            padding: "0.25rem",
            borderRadius: "0.5rem",
          }}
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "directorio"}
            onClick={() => setTabOverride("directorio")}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "none",
              background: activeTab === "directorio" ? "var(--card)" : "transparent",
              color: activeTab === "directorio" ? "var(--primary)" : "var(--muted)",
              fontWeight: activeTab === "directorio" ? 600 : 500,
              fontSize: "0.875rem",
              cursor: "pointer",
              boxShadow: activeTab === "directorio" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            🏛️ Directorio Oficial Seccional
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "manual"}
            onClick={() => setTabOverride("manual")}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "none",
              background: activeTab === "manual" ? "var(--card)" : "transparent",
              color: activeTab === "manual" ? "var(--primary)" : "var(--muted)",
              fontWeight: activeTab === "manual" ? 600 : 500,
              fontSize: "0.875rem",
              cursor: "pointer",
              boxShadow: activeTab === "manual" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            ✍️ Destinatario Manual / Externo
          </button>
        </div>

        {activeTab === "directorio" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", overflow: "hidden" }}>
            {/* Buscador */}
            <Input
              id="buscador-destinatarios"
              label="Buscar por nombre, cargo o secretaría"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ej. Simbad, Trabajo, Previsión Social, Escalafón..."
              style={{ width: "100%" }}
              autoFocus
            />

            {/* Lista agrupada */}
            <div
              style={{
                overflowY: "auto",
                maxHeight: "360px",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                paddingRight: "0.25rem",
              }}
              role="region"
              aria-label="Resultados del Directorio Oficial"
            >
              {filteredItems.length === 0 ? (
                <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--muted)", fontSize: "0.875rem" }}>
                  No se encontraron integrantes en el directorio con el término &ldquo;{searchTerm}&rdquo;.
                  <div style={{ marginTop: "0.75rem" }}>
                    <Button variant="secondary" size="sm" onClick={() => setTabOverride("manual")}>
                      Escribir como destinatario manual
                    </Button>
                  </div>
                </div>
              ) : (
                categoryOrder.map((catKey) => {
                  const items = groupedItems[catKey]
                  if (!items || items.length === 0) return null
                  const catDef = CATEGORIAS_DESTINATARIOS[catKey]

                  return (
                    <div key={catKey} style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          color: "var(--primary)",
                          padding: "0.25rem 0.5rem",
                          background: "var(--accent)",
                          borderRadius: "0.25rem",
                        }}
                      >
                        {catDef.icono} {catDef.titulo}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        {items.map((item) => {
                          const isSelected =
                            currentDestino.nombre === item.nombre && currentDestino.cargo === item.cargo

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelectOfficial(item)}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                textAlign: "left",
                                padding: "0.625rem 0.75rem",
                                borderRadius: "0.375rem",
                                border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                                background: isSelected ? "var(--accent)" : "var(--card)",
                                cursor: "pointer",
                                transition: "background 0.1s ease",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                                <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--fg)" }}>
                                  {item.nombre}
                                </span>
                                {isSelected && (
                                  <span style={{ color: "var(--primary)", fontSize: "0.75rem", fontWeight: 700 }}>
                                    ✓ Seleccionado
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                                {item.cargo} · <span style={{ fontStyle: "italic" }}>{item.organo}</span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0.5rem 0" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0 }}>
              Utiliza esta opción para dirigir tu escrito a autoridades del Instituto (Director de Unidad, Jefatura de
              Personal, Jefatura de Enfermería) o a cualquier otra persona o cargo fuera del directorio seccional.
            </p>

            <Input
              id="manual-cargo-input"
              label="Cargo o puesto del destinatario"
              value={manualCargo}
              onChange={(e) => setManualCargo(e.target.value)}
              placeholder="Ej. Director de HGZ No. 1, Jefe de Personal, Delegado Sindical..."
              required
            />

            <Input
              id="manual-nombre-input"
              label="Nombre del destinatario (opcional o 'A quien corresponda')"
              value={manualNombre}
              onChange={(e) => setManualNombre(e.target.value)}
              placeholder="Ej. Dr. Juan Pérez García / A quien corresponda"
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleApplyManual}
                disabled={!manualCargo.trim() && !manualNombre.trim()}
              >
                Aplicar destinatario
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
