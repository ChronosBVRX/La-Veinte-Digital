"use client"

import { useMemo, useState, useEffect, type CSSProperties } from "react"
import { BookMarked, Search, Library, Database, GitCompareArrows, BookOpen, Sparkles } from "lucide-react"
import type { LibraryData, LibraryDocumentEntry } from "../services/catalog"
import { DocumentCard } from "./DocumentCard"
import { DocumentDetail } from "./DocumentDetail"
import { BusquedaNormativa } from "./BusquedaNormativa"
import { PanelComparador } from "./PanelComparador"
import { NormativaOfflineDownloadCard } from "./NormativaOfflineDownloadCard"
import { NormativeReferenceModal } from "@/shared/components/normativa/NormativeReferenceModal"
import { PreambulosNormativaView } from "./PreambulosNormativaView"

interface Props {
  data: LibraryData
}

type TabId =
  | "todos" | "clinicos" | "administrativos" | "cct" | "reglamentos" | "procedimientos" | "sntss" | "leyes" | "nom"
  | "riesgos" | "seguridad" | "integridad" | "tabuladores" | "historicos" | "pendientes"

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "clinicos", label: "Puestos Clínicos" },
  { id: "administrativos", label: "Personal Administrativo" },
  { id: "cct", label: "CCT" },
  { id: "reglamentos", label: "Reglamentos" },
  { id: "procedimientos", label: "Procedimientos IMSS" },
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
    case "clinicos":
      return (
        doc.category === "flujos-clinicos" ||
        /enfermer|asistente|médic|radiodiag|imagenolog|rayos|camiller|laboratorio|farmacia|urgencias|triage|nutrici|ceye|sangre/i.test(doc.title)
      )
    case "administrativos":
      return (
        doc.category === "administrativos" ||
        /administrativ|auo|oficinas|arimac|archivo|vigencia|almac|mantenimiento|ambulancia|taod|soporte|informática/i.test(doc.title)
      )
    case "cct":
      return doc.category === "cct" || doc.type === "collective_agreement"
    case "reglamentos":
      return ["regulation", "institutional_regulation", "federal_regulation", "union_regulation"].includes(doc.type)
    case "procedimientos":
      return (
        doc.type === "procedure" ||
        doc.category === "procedimientos" ||
        doc.category === "flujos-clinicos" ||
        doc.category === "administrativos"
      )
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
  display: "flex", flexDirection: "column", gap: "1rem", padding: "clamp(0.75rem, 3vw, 1.25rem)", maxWidth: 1200, margin: "0 auto",
  width: "100%", minWidth: 0, boxSizing: "border-box",
}

