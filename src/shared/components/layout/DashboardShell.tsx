"use client"

import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { AppHeader } from "@/shared/components/app/AppHeader"
import { DesktopSidebar } from "@/shared/components/app/DesktopSidebar"
import { MobileViewportProvider } from "./MobileViewportProvider"
import type { ReactNode } from "react"

// Solo cliente (sin SSR): el contenido depende de sesión/azar del navegador.
// Así el HTML del servidor nunca difiere del primer render (cero mismatch).
const MobileValueBar = dynamic(
  () => import("@/shared/components/app/MobileValueBar").then((m) => m.MobileValueBar),
  { ssr: false },
)

interface DashboardShellProps {
  fullName: string | null
  children: ReactNode
}

export function DashboardShell({ fullName, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <MobileViewportProvider>
      <div className="mobile-app-shell">
        <AppHeader fullName={fullName} onMenuToggle={toggleSidebar} />

        <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
          <DesktopSidebar open={sidebarOpen} onClose={closeSidebar} />
          <main
            className="mobile-app-shell__scroll"
            style={{
              flex: 1,
              padding: "clamp(0.75rem, 2vw, 1.5rem)",
              minWidth: 0,
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
              overflowX: "hidden",
            }}
          >
            <div
              className="animate-fade-in"
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                overflowX: "hidden",
              }}
            >
              {children}
            </div>
          </main>
        </div>

        <MobileValueBar />
      </div>
    </MobileViewportProvider>
  )
}
