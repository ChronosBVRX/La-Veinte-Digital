"use client"

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type CSSProperties,
  type TouchEvent,
} from "react"
import Link from "next/link"
import {
  TrendUp,
  CalendarCheck,
  CopySimple,
  ArrowsLeftRight,
  Calculator,
  BookOpen,
  ArrowRight,
  CaretLeft,
  CaretRight,
  FileText,
  IdentificationCard,
  Sparkle,
} from "@phosphor-icons/react"
import { useWorkerContextSync } from "@/shared/hooks/useLiveWorkerContext"
import { selectSalaryEstimateInputs } from "@/features/salary-estimate/services/salary-estimate-selector"
import { calculateSalaryIncrease } from "@/features/salary-estimate/lib/calculate-salary-increase"
import { formatCurrency } from "@/features/calculators/lib/money"
import { TransferDocumentsModal } from "@/features/transferir/components/TransferDocumentsModal"
import { SalaryIncreaseDetailModal } from "./SalaryIncreaseDetailModal"
import { isExcludedByQuickActions } from "../lib/highlight-exclusion-policy"
import {
  HIGHLIGHT_PRIORITIES,
  type HomeHighlight,
  type AnnouncementHighlight,
} from "../types/home-highlights"
import type { Announcement } from "@/shared/contracts/announcements"

interface HomeHighlightsCarouselProps {
  initialAnnouncements?: Announcement[]
}

const AUTOPLAY_INTERVAL_MS = 11000
const SWIPE_THRESHOLD_PX = 40

