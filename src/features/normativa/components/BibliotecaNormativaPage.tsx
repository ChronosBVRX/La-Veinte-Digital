"use client"

import { useMemo, useState, type CSSProperties } from "react"
import { BookMarked, Search, Radio, Library, Database, RefreshCw, GitCompareArrows, Mic2 } from "lucide-react"
import type { LibraryData, LibraryDocumentEntry } from "../services/catalog"
import { DocumentCard } from "./DocumentCard"
import { DocumentDetail } from "./DocumentDetail"
import { BusquedaNormativa } from "./BusquedaNormativa"
import { InvestigacionPanel } from "./InvestigacionPanel"
import { PanelSincronizacion } from "./PanelSincronizacion"
import { PanelComparador } from "./PanelComparador"
import { PanelTtsDiagnostico } from "./PanelTtsDiagnostico"

interface Props {
  data: LibraryData
}

type TabId =
  | "todos" | "cct" | "reglamentos" | "procedimientos" | "sntss" | "leyes" | "nom"
  | "riesgos" | "seguridad" | "integridad" | "tabuladores" | "historicos" | "pendientes"

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "cct", label: "CCT" },
  { id: "reglamentos", label: "Reglamentos" },
  { id: "procedimientos", label: "Procedimientos" },
  { id: "sntss", label: "SNTSS" },
  { id: "leyes", label: "Leyes" },
  { id: "nom", label: "NOM" },
  { id: "riesgos", label: "Riesgos de trabajo" },
  { id: "seguridad", label: "Seguridad e higiene" },
  { id: "integridad", label: "Integridad" },
  { id: "tabuladores", label: "Tabuladores" },
  { id: "historicos", label: "Históricos" },
  { id: "pendientes", label: "Pendientes de verificar" },
]

function matchTab(doc: LibraryDocumentEntry, tab: TabId): boolean {
  switch (tab) {
    case "todos":
      return true
    case "cct":
      return doc.category === "cct" || doc.type === "collective_agreement"
    case "reglamentos":
      return ["regulation", "institutional_regulation", "federal_regulation", "union_regulation"].includes(doc.type)
    case "procedimientos":
      return doc.type === "procedure"
    case "sntss":
      return doc.category === "sntss" || ["union_statutes", "union_regulation"].includes(doc.type)
    case "leyes":
      return ["federal_law", "federal_regulation"].includes(doc.type)
    case "nom":
      return doc.type === "NOM"
    case "riesgos":
      return doc.category === "riesgos-trabajo" || (doc.type === "procedure" && /accidentes|enfermedades de trabajo/i.test(doc.title))
    case "seguridad":
      return doc.category === "seguridad-salud" || (doc.type === "NOM" && /seguridad|higiene|protecci|ergon|psicosocial|carga/i.test(doc.title))
    case "integridad":
      return doc.category === "integridad" || /conducta|denuncia|violencia|acoso|protocolo/i.test(doc.title)
    case "tabuladores":
      return doc.category === "tabuladores" || doc.type === "salary_table"
    case "historicos":
      return doc.validity === "HISTORICAL"
    case "pendientes":
      return (
        doc.validity === "PENDING_REVIEW" ||
        doc.validity === "UNKNOWN" ||
        doc.verificationStatus != null ||
        doc.versionStatus === "SOURCE_MISMATCH" ||
        doc.versionStatus === "ERROR"
      )
  }
}

const containerStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: "1rem", padding: "1.25rem", maxWidth: 1200, margin: "0 auto",
}

