"use client"

import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  BookmarkCheck,
  Search,
  X,
  FileText,
} from "lucide-react"
import { loadPdfDocument } from "@/shared/lib/pdfjs-client"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import {
  saveNormativaToVault,
  isNormativaInVault,
} from "@/features/documentos-personales/services/normativa-boveda"
import {
  searchAllPages,
  type SearchMatch,
  type PageSearchData,
} from "@/shared/lib/pdf-search"

interface ExtendedWindow extends Window {
  find?: (q: string, caseSensitive?: boolean, backwards?: boolean, wrapAround?: boolean) => boolean
}

export interface PdfViewerProps {
  documentId: string
  initialPage?: number
  officialUrl?: string | null
  title?: string
  keyLabel?: string
  category?: string
}

export function PdfViewer({
  documentId,
  initialPage = 1,
  officialUrl = null,
  title,
  keyLabel,
  category,
}: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [page, setPage] = useState(initialPage)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.3)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [docType, setDocType] = useState<"pdf" | "html">("pdf")
  const [htmlContent, setHtmlContent] = useState<string>("")
  const [inVault, setInVault] = useState(() => isNormativaInVault(documentId))
  const [vaultToast, setVaultToast] = useState<string | null>(null)

  // Estados de Búsqueda Comercial
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([])
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const [showSnippets, setShowSnippets] = useState(false)
  const [searchProgress, setSearchProgress] = useState<{ scanned: number; total: number } | null>(null)

  // Popover de salto directo de página
  const [pageJumpOpen, setPageJumpOpen] = useState(false)
  const [pageJumpInput, setPageJumpInput] = useState("")

  // Sugerencia sutil de gestos táctiles (desaparece a los 4 seg)
  const [showGestureHint, setShowGestureHint] = useState(false)

  const pdfRef = useRef<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null)
  const searchCacheRef = useRef<Map<number, PageSearchData>>(new Map())
  const searchAbortRef = useRef<boolean>(false)
  const lastTapRef = useRef<number>(0)

  const url = `/api/normativa/visor?id=${encodeURIComponent(documentId)}`

  // Sincronizar estado de la bóveda mediante evento reactivo
  useEffect(() => {
    const onVaultChange = () => {
      setInVault(isNormativaInVault(documentId))
    }
    window.addEventListener("lvd:normativa-vault-changed", onVaultChange)
    return () => window.removeEventListener("lvd:normativa-vault-changed", onVaultChange)
  }, [documentId])

  const handleSaveToVault = () => {
    saveNormativaToVault({
      id: documentId,
      title: title || documentId,
      key: keyLabel,
      category,
      url: officialUrl,
    })
    setInVault(true)
    setVaultToast("¡Guardado en tu Bóveda (Pestaña Normativos)!")
    setTimeout(() => setVaultToast(null), 3500)
  }

  const handleDownloadAndSave = () => {
    saveNormativaToVault({
      id: documentId,
      title: title || documentId,
      key: keyLabel,
      category,
      url: officialUrl,
    })
    setInVault(true)
    setVaultToast("¡Descargando y registrado en tu Bóveda!")
    setTimeout(() => setVaultToast(null), 3500)
  }

  // Carga inicial del documento oficial
  useEffect(() => {
    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      setError(null)
      searchCacheRef.current.clear()
      setSearchMatches([])

      try {
        const res = await fetch(url)
        if (cancelled) return
        if (!res.ok) {
          throw new Error(`Código HTTP ${res.status}`)
        }

        const buf = await res.arrayBuffer()
        if (cancelled) return

        // Detección binaria de formato PDF vs HTML
        const firstBytes = new Uint8Array(buf.slice(0, 5))
        const isPdfMagic =
          firstBytes[0] === 0x25 &&
          firstBytes[1] === 0x50 &&
          firstBytes[2] === 0x44 &&
          firstBytes[3] === 0x46 // %PDF

        const formatHeader = res.headers.get("X-Normativa-Format")
        const contentType = res.headers.get("Content-Type") || ""
        const isHtml = formatHeader === "html" || contentType.includes("html") || !isPdfMagic

        if (isHtml) {
          const text = new TextDecoder("utf-8").decode(buf)
          setDocType("html")
          setHtmlContent(text)
          setLoading(false)
          setError(null)
          return
        }

        setDocType("pdf")
        const loaded = await loadPdfDocument(buf)
        if (cancelled) {
          void loaded.loadingTask.destroy()
          return
        }
        pdfRef.current = loaded
        setNumPages(loaded.pdf.numPages)
        setLoading(false)
        setError(null)

        // Mostrar breve indicación de gestos en móviles
        if (typeof window !== "undefined" && window.innerWidth < 768) {
          setShowGestureHint(true)
          setTimeout(() => setShowGestureHint(false), 4500)
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("[PdfViewer] Error cargando documento:", e)
          setError(e instanceof Error ? e.message : "Error al procesar el archivo")
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      void pdfRef.current?.loadingTask.destroy()
      pdfRef.current = null
    }
  }, [url, retryCount])

  // Renderizado de página en el Canvas de alta resolución
  useEffect(() => {
    if (docType !== "pdf") return
    const pdf = pdfRef.current
    if (!pdf) return
    let cancelled = false

    void pdf.pdf.getPage(page).then(async (p) => {
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      const viewport = p.getViewport({ scale })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      await p.render({ canvas, canvasContext: ctx, viewport }).promise
    })

    return () => {
      cancelled = true
    }
  }, [page, numPages, scale, docType])

  // Desplazamiento automático para centrar la coincidencia activa en el visor
  useEffect(() => {
    if (!searchOpen || searchMatches.length === 0) return
    const activeEl = document.getElementById("pdf-active-search-match")
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
    }
  }, [page, currentMatchIdx, searchOpen, searchMatches.length])

  // GESTO: Zoom con pellizco (Pinch-to-zoom) fluido a 60fps y Wheel con Ctrl en Desktop
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    let startDist = 0
    let startScale = scale
    let isPinching = false
    let pinchOriginX = 0
    let pinchOriginY = 0

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        startDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        startScale = scale
        pinchOriginX = (t1.clientX + t2.clientX) / 2
        pinchOriginY = (t1.clientY + t2.clientY) / 2
        if (canvasWrapperRef.current) {
          canvasWrapperRef.current.style.transition = "none"
        }
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (isPinching && e.touches.length === 2) {
        e.preventDefault() // Evitar zoom del navegador en toda la página
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        if (startDist > 0) {
          const factor = currentDist / startDist
          if (canvasWrapperRef.current) {
            canvasWrapperRef.current.style.transform = `scale(${factor})`
            canvasWrapperRef.current.style.transformOrigin = `${pinchOriginX}px ${pinchOriginY}px`
          }
        }
      }
    }

    const onTouchEnd = () => {
      if (isPinching) {
        isPinching = false
        if (canvasWrapperRef.current) {
          const transform = canvasWrapperRef.current.style.transform
          const match = transform.match(/scale\(([^)]+)\)/)
          canvasWrapperRef.current.style.transform = "none"
          canvasWrapperRef.current.style.transition = ""
          if (match) {
            const factor = parseFloat(match[1])
            if (!isNaN(factor) && factor !== 1) {
              const targetScale = Math.min(3.5, Math.max(0.6, Number((startScale * factor).toFixed(2))))
              setScale(targetScale)
            }
          }
        }
      }
    }

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.15 : 0.15
        setScale((s) => Math.min(3.5, Math.max(0.6, Number((s + delta).toFixed(2)))))
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    el.addEventListener("touchcancel", onTouchEnd, { passive: true })
    el.addEventListener("wheel", onWheel, { passive: false })

    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
      el.removeEventListener("wheel", onWheel)
    }
  }, [scale])

  // GESTO: Doble toque para ampliar/restablecer
  const handleContentTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      // Doble toque detectado
      setScale((s) => (s > 1.4 ? 1.2 : 2.0))
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  // Atajos de teclado: Flechas, Zoom (+/-) y Ctrl+F
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Si el foco está en un input, no interceptar teclas generales
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          setSearchOpen(false)
          setPageJumpOpen(false)
        }
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault()
        setSearchOpen((prev) => {
          if (!prev) setTimeout(() => searchInputRef.current?.focus(), 80)
          return !prev
        })
        return
      }

      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setPage((p) => Math.max(1, p - 1))
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        setPage((p) => Math.min(numPages, p + 1))
      } else if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(3.5, Number((s + 0.2).toFixed(1))))
      } else if (e.key === "-" || e.key === "_") {
        setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1))))
      } else if (e.key === "Escape") {
        setSearchOpen(false)
        setPageJumpOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [numPages])

  // Lógica de búsqueda en todo el documento
  const executeSearch = useCallback(
    async (queryText: string) => {
      const q = queryText.trim()
      if (!q || q.length < 2) {
        setSearchMatches([])
        setCurrentMatchIdx(0)
        setIsSearching(false)
        setSearchProgress(null)
        return
      }

      // En modo HTML (normas oficiales del DOF), usar la API nativa Window.find
      if (docType === "html") {
        const iframeWindow = iframeRef.current?.contentWindow as ExtendedWindow | null
        if (iframeWindow && typeof iframeWindow.find === "function") {
          const found = iframeWindow.find(q, false, false, true)
          setIsSearching(false)
          if (!found) {
            setSearchMatches([])
          } else {
            setSearchMatches([
              {
                matchIndex: 0,
                pageNumber: 1,
                snippet: `Búsqueda en texto oficial: "${q}"`,
                rects: [],
              },
            ])
            setCurrentMatchIdx(0)
          }
        }
        return
      }

      const pdf = pdfRef.current?.pdf
      if (!pdf) return

      setIsSearching(true)
      searchAbortRef.current = false

      try {
        const result = await searchAllPages(
          pdf,
          q,
          searchCacheRef.current,
          (scanned, total) => setSearchProgress({ scanned, total }),
          () => searchAbortRef.current
        )

        setSearchMatches(result.matches)
        setCurrentMatchIdx(0)
        setIsSearching(false)
        setSearchProgress(null)

        // Saltar de inmediato a la primera coincidencia
        if (result.matches.length > 0) {
          setPage(result.matches[0].pageNumber)
        }
      } catch (err) {
        console.warn("[PdfViewer] Error en búsqueda:", err)
        setIsSearching(false)
      }
    },
    [docType]
  )

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    void executeSearch(searchQuery)
  }

  const handleNextMatch = () => {
    if (docType === "html") {
      const iframeWindow = iframeRef.current?.contentWindow as ExtendedWindow | null
      iframeWindow?.find?.(searchQuery, false, false, true)
      return
    }
    if (searchMatches.length === 0) return
    const nextIdx = (currentMatchIdx + 1) % searchMatches.length
    setCurrentMatchIdx(nextIdx)
    setPage(searchMatches[nextIdx].pageNumber)
  }

  const handlePrevMatch = () => {
    if (docType === "html") {
      const iframeWindow = iframeRef.current?.contentWindow as ExtendedWindow | null
      iframeWindow?.find?.(searchQuery, false, true, true)
      return
    }
    if (searchMatches.length === 0) return
    const prevIdx = (currentMatchIdx - 1 + searchMatches.length) % searchMatches.length
    setCurrentMatchIdx(prevIdx)
    setPage(searchMatches[prevIdx].pageNumber)
  }

  const handleJumpToMatch = (idx: number) => {
    setCurrentMatchIdx(idx)
    setPage(searchMatches[idx].pageNumber)
    setShowSnippets(false)
  }

  const handleCloseSearch = () => {
    searchAbortRef.current = true
    setSearchOpen(false)
    setSearchQuery("")
    setSearchMatches([])
    setShowSnippets(false)
    setIsSearching(false)
  }

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseInt(pageJumpInput, 10)
    if (!isNaN(target) && target >= 1 && target <= numPages) {
      setPage(target)
      setPageJumpOpen(false)
      setPageJumpInput("")
    }
  }

  // Filtrar coincidencias de la página activa para resaltado visual sobre el canvas
  const currentPageMatches = searchMatches.filter((m) => m.pageNumber === page)

  return (
    <div style={containerStyle}>
      {/* Toast de guardado en bóveda */}
      {vaultToast && (
        <div style={vaultToastStyle}>
          <BookmarkCheck size={16} color="#10b981" />
          <span>{vaultToast}</span>
        </div>
      )}

      {/* Sugerencia de gestos táctiles para móvil */}
      {showGestureHint && (
        <div style={gestureHintStyle}>
          <span>💡 Pellizca con 2 dedos para Zoom • Doble toque para ampliar</span>
        </div>
      )}

      {/* BARRA DE HERRAMIENTAS PRINCIPAL (COMPACTA, ESTILO LECTOR COMERCIAL) */}
      <div style={toolbarStyle}>
        {/* Paginación interactiva */}
        {docType === "pdf" && numPages > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", flexShrink: 0 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={toolbarBtn}
              title="Página anterior (←)"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Botón interactivo para saltar de página directamente */}
            <button
              type="button"
              onClick={() => {
                setPageJumpInput(String(page))
                setPageJumpOpen((v) => !v)
              }}
              style={{
                ...toolbarBtn,
                background: "rgba(255, 255, 255, 0.05)",
                borderColor: pageJumpOpen ? "var(--primary)" : "rgba(255, 255, 255, 0.15)",
                padding: "0.25rem 0.45rem",
                fontSize: "0.76rem",
              }}
              title="Clic para ir directamente a un número de página"
            >
              <span style={{ fontWeight: 700, color: "#f8fafc" }}>{page}</span>
              <span style={{ color: "#94a3b8", margin: "0 0.15rem" }}>/</span>
              <span style={{ color: "#cbd5e1" }}>{numPages}</span>
            </button>

            <button
              type="button"
              disabled={page >= numPages}
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              style={toolbarBtn}
              title="Página siguiente (→)"
              aria-label="Página siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
            {loading ? "Cargando..." : docType === "html" ? "Documento Oficial DOF" : "Visor Oficial"}
          </span>
        )}

        {/* ACCIONES CENTRALES: BÚSQUEDA Y CONTROLES DE ZOOM */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
          {/* Botón de Buscador de Palabras */}
          <button
            type="button"
            onClick={() => {
              setSearchOpen((prev) => {
                const next = !prev
                if (next) setTimeout(() => searchInputRef.current?.focus(), 80)
                return next
              })
            }}
            style={{
              ...toolbarBtn,
              background: searchOpen ? "rgba(37, 99, 235, 0.3)" : "rgba(255, 255, 255, 0.08)",
              borderColor: searchOpen ? "var(--primary)" : "rgba(255, 255, 255, 0.15)",
              color: searchOpen ? "#93c5fd" : "#f8fafc",
            }}
            title="Buscar palabras o cláusulas en el documento (Ctrl+F)"
          >
            <Search size={14} />
            <span style={{ display: "inline" }}>Buscar</span>
            {searchMatches.length > 0 && (
              <span
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  fontSize: "0.65rem",
                  borderRadius: 999,
                  padding: "0.05rem 0.35rem",
                  fontWeight: 700,
                  marginLeft: "0.15rem",
                }}
              >
                {searchMatches.length}
              </span>
            )}
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1))))}
            style={toolbarBtn}
            title="Alejar (Zoom -)"
            aria-label="Alejar"
          >
            <ZoomOut size={14} />
          </button>

          {/* Reset Zoom a 130% */}
          <button
            type="button"
            onClick={() => setScale(1.3)}
            style={{ ...toolbarBtn, minWidth: 42, fontSize: "0.72rem", padding: "0.25rem 0.35rem" }}
            title="Restablecer zoom al 130%"
          >
            {Math.round(scale * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3.5, Number((s + 0.2).toFixed(1))))}
            style={toolbarBtn}
            title="Acercar (Zoom +)"
            aria-label="Acercar"
          >
            <ZoomIn size={14} />
          </button>
        </div>

        {/* ACCIONES LATERALES: GUARDAR EN BÓVEDA Y DESCARGAR */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleSaveToVault}
            style={{
              ...toolbarBtn,
              background: inVault ? "rgba(16, 185, 129, 0.2)" : "rgba(37, 99, 235, 0.25)",
              color: inVault ? "#34d399" : "#93c5fd",
              borderColor: inVault ? "rgba(16, 185, 129, 0.4)" : "rgba(37, 99, 235, 0.4)",
            }}
            title={inVault ? "Documento guardado en tu Bóveda" : "Guardar en tu Bóveda de Documentos"}
          >
            <BookmarkCheck size={14} />
            <span>{inVault ? "En Bóveda" : "Bóveda"}</span>
          </button>

          <a
            href={url}
            target="_blank"
            download
            onClick={handleDownloadAndSave}
            style={{ ...toolbarBtn, textDecoration: "none", color: "#f8fafc" }}
            title="Descargar copia oficial a tu dispositivo y registrar en tu Bóveda"
          >
            <Download size={14} />
          </a>

          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...toolbarBtn, textDecoration: "none", color: "#94a3b8" }}
              title="Abrir en portal gubernamental oficial"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {/* POPOVER PARA SALTO DIRECTO DE PÁGINA */}
      {pageJumpOpen && (
        <form onSubmit={handlePageJumpSubmit} style={pageJumpBarStyle}>
          <span style={{ fontSize: "0.78rem", color: "#cbd5e1" }}>Ir a la página:</span>
          <input
            type="number"
            min={1}
            max={numPages}
            autoFocus
            value={pageJumpInput}
            onChange={(e) => setPageJumpInput(e.target.value)}
            style={pageJumpInputStyle}
            placeholder={`1 - ${numPages}`}
          />
          <button type="submit" style={{ ...toolbarBtn, background: "var(--primary)", borderColor: "transparent" }}>
            Ir
          </button>
          <button
            type="button"
            onClick={() => setPageJumpOpen(false)}
            style={{ ...toolbarBtn, padding: "0.3rem" }}
            title="Cancelar"
          >
            <X size={14} />
          </button>
        </form>
      )}

      {/* BARRA DESPLEGABLE DEL BUSCADOR DE PALABRAS COMERCIAL */}
      {searchOpen && (
        <div style={searchBarStyle}>
          <form
            onSubmit={handleSearchSubmit}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", flex: 1, minWidth: 0 }}
          >
            <div style={searchInputWrapper}>
              <Search size={14} color="#94a3b8" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value
                  setSearchQuery(val)
                  if (!val.trim()) {
                    setSearchMatches([])
                    setCurrentMatchIdx(0)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (e.shiftKey) {
                      e.preventDefault()
                      handlePrevMatch()
                    } else if (searchMatches.length > 0) {
                      e.preventDefault()
                      handleNextMatch()
                    }
                  }
                }}
                placeholder="Buscar palabra o frase (ej. vacaciones, cláusula 89)..."
                style={searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("")
                    setSearchMatches([])
                    searchInputRef.current?.focus()
                  }}
                  style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 2 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              style={{
                ...toolbarBtn,
                background: "var(--primary)",
                borderColor: "transparent",
                opacity: isSearching || !searchQuery.trim() ? 0.6 : 1,
              }}
            >
              {isSearching ? "Buscando..." : "Buscar"}
            </button>
          </form>

          {/* Contador y navegación de coincidencias */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
            {isSearching ? (
              <span style={searchCountBadge}>
                {searchProgress ? `Escaneando ${searchProgress.scanned}/${searchProgress.total}...` : "Buscando..."}
              </span>
            ) : searchMatches.length > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={searchCountBadge}>
                  {currentMatchIdx + 1} de {searchMatches.length}
                </span>

                <button
                  type="button"
                  onClick={handlePrevMatch}
                  style={toolbarBtn}
                  title="Coincidencia anterior (Shift+Enter)"
                  aria-label="Coincidencia anterior"
                >
                  <ChevronUp size={14} />
                </button>

                <button
                  type="button"
                  onClick={handleNextMatch}
                  style={toolbarBtn}
                  title="Coincidencia siguiente (Enter)"
                  aria-label="Coincidencia siguiente"
                >
                  <ChevronDown size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowSnippets((v) => !v)}
                  style={{
                    ...toolbarBtn,
                    background: showSnippets ? "rgba(37, 99, 235, 0.3)" : "rgba(255, 255, 255, 0.08)",
                  }}
                  title="Ver lista de extractos encontrados"
                >
                  <FileText size={14} />
                </button>
              </div>
            ) : searchQuery.length >= 2 && !isSearching ? (
              <span style={{ ...searchCountBadge, color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)" }}>
                Sin resultados
              </span>
            ) : null}

            <button
              type="button"
              onClick={handleCloseSearch}
              style={{ ...toolbarBtn, padding: "0.3rem" }}
              title="Cerrar búsqueda (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* PANEL DE EXTRACTOS CONTEXTUALES DE BÚSQUEDA */}
      {searchOpen && showSnippets && searchMatches.length > 0 && (
        <div style={snippetsPanelStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#93c5fd" }}>
              {searchMatches.length} coincidencias encontradas:
            </span>
            <button
              type="button"
              onClick={() => setShowSnippets(false)}
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.75rem" }}
            >
              Cerrar lista
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 160, overflowY: "auto" }}>
            {searchMatches.map((match, i) => (
              <button
                key={match.matchIndex}
                type="button"
                onClick={() => handleJumpToMatch(i)}
                style={{
                  ...snippetItemStyle,
                  background: i === currentMatchIdx ? "rgba(37, 99, 235, 0.25)" : "rgba(255, 255, 255, 0.04)",
                  borderColor: i === currentMatchIdx ? "var(--primary)" : "rgba(255, 255, 255, 0.08)",
                }}
              >
                <span style={{ fontWeight: 700, color: i === currentMatchIdx ? "#93c5fd" : "#cbd5e1" }}>
                  Pág. {match.pageNumber}:
                </span>{" "}
                <span style={{ color: "#e2e8f0" }}>{match.snippet}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ÁREA DE VISUALIZACIÓN DEL DOCUMENTO (PANTALLA AMPLIA + CANVAS + HIGHLIGHTS) */}
      <div ref={viewportRef} style={viewportStyle}>
        {loading ? (
          <div style={{ padding: "4rem 1rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <LoadingSpinner text="Abriendo documento oficial completo..." />
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "3rem 1.5rem", color: "#f8fafc", maxWidth: 480, margin: "auto" }}>
            <p style={{ fontWeight: 700, fontSize: "1.05rem", margin: "0 0 0.5rem", color: "#f8fafc" }}>
              Visualización directa del documento oficial
            </p>
            <p style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 1.5rem" }}>
              No se pudo renderizar la vista previa en el navegador, pero el archivo oficial está completamente disponible para consulta.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "center", width: "100%" }}>
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.45rem",
                  padding: "0.6rem 1.25rem",
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#f8fafc",
                  borderRadius: "var(--radius)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  width: "100%",
                  maxWidth: 320,
                }}
              >
                <RotateCw size={15} />
                Reintentar carga del visor
              </button>

              {officialUrl && (
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    padding: "0.65rem 1.25rem",
                    background: "var(--primary)",
                    color: "#fff",
                    borderRadius: "var(--radius)",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    width: "100%",
                    maxWidth: 320,
                  }}
                >
                  <ExternalLink size={16} />
                  Abrir en portal oficial (IMSS / DOF)
                </a>
              )}

              <a
                href={url}
                target="_blank"
                download
                onClick={handleDownloadAndSave}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.45rem",
                  padding: "0.6rem 1.25rem",
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#f8fafc",
                  borderRadius: "var(--radius)",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  width: "100%",
                  maxWidth: 320,
                }}
              >
                <Download size={15} />
                Descargar copia oficial a mi Bóveda
              </a>
            </div>
          </div>
        ) : docType === "html" ? (
          <div style={{ width: "100%", height: "100%", background: "#fff", flex: 1, display: "flex", flexDirection: "column" }}>
            <iframe
              ref={iframeRef}
              srcDoc={htmlContent}
              sandbox="allow-same-origin"
              title="Documento Oficial DOF"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
                flex: 1,
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              padding: "0.5rem 0",
              minHeight: "100%",
            }}
            onClick={handleContentTap}
          >
            {/* Contenedor relativo para el Canvas y la capa de resaltado de búsqueda */}
            <div
              ref={canvasWrapperRef}
              style={{
                position: "relative",
                display: "inline-block",
                margin: "auto",
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: scale <= 1.3 ? "100%" : "none",
                  height: "auto",
                  background: "#fff",
                  borderRadius: 2,
                  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6)",
                  display: "block",
                }}
              />

              {/* CAPA DE RESALTADO DE COINCIDENCIAS DE BÚSQUEDA */}
              {currentPageMatches.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    overflow: "hidden",
                  }}
                >
                  {currentPageMatches.map((match) => {
                    const isActive = match.matchIndex === currentMatchIdx
                    return match.rects.map((rect, rIdx) => (
                      <div
                        key={`${match.matchIndex}-${rIdx}`}
                        id={isActive && rIdx === 0 ? "pdf-active-search-match" : undefined}
                        style={{
                          position: "absolute",
                          left: `${rect.xPercent}%`,
                          top: `${rect.yPercent}%`,
                          width: `${rect.widthPercent}%`,
                          height: `${rect.heightPercent}%`,
                          background: isActive ? "rgba(245, 158, 11, 0.65)" : "rgba(254, 240, 138, 0.45)",
                          border: isActive ? "2px solid #d97706" : "1px solid rgba(234, 179, 8, 0.4)",
                          boxShadow: isActive ? "0 0 10px rgba(245, 158, 11, 0.9)" : "none",
                          borderRadius: 2,
                          transition: "all 0.15s ease",
                        }}
                      />
                    ))
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const containerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  background: "#0f172a",
  overflow: "hidden",
  position: "relative",
}

const toolbarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.35rem",
  padding: "0.45rem 0.65rem",
  background: "#0f172a",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#f8fafc",
  flexWrap: "nowrap",
  overflowX: "auto",
  scrollbarWidth: "none",
  flexShrink: 0,
  zIndex: 10,
}

const searchBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.45rem",
  padding: "0.4rem 0.65rem",
  background: "#1e293b",
  borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
  flexShrink: 0,
  zIndex: 10,
}

