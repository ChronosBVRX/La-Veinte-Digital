"use client"

import { useEffect, useRef, useState } from "react"
import { LoadingSpinner } from "@/shared/components/ui/LoadingSpinner"

const PAGES: Record<string, { url: string; name: string }> = {
  seccionxx: {
    url: "https://www.facebook.com/SNTSSSeccionXXMichoacan",
    name: "Sección XX Michoacán",
  },
  cen: {
    url: "https://www.facebook.com/SNTSSOFICIAL",
    name: "CEN SNTSS",
  },
}

interface Props {
  compact?: boolean
  page?: keyof typeof PAGES
  label?: string
}

export function FacebookFeed({ compact, page = "seccionxx", label }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [useIframe, setUseIframe] = useState(false)
  const ref = useRef<HTMLIFrameElement>(null)
  const cfg = PAGES[page]
  const fbUrl = cfg?.url ?? PAGES.seccionxx.url
  const fbHeight = compact ? "500" : "1000"

  useEffect(() => {
    if (window.innerWidth >= 1024) setUseIframe(true)
    const timer = setTimeout(() => {
      if (!loaded) setLoaded(true)
    }, 8000)
    return () => clearTimeout(timer)
  }, [loaded])

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fb = (window as any).FB
        if (fb && typeof fb.XFBML?.parse === "function") fb.XFBML.parse()
      } catch {}
    }
  }, [loaded])

  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", overflow: "visible",
    }}>
      {useIframe ? (
        <div style={{ maxWidth: 500, margin: "0 auto", minHeight: fbHeight }}>
          {!loaded && <LoadingSpinner text="Cargando Facebook..." />}
          <iframe
            ref={ref}
            onLoad={() => setLoaded(true)}
            src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(fbUrl)}&tabs=timeline&width=500&height=${fbHeight}&small_header=true&adapt_container_width=true&hide_cover=true&show_facepile=false`}
            width="500"
            height={fbHeight}
            style={{
              border: "none", overflow: "hidden", width: "100%",
              minHeight: fbHeight,
              display: loaded ? "block" : "none",
            }}
            scrolling="yes"
            frameBorder="0"
            title={label ?? cfg?.name ?? "Facebook SNTSS"}
          />
        </div>
      ) : (
        <a
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block", textDecoration: "none", color: "var(--fg)",
            padding: compact ? "1rem" : "1.5rem", textAlign: "center",
          }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            background: "#1877F2", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 0.5rem",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073c0-6.627-5.373-12-12-12-6.627 0-12 4.627-12 12 0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.234 2.686.234v2.953H15.33c-1.49 0-1.955.925-1.955 1.874v2.25h3.328l-.532 3.47h-2.796V24C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <p style={{
            fontSize: "0.8125rem", fontWeight: 600, margin: "0 0 0.25rem",
          }}>
            {label ?? cfg?.name ?? "Facebook SNTSS"}
          </p>
          <p style={{
            fontSize: "0.75rem", color: "var(--muted)", margin: "0 0 0.75rem",
          }}>
            Ver en Facebook
          </p>
          <span style={{
            display: "inline-block", padding: "0.5rem 1rem",
            background: "#1877F2", color: "#fff",
            borderRadius: "var(--radius)", fontWeight: 600, fontSize: "0.8125rem",
          }}>
            Ir a Facebook ↗
          </span>
        </a>
      )}
    </div>
  )
}
