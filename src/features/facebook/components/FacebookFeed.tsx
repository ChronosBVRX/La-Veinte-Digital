"use client"

import { useEffect, useRef, useState } from "react"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"
import { Button } from "@/shared/components/ui/Button"

const FB_PAGE = "https://www.facebook.com/SNTSSSeccionXXMichoacan"

interface Props {
  compact?: boolean
}

export function FacebookFeed({ compact }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [fbBlocked, setFbBlocked] = useState(false)
  const ref = useRef<HTMLIFrameElement>(null)
  const h = compact ? 400 : 700

  useEffect(() => {
    if (!loaded) {
      const timer = setTimeout(() => {
        if (!loaded) setFbBlocked(true)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [loaded])

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden", position: "relative",
    }}>
      {!loaded && !fbBlocked && (
        <div style={{ padding: "2rem" }}>
          <LoadingSpinner text="Cargando Facebook..." />
        </div>
      )}

      {fbBlocked && (
        <div style={{ padding: "1.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
            No se pudo cargar el feed de Facebook.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(FB_PAGE, "_blank", "noopener,noreferrer")}
          >
            Ver en Facebook ↗
          </Button>
        </div>
      )}

      <iframe
        ref={ref}
        onLoad={() => setLoaded(true)}
        src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(FB_PAGE)}&tabs=timeline&width=500&height=${h}&small_header=${compact ? "true" : "false"}&adapt_container_width=true&hide_cover=${compact ? "true" : "false"}&show_facepile=false`}
        style={{
          border: "none", overflow: "hidden", width: "100%",
          height: h, display: loaded && !fbBlocked ? "block" : "none",
          maxWidth: "100%",
        }}
        scrolling="no"
        frameBorder="0"
        allowFullScreen
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        title="Facebook SNTSS Sección XX Michoacán"
      />
    </div>
  )
}
