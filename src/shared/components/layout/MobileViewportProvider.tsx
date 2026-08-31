"use client"

import { useVisualViewport } from "@/shared/hooks/useVisualViewport"
import type { ReactNode } from "react"

export function MobileViewportProvider({ children }: { children: ReactNode }) {
  useVisualViewport()
  return <>{children}</>
}
