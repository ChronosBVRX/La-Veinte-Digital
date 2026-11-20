"use client"

import dynamic from "next/dynamic"
import { useState, useCallback } from "react"
import { AppHeader } from "@/shared/components/app/AppHeader"
import { DesktopSidebar } from "@/shared/components/app/DesktopSidebar"
import { MobileViewportProvider } from "./MobileViewportProvider"
import { FloatingChatProvider } from "@/features/asistente/context/FloatingChatContext"
import { RadioProvider } from "@/features/radio/context/RadioContext"
import { PersistentRadioBar } from "@/features/radio/components/PersistentRadioBar"
import type { ReactNode } from "react"

const FloatingChatWidget = dynamic(
  () => import("@/features/asistente/components/FloatingChatWidget").then((m) => m.FloatingChatWidget),
  { ssr: false },
)

interface DashboardShellProps {
  fullName: string | null
  avatarUrl?: string | null
  canAccessAdmin?: boolean
  canAccessUnion?: boolean
  isCajaPublic?: boolean
  children: ReactNode
}

export function DashboardShell({
  fullName,
  avatarUrl,
  canAccessAdmin = false,
  canAccessUnion = false,
  isCajaPublic = false,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <MobileViewportProvider>
      <RadioProvider>
        <FloatingChatProvider>
          <div className="mobile-app-shell">
            <AppHeader
              fullName={fullName}
              avatarUrl={avatarUrl}
              onMenuToggle={toggleSidebar}
              canAccessUnion={canAccessUnion}
            />

            <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
              <DesktopSidebar
                open={sidebarOpen}
                onClose={closeSidebar}
                canAccessAdmin={canAccessAdmin}
                canAccessUnion={canAccessUnion}
                isCajaPublic={isCajaPublic}
              />
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

            <PersistentRadioBar />
            <FloatingChatWidget />
          </div>
        </FloatingChatProvider>
      </RadioProvider>
    </MobileViewportProvider>
  )
}