export function BibliotecaNormativaPage({ data }: Props) {
  const [tab, setTab] = useState<TabId>("todos")
  const [selected, setSelected] = useState<LibraryDocumentEntry | null>(null)
  const [mode, setMode] = useState<"preambulos" | "biblioteca" | "buscar" | "comparar">("preambulos")
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const checkWidth = () => {
      setIsDesktop(typeof window !== "undefined" && window.innerWidth >= 768)
    }
    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  const filtered = useMemo(() => data.documents.filter((d) => matchTab(d, tab)), [data.documents, tab])

  const h = data.health
  const pendientes = data.documents.filter((d) => matchTab(d, "pendientes")).length

  return (
    <div style={containerStyle}>
      <div style={{ width: "100%", minWidth: 0 }}>
        <h1 style={{ fontSize: "clamp(1.125rem, 4vw, 1.5rem)", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", wordBreak: "break-word" }}>
          <Library size={24} color="var(--primary)" style={{ flexShrink: 0 }} /> Biblioteca Normativa
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: "0.25rem 0 0", wordBreak: "break-word" }}>
          Marco normativo oficial IMSS y SNTSS con sustento documental verificado. Explicaciones claras y fundamentadas al servicio de la base trabajadora.
        </p>
      </div>

      {!data.available ? (
        <div style={{ ...cardStyle, borderColor: "#f59e0b" }}>
          <Database size={20} />
          <div>
            <strong>Acervo normativo en actualización.</strong>
            <p style={{ margin: "0.25rem 0 0", color: "var(--muted)", fontSize: "0.875rem" }}>
              Puedes consultar libremente las guías prácticas, procedimientos y temas frecuentes en las secciones inferiores.
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: "0.45rem",
            padding: "0.45rem 0.65rem",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            alignItems: "center",
            overflowX: "auto",
            flexWrap: "nowrap",
            scrollbarWidth: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {h && (
            <>
              <span style={{ ...chipStyle, flexShrink: 0, whiteSpace: "nowrap" }}>📚 <strong>{h.documents}</strong> documentos oficiales</span>
              <span style={{ ...chipStyle, color: "#15803d", flexShrink: 0, whiteSpace: "nowrap" }}>🟢 {h.vigentes} vigentes</span>
              {h.historicos > 0 && <span style={{ ...chipStyle, color: "#1d4ed8", flexShrink: 0, whiteSpace: "nowrap" }}>🔵 {h.historicos} históricos</span>}
              {h.sections > 0 && <span style={{ ...chipStyle, flexShrink: 0, whiteSpace: "nowrap" }}>📑 {h.sections} artículos y cláusulas</span>}
              {h.nextExpiration && (
                <span style={{ ...chipStyle, color: "#b45309", border: "1px solid #f59e0b", flexShrink: 0, whiteSpace: "nowrap" }}>
                  ⏳ Próxima revisión: {h.nextExpiration.document.replace("IMSS-", "")} ({h.nextExpiration.date})
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Selector de modo - Riel horizontal deslizable sin amontonamiento */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          overflowX: "auto",
          flexWrap: "nowrap",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          padding: "0.2rem 0",
          width: "100%",
        }}
      >
        <button
          onClick={() => setMode("preambulos")}
          style={{
            ...(mode === "preambulos" ? activeMode : modeStyle),
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <Sparkles size={16} /> Guías Prácticas
        </button>
        <button
          onClick={() => setMode("biblioteca")}
          style={{
            ...(mode === "biblioteca" ? activeMode : modeStyle),
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <BookMarked size={16} /> Catálogo Oficial
        </button>
        <button
          onClick={() => setMode("buscar")}
          style={{
            ...(mode === "buscar" ? activeMode : modeStyle),
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <Search size={16} /> Búsqueda en Texto
        </button>
        <button
          onClick={() => setMode("comparar")}
          style={{
            ...(mode === "comparar" ? activeMode : modeStyle),
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <GitCompareArrows size={16} /> Comparador CCT
        </button>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            ...modeStyle,
            background: "rgba(37, 99, 235, 0.08)",
            color: "var(--primary)",
            borderColor: "rgba(37, 99, 235, 0.3)",
            fontWeight: 600,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <BookOpen size={16} /> Consulta Rápida CCT / Estatutos
        </button>
      </div>

      {mode === "preambulos" && (
        <PreambulosNormativaView
          documents={data.documents}
          onOpenDoc={(d) => setSelected(d)}
        />
      )}

      {mode === "biblioteca" && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "nowrap",
              overflowX: "auto",
              gap: "0.35rem",
              width: "100%",
              minWidth: 0,
              padding: "0.15rem 0",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  ...(tab === t.id ? activeTabStyle : tabStyle),
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
                {t.id === "pendientes" && pendientes > 0 ? ` (${pendientes})` : ""}
              </button>
            ))}
          </div>

          {(tab === "todos" || tab === "cct" || tab === "sntss") && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
              {(tab === "todos" || tab === "cct") && (
                <NormativaOfflineDownloadCard docId="CCT-IMSS-SNTSS-2025-2027" />
              )}
              {(tab === "todos" || tab === "sntss") && (
                <NormativaOfflineDownloadCard docId="SNTSS-ESTATUTOS-2022" />
              )}
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(260px, 1fr))" : "repeat(2, minmax(0, 1fr))",
              gap: "0.6rem",
              width: "100%",
              minWidth: 0,
              boxSizing: "border-box",
            }}
          >
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onOpen={() => setSelected(doc)} />
            ))}
            {filtered.length === 0 && (
              <p style={{ color: "var(--muted)", gridColumn: "1 / -1", textAlign: "center", padding: "2rem 0" }}>
                No hay documentos en esta pestaña.
              </p>
            )}
          </div>
        </>
      )}

      {mode === "buscar" && <BusquedaNormativa />}
      {mode === "comparar" && <PanelComparador />}

      {selected && <DocumentDetail doc={selected} onClose={() => setSelected(null)} />}
      <NormativeReferenceModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}

const cardStyle: CSSProperties = { display: "flex", gap: "0.75rem", alignItems: "flex-start", padding: "1rem", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }
const chipStyle: CSSProperties = { fontSize: "0.8rem", padding: "0.25rem 0.6rem", background: "var(--accent)", borderRadius: 999 }
const modeStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 0.9rem", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--fg)", cursor: "pointer", fontSize: "0.85rem" }
const activeMode: CSSProperties = { ...modeStyle, background: "var(--primary)", color: "var(--primary-fg)", borderColor: "var(--primary)" }
const tabStyle: CSSProperties = { padding: "0.35rem 0.7rem", borderRadius: 999, border: "1px solid var(--border)", background: "var(--card)", color: "var(--fg)", cursor: "pointer", fontSize: "0.8rem" }
const activeTabStyle: CSSProperties = { ...tabStyle, background: "var(--primary)", color: "var(--primary-fg)", borderColor: "var(--primary)" }
