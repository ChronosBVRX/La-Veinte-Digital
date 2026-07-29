"use client"

import { useEffect, useRef, useState } from "react"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

const FB_PAGE = "https://www.facebook.com/SNTSSSeccionXXMichoacan"

interface Props {
  compact?: boolean
}

export function FacebookFeed({ compact }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [useIframe, setUseIframe] = useState(false)
  const ref = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (window.innerWidth >= 1024) setUseIframe(true)
    const timer = setTimeout(() => {
      if (!loaded) setLoaded(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [loaded])

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "hidden",
    }}>
      {useIframe ? (
        <>
          {!loaded && <LoadingSpinner text="Cargando Facebook..." />}
          <iframe
            ref={ref}
            onLoad={() => setLoaded(true)}
            src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(FB_PAGE)}&tabs=timeline&width=500&height=${compact ? "400" : "700"}&small_header=true&adapt_container_width=true&hide_cover=${compact ? "true" : "false"}&show_facepile=false`}
            style={{
              border: "none", overflow: "hidden", width: "100%",
              height: compact ? "400" : "700",
              display: loaded ? "block" : "none",
            }}
            scrolling="no"
            frameBorder="0"
            title="Facebook SNTSS Sección XX Michoacán"
          />
        </>
      ) : (
        <div style={{
          padding: compact ? "1rem" : "1.5rem",
          textAlign: "center",
        }}>
          <a
            href={FB_PAGE}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", textDecoration: "none",
              color: "var(--fg)", width: "100%",
              maxWidth: 360, margin: "0 auto",
            }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "#1877F2", display: "flex", alignItems: "center",
              justifyContent: "center", margin: "0 auto 0.75rem",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12-6.627 0-12 4.627-12 12 0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.234 2.686.234v2.953H15.33c-1.49 0-1.955.925-1.955 1.874v2.25h3.328l-.532 3.47h-2.796V24C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <p style={{
              fontSize: "0.875rem", fontWeight: 600, color: "var(--fg)",
              margin: "0 0 0.25rem",
            }}>
              SNTSS Sección XX Michoacán
            </p>
            <p style={{
              fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 1rem",
            }}>
              Mantente informado con las últimas publicaciones
            </p>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem",
              padding: "0.625rem 1.25rem", background: "#1877F2", color: "#fff",
              borderRadius: "var(--radius)", fontWeight: 600, fontSize: "0.875rem",
              transition: "all var(--transition)",
            }}>
              Ir a Facebook ↗
            </span>
          </a>
        </div>
      )}
    </div>
  )
}
