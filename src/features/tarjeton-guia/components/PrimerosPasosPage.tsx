"use client"

import { useEffect, useRef } from "react"
import { Check, CaretRight, CheckCircle, BookOpen, ArrowLeft } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import Link from "next/link"
import { useGuideProgress } from "@/features/tarjeton-guia/hooks/useGuideProgress"
import { guideLessonPaths, type GuideLesson, type GuideLessonBlock } from "@/features/tarjeton-guia/data/lessons"
import { percentForPath } from "@/features/tarjeton-guia/lib/progress"

export function PrimerosPasosPage({ leccion }: { leccion?: string }) {
  const { progress, hydrated, completeLesson } = useGuideProgress()
  const path = guideLessonPaths.find((p) => p.id === "primeros-pasos") ?? guideLessonPaths[0]
  const lessonRefs = useRef<Map<string, HTMLElement | null>>(new Map())

  useEffect(() => {
    if (!leccion) return
    // Espera a que el DOM esté disponible y hace scroll suave a la lección.
    const t = window.setTimeout(() => {
      lessonRefs.current.get(leccion)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
    return () => window.clearTimeout(t)
  }, [leccion, hydrated])

  const percent = hydrated ? percentForPath(progress, "primeros-pasos", path.lessons.length) : 0

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Aprende desde cero"
        title={path.title}
        description={path.description}
        backHref="/guia/aprender"
      />

      <Card padding="1rem 1.25rem" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <BookOpen size={16} color="var(--primary)" />
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--fg)", flex: 1 }}>
            Tu avance en la ruta
          </span>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--primary)" }}>
            {hydrated ? `${percent}%` : "…"}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 9999, background: "var(--border)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${percent}%`,
              background: percent === 100 ? "var(--success)" : "var(--primary)",
              borderRadius: 9999,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {path.lessons.map((lesson, index) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            number={index + 1}
            complete={hydrated ? progress.completed.includes(lesson.id) : false}
            disabled={!hydrated}
            onComplete={() => completeLesson(lesson.id, path.id)}
            register={(el) => {
              lessonRefs.current.set(lesson.id, el)
            }}
            nextId={path.lessons[index + 1]?.id}
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
        <Link
          href="/guia/aprender"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.875rem",
            color: "var(--muted)",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={16} /> Volver a las rutas
        </Link>
      </div>
    </div>
  )
}

function LessonCard({
  lesson,
  number,
  complete,
  disabled,
  onComplete,
  register,
  nextId,
}: {
  lesson: GuideLesson
  number: number
  complete: boolean
  disabled: boolean
  onComplete: () => void
  register: (el: HTMLElement | null) => void
  nextId?: string
}) {
  return (
    <div id={`lesson-${lesson.id}`} ref={register} style={{ scrollMarginTop: "1rem" }}>
      <Card padding="1.25rem 1.5rem" style={{ borderColor: complete ? "var(--success)" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem" }}>
        <span
          style={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2rem",
            height: "2rem",
            borderRadius: "9999px",
            background: complete ? "#f0fdf4" : "var(--accent)",
            color: complete ? "var(--success)" : "var(--primary)",
            fontWeight: 700,
            fontSize: "0.875rem",
          }}
        >
          {complete ? <Check size={16} weight="bold" /> : number}
        </span>
        <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>{lesson.emoji}</span>
        <h2 style={{ flex: 1, fontSize: "1rem", fontWeight: 700, margin: 0 }}>{lesson.title}</h2>
        <Badge variant={complete ? "success" : "neutral"}>{complete ? "Completada" : "Lección"}</Badge>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {lesson.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      {lesson.sourcePages?.length ? (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: "0.75rem 0 0", lineHeight: 1.5 }}>
          Referencia: Manual de orientación al tarjetón (2023) · págs. {lesson.sourcePages.join(", ")}
        </p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem" }}>
        <button
          onClick={onComplete}
          disabled={disabled || complete}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.5rem 0.875rem",
            borderRadius: "var(--radius-sm)",
            border: "none",
            cursor: complete || disabled ? "default" : "pointer",
            background: complete ? "#f0fdf4" : "var(--primary)",
            color: complete ? "var(--success)" : "#fff",
            fontWeight: 600,
            fontSize: "0.8125rem",
            opacity: disabled || complete ? 0.9 : 1,
          }}
        >
          <CheckCircle size={16} weight={complete ? "fill" : "regular"} />
          {complete ? "Completada" : "Marcar como completada"}
        </button>
        {nextId && (
          <Link
            href={`/guia/aprender/primeros-pasos?leccion=${nextId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              marginLeft: "auto",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            Siguiente <CaretRight size={13} />
          </Link>
        )}
      </div>
      </Card>
    </div>
  )
}

function Block({ block }: { block: GuideLessonBlock }) {
  if (block.kind === "highlight") {
    return (
      <div
        style={{
          padding: "0.625rem 0.875rem",
          borderRadius: "var(--radius-sm)",
          background: "color-mix(in srgb, var(--primary) 8%, var(--card))",
          borderLeft: "3px solid var(--primary)",
        }}
      >
        <p style={{ fontSize: "0.8125rem", lineHeight: 1.55, margin: 0, color: "var(--fg)", fontWeight: 600 }}>
          {block.text}
        </p>
      </div>
    )
  }
  if (block.kind === "example") {
    return (
      <div
        style={{
          padding: "0.625rem 0.875rem",
          borderRadius: "var(--radius-sm)",
          background: "var(--accent)",
        }}
      >
        <p style={{ fontSize: "0.78125rem", lineHeight: 1.55, margin: 0, color: "var(--muted)" }}>
          <span style={{ fontWeight: 700, color: "var(--fg)" }}>Ejemplo: </span>
          {block.text}
        </p>
      </div>
    )
  }
  return (
    <p style={{ fontSize: "0.875rem", lineHeight: 1.6, margin: 0, color: "var(--fg)" }}>{block.text}</p>
  )
}
