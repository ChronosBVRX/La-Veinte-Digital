"use client"

import { useState, type CSSProperties } from "react"
import { Card } from "@/shared/components/ui/Card"
import { Button } from "@/shared/components/ui/Button"
import { Input } from "@/shared/components/ui/Input"

const CONTAINER: CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  padding: "1rem",
}

const HEADER: CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  marginBottom: "1.5rem",
}

const TAB_BAR: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  marginBottom: "1.5rem",
  borderBottom: "1px solid var(--border)",
  paddingBottom: "0.5rem",
}

type Tab = "calendars" | "rules" | "conflicts"

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("calendars")

  return (
    <div style={CONTAINER}>
      <h1 style={HEADER}>Administración de Vacaciones</h1>

      <div style={TAB_BAR}>
        <Button
          variant={activeTab === "calendars" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("calendars")}
        >
          Calendarios
        </Button>
        <Button
          variant={activeTab === "rules" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("rules")}
        >
          Reglas
        </Button>
        <Button
          variant={activeTab === "conflicts" ? "primary" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("conflicts")}
        >
          Conflictos
        </Button>
      </div>

      {activeTab === "calendars" && <CalendarManager />}
      {activeTab === "rules" && <RuleManager />}
      {activeTab === "conflicts" && <ConflictViewer />}
    </div>
  )
}

function CalendarManager() {
  return (
    <div>
      <Card padding="1.25rem" style={{ marginBottom: "1rem" }}>
        <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Importar Calendario Anual</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Input label="Año" type="number" defaultValue="2026" />
          <Input label="Versión" defaultValue="v1" />
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "0.25rem" }}>
              Importar archivo JSON o CSV
            </label>
            <input
              type="file"
              accept=".json,.csv"
              style={{
                width: "100%", padding: "0.5rem",
                borderRadius: "var(--radius)", border: "1px solid var(--border)",
                fontSize: "0.85rem",
              }}
            />
          </div>
          <Button>Importar</Button>
        </div>
      </Card>

      <Card padding="1.25rem">
        <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Calendarios Existentes</h3>
        <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
          <p>No hay calendarios cargados todavía.</p>
          <p style={{ marginTop: "0.5rem" }}>Crea un nuevo calendario usando el formulario de importación.</p>
        </div>
      </Card>
    </div>
  )
}

function RuleManager() {
  return (
    <Card padding="1.25rem">
      <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Reglas Configurables</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <RuleItem
          code="CCT_47_ANNUAL_DAYS"
          label="Días anuales CCT"
          source="CCT 2025-2027 - Cláusula 47"
          enabled
        />
        <RuleItem
          code="PROC_ANTICIPACION_SEMESTRAL"
          label="Anticipación semestral (máx. 120 días)"
          source="Procedimiento 1A74-003-025"
          enabled
        />
        <RuleItem
          code="PROC_ANTICIPACION_CUATRIMESTRAL"
          label="Anticipación cuatrimestral (máx. 105 días)"
          source="Procedimiento 1A74-003-025"
          enabled
        />
        <RuleItem
          code="PROC_V20_NO_FRACTION"
          label="V20 - Sin fraccionamiento"
          source="Procedimiento 1A74-003-025 - Anexo 2"
          enabled
        />
      </div>
    </Card>
  )
}

function RuleItem({ code, label, source, enabled }: { code: string; label: string; source: string; enabled: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "0.5rem 0.75rem", borderRadius: "var(--radius)",
      background: "var(--accent)",
    }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{code} — {source}</div>
      </div>
      <div style={{
        padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)",
        fontSize: "0.7rem", fontWeight: 600,
        background: enabled ? "#dcfce7" : "#fef3c7",
        color: enabled ? "#166534" : "#92400e",
      }}>
        {enabled ? "Activa" : "Inactiva"}
      </div>
    </div>
  )
}

function ConflictViewer() {
  return (
    <Card padding="1.25rem">
      <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>Conflictos Normativos Detectados</h3>
      <div style={{ padding: "1rem", background: "var(--accent)", borderRadius: "var(--radius)", fontSize: "0.85rem", color: "var(--muted)" }}>
        <p><strong>Conflicto conocido:</strong> CCT 2025-2027 establece mínimo 16 días hábiles. Algunas filas del Anexo 1 muestran rangos desde 15 días.</p>
        <p style={{ marginTop: "0.5rem" }}>
          <strong>Resolución:</strong> El sistema utiliza los valores del CCT vigente para el derecho sustantivo.
          Las tablas administrativas se conservan como metadato operativo.
        </p>
      </div>
    </Card>
  )
}
