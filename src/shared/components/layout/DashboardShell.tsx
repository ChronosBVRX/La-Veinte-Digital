"use client"

import { useState, useCallback } from "react"
import { AppHeader } from "@/shared/components/app/AppHeader"
import { DesktopSidebar } from "@/shared/components/app/DesktopSidebar"
import { MobileBottomNav } from "@/shared/components/app/MobileBottomNav"
import { MobileNavigationSheet } from "@/shared/components/app/MobileNavigationSheet"
import { MobileViewportProvider } from "./MobileViewportProvider"
import type { ReactNode } from "react"

interface DashboardShellProps {
  fullName: string | null
  children: ReactNode
}

export function DashboardShell({ fullName, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sheetKey, setSheetKey] = useState<string | null>(null)

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  const openSheet = useCallback((key: string) => {
    setSheetKey(key)
  }, [])

  const closeSheet = useCallback(() => {
    setSheetKey(null)
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
              padding: "clamp(1rem, 2vw, 1.5rem)",
              minWidth: 0,
            }}
          >
            <div className="animate-fade-in">{children}</div>
          </main>
        </div>

        <MobileBottomNav onSheetOpen={openSheet} />
        <MobileNavigationSheet
          openKey={sheetKey}
          onClose={closeSheet}
          onNavigate={closeSheet}
        />
      </div>
    </MobileViewportProvider>
  )
}
