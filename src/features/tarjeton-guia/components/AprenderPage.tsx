"use client"

import Link from "next/link"
import { CaretRight, GraduationCap, ArrowRight } from "@phosphor-icons/react"
import { PageHeader } from "@/shared/components/app/PageHeader"
import { Card } from "@/shared/components/ui/Card"
import { Badge } from "@/shared/components/ui/Badge"
import { useGuideProgress } from "@/features/tarjeton-guia/hooks/useGuideProgress"
import { guideLessonPaths, guideQuickLessons } from "@/features/tarjeton-guia/data/lessons"
import { completionForPath, percentForPath } from "@/features/tarjeton-guia/lib/progress"
import { resolveRefHref } from "@/features/tarjeton-guia/lib/catalog"

export function AprenderPage() {
  const { progress, hydrated } = useGuideProgress()

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Guía de mi Tarjetón"
        title="Aprende desde cero"
        description="Rutas cortas, con micro-lecciones de 30 a 90 segundos, para entender tu tarjetón sin marearte con tecnicismos."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {guideLessonPaths.map((path) => {
          const total = path.lessons.length
          const done = hydrated ? completionForPath(progress, path.id) : { completed: 0, total, done: false }
          const percent = hydrated ? percentForPath(progress, path.id, total) : 0
          const next = hydrated
            ? path.lessons.find((l) => !progress.completed.includes(l.id)) ?? path.lessons[0]
            : path.lessons[0]
          return (
            <Card key={path.id} padding="1.25rem 1.5rem">
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem", lineHeight: 1 }}>{path.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{path.title}</h2>
                    <Badge variant="info">{total} lecciones</Badge>
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.5, margin: "0.25rem 0 0.75rem" }}>
                    {path.description}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 9999, background: "var(--border)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${percent}%`,
                          background: done.done ? "var(--success)" : "var(--primary)",
                          borderRadius: 9999,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>
                      {hydrated ? `${done.completed}/${done.total}` : "…"}
                      {done.done && hydrated ? " ✓" : ""}
                    </span>
                  </div>
                  <Link
                    href={`/guia/aprender/${path.id}?leccion=${next.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--primary)",
                      textDecoration: "none",
                    }}
                  >
                    {done.done && hydrated ? "Repasar ruta" : "Empezar"} <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, margin: "2rem 0 0.75rem" }}>Preguntas cortas</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {guideQuickLessons.map((item) => {
          const href =
            item.ref.startsWith("lesson:")
              ? `/guia/aprender/primeros-pasos?leccion=${item.ref.slice(7)}`
              : (resolveRefHref(item.ref) ?? "/guia/tarjeton")
          return (
            <Link
              key={item.id}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                background: "var(--card)",
                border: "1px solid var(--border)",
                textDecoration: "none",
                transition: "border-color var(--transition)",
              }}
            >
              <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>{item.emoji}</span>
              <span style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)" }}>{item.title}</span>
              <CaretRight size={14} color="var(--muted)" />
            </Link>
          )
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
        <Link
          href="/guia"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.875rem",
            color: "var(--muted)",
            textDecoration: "none",
          }}
        >
          <GraduationCap size={18} /> Volver a la guía
        </Link>
      </div>
    </div>
  )
}
