"use client"

import { useEffect, useRef, useState } from "react"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

const FB_PAGE = "https://www.facebook.com/SNTSSSeccionXXMichoacan"

interface Props {
  compact?: boolean
}

export function FacebookFeed({ compact }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [useIframe, setUseIframe] = useState(true)
  const ref = useRef<HTMLIFrameElement>(null)
  const h = compact ? 400 : 700

  useEffect(() => {
    if (window.innerWidth < 768) setUseIframe(false)
    const timer = setTimeout(() => {
      if (!loaded) setLoaded(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [loaded])

  if (!useIframe) {
    return (
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", overflow: "hidden", padding: "1.5rem",
        textAlign: "center",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: "#1877F2", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 1rem", fontSize: "1.5rem",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24V15.56H7.078V12.073H10.125V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.234 2.686.234v2.953H15.33c-1.49 0-1.955.925-1.955 1.874v2.25h3.328l-.532 3.488h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
          </svg>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--fg)", margin: "0 0 1rem", fontWeight: 600 }}>
          SNTSS Sección XX Michoacán
        </p>
        <a
          href={FB_PAGE}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            padding: "0.625rem 1.25rem", background: "#1877F2", color: "#fff",
            borderRadius: "var(--radius)", textDecoration: "none",
            fontWeight: 600, fontSize: "0.875rem",
          }}
        >
          Ver en Facebook
          ↗
        </a>
      </div>
    )
  }

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden", position: "relative",
    }}>
      {!loaded && <LoadingSpinner text="Cargando Facebook..." />}
      <iframe
        ref={ref}
        onLoad={() => setLoaded(true)}
        src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(FB_PAGE)}&tabs=timeline&width=500&height=${h}&small_header=${compact ? "true" : "false"}&adapt_container_width=true&hide_cover=${compact ? "true" : "false"}&show_facepile=false`}
        style={{
          border: "none", overflow: "hidden", width: "100%", height: h,
          display: loaded ? "block" : "none", maxWidth: "100%",
        }}
        scrolling="no"
        frameBorder="0"
        title="Facebook SNTSS Sección XX Michoacán"
      />
    </div>
  )
}
