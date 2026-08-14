"use client"

import { useEffect, useState } from "react"
import { detectAppEnvironment, type AppEnvironment } from "@/shared/lib/app-environment"

/** Evento que la app nativa dispara al terminar de inyectar el bridge (ver LaVeinteBridge.swift). */
export const NATIVE_READY_EVENT = "laveinte:native-ready"

/**
 * Ventana de espera para que el bridge nativo se inyecte antes de resolver como web.
 * Evita el parpadeo del botón de descarga dentro de la APK.
 */
export const NATIVE_READY_GRACE_MS = 400

export interface AppEnvironmentState extends AppEnvironment {
  /** false hasta que la detección termina (bridge listo o timeout). No renderizar UI nativa antes. */
  resolved: boolean
}

/**
 * Estado del entorno: web vs. app nativa (android/ios).
 * El botón de descarga (o cualquier UI nativa) debe esperar a `resolved`.
 */
export function useAppEnvironment(): AppEnvironmentState {
  const [state, setState] = useState<AppEnvironmentState>(() => ({
    environment: "web",
    platform: null,
    resolved: false,
  }))

  useEffect(() => {
    let active = true

    const resolve = () => {
      if (!active) return
      active = false
      window.removeEventListener(NATIVE_READY_EVENT, resolve)
      clearTimeout(timeout)
      setState({
        ...detectAppEnvironment({
          laVeinteApp: window.LaVeinteApp,
          userAgent: navigator.userAgent,
        }),
        resolved: true,
      })
    }

    const timeout = window.setTimeout(resolve, NATIVE_READY_GRACE_MS)
    window.addEventListener(NATIVE_READY_EVENT, resolve)

    if (window.LaVeinteApp) resolve()

    return () => {
      active = false
      window.removeEventListener(NATIVE_READY_EVENT, resolve)
      clearTimeout(timeout)
    }
  }, [])

  return state
}