const searchInputWrapper: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.35rem",
  background: "rgba(15, 23, 42, 0.7)",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 6,
  padding: "0.25rem 0.5rem",
  flex: 1,
  minWidth: 140,
}

const searchInput: CSSProperties = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#f8fafc",
  fontSize: "0.8rem",
  width: "100%",
}

const searchCountBadge: CSSProperties = {
  fontSize: "0.72rem",
  color: "#94a3b8",
  fontWeight: 600,
  padding: "0.2rem 0.45rem",
  background: "rgba(15, 23, 42, 0.6)",
  borderRadius: 4,
  border: "1px solid rgba(255, 255, 255, 0.08)",
  whiteSpace: "nowrap",
}

const snippetsPanelStyle: CSSProperties = {
  background: "#0f172a",
  borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
  padding: "0.5rem 0.75rem",
  flexShrink: 0,
  zIndex: 9,
}

const snippetItemStyle: CSSProperties = {
  textAlign: "left",
  fontSize: "0.75rem",
  padding: "0.35rem 0.5rem",
  borderRadius: 4,
  border: "1px solid",
  cursor: "pointer",
  lineHeight: 1.4,
  display: "block",
  width: "100%",
}

const pageJumpBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.4rem",
  padding: "0.35rem 0.65rem",
  background: "#1e293b",
  borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
  flexShrink: 0,
  zIndex: 10,
}