export function HomeHighlightsCarousel({ initialAnnouncements = [] }: HomeHighlightsCarouselProps) {
  // ── 1. Datos y estado de Aumento Salarial ─────────────────────────────────
  const { context, status: workerStatus, retry: retryWorker } = useWorkerContextSync(null)

  const salarySelection = useMemo(() => {
    return selectSalaryEstimateInputs(context)
  }, [context])

  const salaryResult = useMemo(() => {
    return calculateSalaryIncrease(salarySelection)
  }, [salarySelection])

  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [transferModalOpen, setTransferModalOpen] = useState(false)

  // ── 2. Avisos remotos (Supabase announcements con show_in_home_hero) ────────
  const [remoteAnnouncements, setRemoteAnnouncements] = useState<Announcement[]>(initialAnnouncements)

  useEffect(() => {
    let cancelled = false
    async function loadRemoteHighlights() {
      try {
        const res = await fetch("/api/announcements/hero")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.items)) {
          setRemoteAnnouncements(data.items)
        }
      } catch {
        // Fallback silencioso: se conservan los destacados internos
      }
    }
    loadRemoteHighlights()
    return () => {
      cancelled = true
    }
  }, [])

  // ── 3. Construcción del conjunto de slides ────────────────────────────────
  const slides = useMemo<HomeHighlight[]>(() => {
    const list: HomeHighlight[] = []

    // A. Aumento Salarial (System Highlight)
    let salaryTitle = "Tu aumento estimado"
    let salaryDescription = "Basado en tu tarjetón activo."
    let salaryCtaText = "Ver detalle"
    let salaryCtaHref: string | undefined = undefined
    let salaryCtaAction: (() => void) | undefined = () => setDetailModalOpen(true)
    const salaryBadge = "ACTUALIZACIÓN SALARIAL"

    if (workerStatus === "loading") {
      salaryDescription = "Estamos revisando tu tarjetón más reciente."
      salaryCtaText = "Consultando..."
      salaryCtaAction = undefined
    } else if (workerStatus === "error") {
      salaryDescription = "No pudimos consultar tu información laboral en este momento."
      salaryCtaText = "Reintentar"
      salaryCtaAction = retryWorker
    } else if (!salarySelection.hasPayslip || salaryResult.calculationStatus === "missing-payslip") {
      salaryTitle = "Descubre tu aumento"
      salaryDescription = "Importa tu tarjetón más reciente para calcularlo."
      salaryCtaText = "Importar tarjetón"
      salaryCtaHref = "/profile/mi-informacion-laboral"
      salaryCtaAction = undefined
    } else if (
      salaryResult.calculationStatus === "missing-concept11" ||
      salaryResult.calculationStatus === "missing-tabular" ||
      salaryResult.calculationStatus === "insufficient-data"
    ) {
      salaryDescription = "Tu tarjetón guardado requiere revisión de conceptos para estimar el aumento."
      salaryCtaText = "Revisar mi información"
      salaryCtaHref = "/profile/mi-informacion-laboral"
      salaryCtaAction = undefined
    } else if (
      salaryResult.calculationStatus === "new-schedule-unverified" ||
      salaryResult.calculationStatus === "unverified-comparable-base"
    ) {
      salaryTitle = "Estimación pendiente de comprobar"
      salaryDescription = "Tu tarjetón registra vigencia o importes que requieren comprobación antes de estimar."
      salaryCtaText = "Revisar mi información"
      salaryCtaHref = "/profile/mi-informacion-laboral"
      salaryCtaAction = undefined
    } else if (salaryResult.calculationStatus === "ok") {
      const formatted = formatCurrency(salaryResult.estimatedFortnightlyIncrease)
      salaryTitle = salaryResult.salaryType === "substitute"
        ? `+${formatted} por quincena (Sustitución)`
        : `+${formatted} por quincena`
      salaryDescription = salaryResult.salaryType === "substitute"
        ? "Estimación sobre sueldo sustituto (008) y ayuda de renta (011)."
        : "Tu aumento estimado con base en tu tarjetón activo."
    }

    list.push({
      id: "salary-increase-highlight",
      type: "system",
      priority: HIGHLIGHT_PRIORITIES.SALARY_INCREASE,
      eyebrow: salaryBadge,
      title: salaryTitle,
      description: salaryDescription,
      ctaText: salaryCtaText,
      ctaHref: salaryCtaHref,
      ctaAction: salaryCtaAction,
      icon: TrendUp,
      gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
      enabled: true,
      testId: "highlight-salary-increase",
    })

    // B. Roles Vacacionales 2027 (System Highlight)
    list.push({
      id: "vacation-2027-highlight",
      type: "system",
      priority: HIGHLIGHT_PRIORITIES.VACATION_ROLES_2027,
      eyebrow: "NUEVO · 2027",
      title: "Ya están disponibles los roles vacacionales 2027",
      description: "Consulta las fechas oficiales y organiza con tiempo tus vacaciones.",
      ctaText: "Ver roles 2027",
      ctaHref: "/vacaciones",
      icon: CalendarCheck,
      gradient: "linear-gradient(135deg, #064e3b 0%, #047857 55%, #0d9488 100%)",
      enabled: true,
      testId: "highlight-vacation-roles",
    })

    // C. Sacar Copias (System Highlight)
    list.push({
      id: "copy-service-highlight",
      type: "system",
      priority: HIGHLIGHT_PRIORITIES.COPY_SERVICE,
      eyebrow: "SERVICIO SINDICAL",
      title: "¿Necesitas sacar una copia?",
      description: "Toma una foto o carga tu documento y envíalo a imprimir en la oficina sindical.",
      ctaText: "Sacar una copia",
      ctaHref: "/copias",
      icon: CopySimple,
      pills: [
        { label: "Documento", icon: FileText, color: "var(--primary, #2563eb)" },
        { label: "INE (ambas caras)", icon: IdentificationCard, color: "#b45309" },
      ],
      gradient: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
      enabled: true,
      testId: "highlight-copy-service",
    })

    // D. Transferir Documentos (System Highlight)
    list.push({
      id: "transfer-docs-highlight",
      type: "system",
      priority: HIGHLIGHT_PRIORITIES.TRANSFER_DOCUMENTS,
      eyebrow: "HERRAMIENTA",
      title: "Pasa documentos entre dispositivos",
      description: "Transfiere archivos desde tu teléfono o computadora utilizando el flujo QR ya existente.",
      ctaText: "Transferir documentos",
      ctaAction: () => setTransferModalOpen(true),
      icon: ArrowsLeftRight,
      gradient: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)",
      enabled: true,
      testId: "highlight-transfer-docs",
    })

    // E. Calculadoras Concretas (System Highlight)
    list.push({
      id: "calculator-aguinaldo-highlight",
      type: "system",
      priority: HIGHLIGHT_PRIORITIES.CALCULATOR,
      eyebrow: "CALCULADORA",
      title: "Calcula tu aguinaldo",
      description: "Estima el importe de tu aguinaldo según tu antigüedad y conceptos vigentes.",
      ctaText: "Calcular aguinaldo",
      ctaHref: "/calculadoras/aguinaldo",
      icon: Calculator,
      gradient: "linear-gradient(135deg, #78350f 0%, #b45309 100%)",
      enabled: true,
      testId: "highlight-calculator-aguinaldo",
    })

    // F. Guía de mi Tarjetón (System Highlight)
    list.push({
      id: "guia-tarjeton-highlight",
      type: "system",
      priority: HIGHLIGHT_PRIORITIES.GUIA_TARJETON,
      eyebrow: "HERRAMIENTA",
      title: "¿No sabes qué significa un concepto de tu tarjetón?",
      description: "Explora conceptos, deducciones y explicaciones detalladas de tu recibo IMSS.",
      ctaText: "Entender mi tarjetón",
      ctaHref: "/guia",
      icon: BookOpen,
      gradient: "linear-gradient(135deg, #0e7490 0%, #0369a1 100%)",
      enabled: true,
      testId: "highlight-guia-tarjeton",
    })

    // G. Avisos remotos dinámicos de Administración
    if (Array.isArray(remoteAnnouncements)) {
      for (const ann of remoteAnnouncements) {
        const eyebrow = ann.kind === "tool" ? "NUEVA HERRAMIENTA" : ann.kind === "tip" ? "CONSEJO" : "COMUNICADO"
        const ctaHref = ann.destination_path || `/avisos/${ann.id}`
        const ctaText = ann.destination_path && ann.destination_path !== "/avisos" ? "Conócela" : "Leer comunicado"

        list.push({
          id: `announcement-${ann.id}`,
          type: "announcement",
          kind: ann.kind,
          priority: HIGHLIGHT_PRIORITIES.DEFAULT_ANNOUNCEMENT,
          eyebrow,
          title: ann.title,
          description: ann.bar_text || ann.push_summary || ann.body.slice(0, 140),
          ctaText,
          ctaHref,
          icon: Sparkle,
          gradient: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
          enabled: true,
          startsAt: ann.publish_at ?? undefined,
          endsAt: ann.expires_at ?? undefined,
          testId: `highlight-announcement-${ann.id}`,
        } as AnnouncementHighlight)
      }
    }

    // Regla de Exclusión: descartar cualquier slide que duplique HomeQuickActions
    const filtered = list.filter((slide) => !isExcludedByQuickActions({ id: slide.id, title: slide.title, href: slide.ctaHref }))

    // Ordenar de mayor a menor prioridad
    filtered.sort((a, b) => b.priority - a.priority)

    return filtered
  }, [
    workerStatus,
    retryWorker,
    salarySelection,
    salaryResult,
    remoteAnnouncements,
  ])

  // ── 4. Navegación, swipe y autoplay ───────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    }
    return false
  })

  // Detectar cambios en prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener?.("change", listener)
    return () => mediaQuery.removeEventListener?.("change", listener)
  }, [])

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % (slides.length || 1))
  }, [slides.length])

  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % (slides.length || 1))
  }, [slides.length])

  // Autoplay temporizado
  useEffect(() => {
    if (slides.length <= 1 || isPaused || prefersReducedMotion) return
    const timer = setInterval(() => {
      goToNext()
    }, AUTOPLAY_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [slides.length, isPaused, prefersReducedMotion, goToNext, activeIndex])

  // Gestos táctiles de swipe para móvil
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsPaused(true)
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) {
      setIsPaused(false)
      return
    }
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current

    // Evitar swipe accidental si el movimiento fue principalmente vertical (scroll de página)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
      if (deltaX < 0) {
        goToNext()
      } else {
        goToPrev()
      }
    }
    touchStartX.current = null
    touchStartY.current = null
    setIsPaused(false)
  }

  if (slides.length === 0) {
    return null
  }

  const safeActiveIndex = activeIndex < slides.length ? activeIndex : 0
  const currentSlide = slides[safeActiveIndex] || slides[0]
  const Icon = currentSlide.icon

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Destacados del Inicio"
      data-testid="home-highlights-carousel"
      className="home-highlights-root"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "relative",
        marginBottom: "var(--space-4, 1rem)",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        borderRadius: "var(--radius-lg, 1rem)",
        overflow: "hidden",
      }}
    >
      {/* Contenedor del Slide actual */}
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={`${safeActiveIndex + 1} de ${slides.length}: ${currentSlide.title}`}
        data-testid={currentSlide.testId}
        style={{
          background: currentSlide.gradient || "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          color: "#ffffff",
          padding: "clamp(1rem, 2.5vw, 1.35rem) clamp(1rem, 3vw, 1.5rem)",
          minHeight: "clamp(170px, 22vw, 205px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "0.75rem",
          boxSizing: "border-box",
          boxShadow: "0 6px 20px rgba(0, 0, 0, 0.16)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          transition: prefersReducedMotion ? "none" : "background 0.3s ease",
        }}
      >
        {/* Cabecera del slide: Icono + Eyebrow */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
            {Icon && (
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.18)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={16} weight="bold" />
              </span>
            )}
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "rgba(255, 255, 255, 0.85)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {currentSlide.eyebrow}
            </span>
          </div>

          {/* Flechas de escritorio integradas en cabecera */}
          <div className="carousel-desktop-controls desktop-only" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <button
              type="button"
              onClick={goToPrev}
              aria-label="Destacado anterior"
              className="carousel-nav-btn pressable"
              style={navButtonStyle}
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              aria-label="Destacado siguiente"
              className="carousel-nav-btn pressable"
              style={navButtonStyle}
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        </div>

        {/* Cuerpo del slide: Título + Descripción + CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            minWidth: 0,
            width: "100%",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 260px" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(1.05rem, 2vw, 1.25rem)",
                fontWeight: 800,
                lineHeight: 1.25,
                color: "#ffffff",
                overflowWrap: "break-word",
              }}
            >
              {currentSlide.title}
            </h2>
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "clamp(0.78125rem, 1.5vw, 0.875rem)",
                lineHeight: 1.45,
                color: "rgba(255, 255, 255, 0.9)",
                overflowWrap: "break-word",
              }}
            >
              {currentSlide.description}
            </p>

            {/* Pills opcionales (ej. Copias: Documento, INE) */}
            {currentSlide.pills && currentSlide.pills.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                {currentSlide.pills.map((pill, idx) => {
                  const PillIcon = pill.icon
                  return (
                    <span
                      key={idx}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.2rem 0.55rem",
                        borderRadius: "9999px",
                        background: "rgba(255, 255, 255, 0.16)",
                        border: "1px solid rgba(255, 255, 255, 0.28)",
                        fontSize: "0.6875rem",
                        fontWeight: 700,
                        color: "#ffffff",
                      }}
                    >
                      {PillIcon && <PillIcon size={12} weight="bold" />}
                      {pill.label}
                    </span>
                  )
                })}
              </div>
            )}
          </div>

          {/* Botón CTA grande y táctilmente cómodo */}
          <div style={{ flexShrink: 0 }}>
            {currentSlide.ctaHref ? (
              <Link
                href={currentSlide.ctaHref}
                className="carousel-cta-btn pressable"
                style={ctaButtonStyle}
              >
                <span>{currentSlide.ctaText}</span>
                <ArrowRight size={15} weight="bold" />
              </Link>
            ) : currentSlide.ctaAction ? (
              <button
                type="button"
                onClick={currentSlide.ctaAction}
                className="carousel-cta-btn pressable"
                style={ctaButtonStyle}
              >
                <span>{currentSlide.ctaText}</span>
                <ArrowRight size={15} weight="bold" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Indicadores de puntos (Dots) */}
        <div
          role="tablist"
          aria-label="Páginas del carrusel"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            marginTop: "0.25rem",
          }}
        >
          {slides.map((slide, idx) => {
            const isActive = idx === safeActiveIndex
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Ir al destacado ${idx + 1} de ${slides.length}: ${slide.title}`}
                onClick={() => setActiveIndex(idx)}
                style={{
                  width: isActive ? 22 : 8,
                  height: 8,
                  borderRadius: "9999px",
                  background: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.38)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: prefersReducedMotion ? "none" : "all 0.25s ease",
                  outlineOffset: "2px",
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Modales correspondientes */}
      <SalaryIncreaseDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        result={salaryResult}
        activePeriod={salarySelection.activePeriod}
      />

      <TransferDocumentsModal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
      />

      {/* Estilos CSS scoped inline para hover, focus y responsive */}
      <style>{`
        .carousel-cta-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.55rem 1.15rem;
          min-height: 44px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.45);
          color: #ffffff;
          font-size: 0.875rem;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          transition: background var(--transition, 0.15s ease), transform var(--transition, 0.15s ease);
        }
        .carousel-cta-btn:hover {
          background: rgba(255, 255, 255, 0.32);
          transform: translateY(-1px);
        }
        .carousel-cta-btn:focus-visible {
          outline: 2px solid #ffffff;
          outline-offset: 3px;
        }
        .carousel-nav-btn {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.28);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          transition: background 0.15s ease;
        }
        .carousel-nav-btn:hover {
          background: rgba(255, 255, 255, 0.28);
        }
        .carousel-nav-btn:focus-visible {
          outline: 2px solid #ffffff;
          outline-offset: 2px;
        }
        @media (max-width: 768px) {
          .carousel-desktop-controls {
            display: none !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .carousel-cta-btn, .carousel-nav-btn {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </section>
  )
}

const ctaButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.4rem",
  padding: "0.55rem 1.15rem",
  minHeight: "44px",
  borderRadius: "9999px",
  background: "rgba(255, 255, 255, 0.22)",
  border: "1px solid rgba(255, 255, 255, 0.45)",
  color: "#ffffff",
  fontSize: "0.875rem",
  fontWeight: 700,
  textDecoration: "none",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "inherit",
}

const navButtonStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.16)",
  border: "1px solid rgba(255, 255, 255, 0.28)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
}