export function BibliotecaNormativaPage({ data }: Props) {
  const [tab, setTab] = useState<TabId>("todos")
  const [selected, setSelected] = useState<LibraryDocumentEntry | null>(null)
  const [mode, setMode] = useState<"biblioteca" | "buscar" | "investigar" | "sincronizar" | "comparar" | "voces">("biblioteca")
  const [researchTopic, setResearchTopic] = useState<string>("")

  const startEpisode = (topic: string) => {
    setResearchTopic(topic)
    setMode("investigar")
  }

  const filtered = useMemo(() => data.documents.filter((d) => matchTab(d, tab)), [data.documents, tab])

  const h = data.health
  const pendientes = data.documents.filter((d) => matchTab(d, "pendientes")).length

  return (
    <div style={containerStyle}>
      <div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Library size={24} color="var(--primary)" /> Biblioteca Normativa
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0" }}>
          Sistema de evidencia documental IMSS/SNTSS. La IA no es la fuente: la fuente es el documento.
          Fecha de corte del corpus: 14 de agosto de 2026.
        </p>
      </div>

      {!data.available ? (
        <div style={{ ...cardStyle, borderColor: "#f59e0b" }}>
          <Database size={20} />
          <div>
            <strong>La biblioteca no está inicializada en este entorno.</strong>
            <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.875rem" }}>
              Ejecuta <code>npm run normativa:bootstrap</code> en el servidor para descargar, verificar e indexar el corpus.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", padding: "0.875rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
          {h && (
            <>
              <span style={chipStyle}><strong>{h.documents}</strong> documentos</span>
              <span style={{ ...chipStyle, color: "#15803d" }}>🟢 Vigentes: {h.vigentes}</span>
              <span style={{ ...chipStyle, color: "#b45309" }}>🟡 Revisar: {h.revisar + pendientes}</span>
              <span style={{ ...chipStyle, color: "#1d4ed8" }}>🔵 Históricos: {h.historicos}</span>
              <span style={{ ...chipStyle, color: "#b91c1c" }}>🔴 Error: {h.errores}</span>
              <span style={chipStyle}>{h.sections} secciones · {h.chunks} fragmentos indexados</span>
              {h.nextExpiration && (
                <span style={{ ...chipStyle, color: "#b45309", border: "1px solid #f59e0b" }}>
                  ⏳ Próxima expiración: {h.nextExpiration.document.replace("IMSS-", "")} — {h.nextExpiration.date}
                </span>
              )}
            </>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={() => setMode("biblioteca")} style={mode === "biblioteca" ? activeMode : modeStyle}>
          <BookMarked size={16} /> Biblioteca
        </button>
        <button onClick={() => setMode("buscar")} style={mode === "buscar" ? activeMode : modeStyle}>
          <Search size={16} /> Buscar en normativa
        </button>
        <button onClick={() => setMode("investigar")} style={mode === "investigar" ? activeMode : modeStyle}>
          <Radio size={16} /> Investigar para episodio
        </button>
        <button onClick={() => setMode("sincronizar")} style={mode === "sincronizar" ? activeMode : modeStyle}>
          <RefreshCw size={16} /> Sincronización
        </button>
        <button onClick={() => setMode("comparar")} style={mode === "comparar" ? activeMode : modeStyle}>
          <GitCompareArrows size={16} /> Comparador CCT
        </button>
        <button onClick={() => setMode("voces")} style={mode === "voces" ? activeMode : modeStyle}>
          <Mic2 size={16} /> Voces (TTS)
        </button>
      </div>

      {mode === "biblioteca" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} style={tab === t.id ? activeTabStyle : tabStyle}>
                {t.label}
                {t.id === "pendientes" && pendientes > 0 ? ` (${pendientes})` : ""}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.875rem" }}>
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onOpen={() => setSelected(doc)} />
            ))}
            {filtered.length === 0 && (
              <p style={{ color: "var(--muted)", gridColumn: "1 / -1" }}>No hay documentos en esta pestaña.</p>
            )}
          </div>
        </>
      )}

      {mode === "buscar" && <BusquedaNormativa onCrearEpisodio={startEpisode} />}
      {mode === "investigar" && <InvestigacionPanel initialTopic={researchTopic} />}
      {mode === "sincronizar" && <PanelSincronizacion />}
      {mode === "comparar" && <PanelComparador />}
      {mode === "voces" && <PanelTtsDiagnostico />}

      {selected && <DocumentDetail doc={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

const cardStyle: CSSProperties = { display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "1rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }
const chipStyle: CSSProperties = { fontSize: "0.8rem", padding: "0.25rem 0.6rem", background: "var(--accent)", borderRadius: 999 }
const modeStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--fg)", cursor: "pointer", fontSize: "0.85rem" }
const activeMode: CSSProperties = { ...modeStyle, background: "var(--primary)", color: "var(--primary-fg)", borderColor: "var(--primary)" }
const tabStyle: CSSProperties = { padding: "0.35rem 0.7rem", borderRadius: 999, border: "1px solid var(--border)", background: "var(--card)", color: "var(--fg)", cursor: "pointer", fontSize: "0.8rem" }
const activeTabStyle: CSSProperties = { ...tabStyle, background: "var(--primary)", color: "var(--primary-fg)", borderColor: "var(--primary)" }