const pageJumpInputStyle: CSSProperties = {
  width: 75,
  background: "rgba(15, 23, 42, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 4,
  color: "#f8fafc",
  fontSize: "0.8rem",
  padding: "0.25rem 0.4rem",
  outline: "none",
}

const viewportStyle: CSSProperties = {
  flex: 1,
  width: "100%",
  height: "100%",
  overflow: "auto",
  background: "#1e293b",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  WebkitOverflowScrolling: "touch",
}

const toolbarBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.25rem",
  padding: "0.3rem 0.5rem",
  borderRadius: 6,
  border: "1px solid rgba(255, 255, 255, 0.15)",
  background: "rgba(255, 255, 255, 0.08)",
  color: "#f8fafc",
  cursor: "pointer",
  fontSize: "0.78rem",
  fontWeight: 600,
  flexShrink: 0,
}

const vaultToastStyle: CSSProperties = {
  position: "absolute",
  top: "3rem",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 50,
  background: "#0f172a",
  border: "1px solid rgba(16, 185, 129, 0.4)",
  color: "#f8fafc",
  padding: "0.45rem 0.9rem",
  borderRadius: 999,
  fontSize: "0.8rem",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: "0.45rem",
  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.5)",
}

const gestureHintStyle: CSSProperties = {
  position: "absolute",
  bottom: "1.2rem",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 40,
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  color: "#e2e8f0",
  padding: "0.4rem 0.85rem",
  borderRadius: 999,
  fontSize: "0.74rem",
  fontWeight: 500,
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
  pointerEvents: "none",
  whiteSpace: "nowrap",
}
