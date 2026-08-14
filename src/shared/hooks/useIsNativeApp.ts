"use client"

import { useAppEnvironment } from "@/shared/hooks/useAppEnvironment"
import type { NativePlatform } from "@/shared/lib/app-environment"

export type { NativePlatform }

/**
 * Plataforma nativa detectada ("android" | "ios") o null si no estamos en la app.
 * Misma API que antes, ahora con detección centralizada: bridge primero,
 * marcadores de User-Agent como fallback.
 */
export function useNativePlatform(): NativePlatform {
  return useAppEnvironment().platform
}

/** true si estamos dentro de la app nativa (APK Android o app iOS). */
export function useIsNativeApp(): boolean {
  return useAppEnvironment().environment === "native"
}
