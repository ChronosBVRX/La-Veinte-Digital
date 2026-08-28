"use client"

export interface ScannerErrorContext {
  bridgeReady: boolean
  nativeShell: boolean
}

/**
 * Extracts camera/scanner diagnostics and maps likely `getUserMedia` exceptions to a clear message,
 * logging the full context (instruction #4) so the actual failure is never hidden.
 */
export function describeScannerError(err: unknown, ctx: ScannerErrorContext): string {
  const name = err instanceof Error ? err.name : "unknown"
  // eslint-disable-next-line no-console
  console.error(
    "PRINT_FLOW scanner_error",
    "name=", name,
    "message=", err instanceof Error ? err.message : String(err),
    "bridgeReady=", ctx.bridgeReady,
    "nativeShell=", ctx.nativeShell,
    "secureContext=", typeof window !== "undefined" ? String(window.isSecureContext) : "n/a",
    "mediaDevices=", typeof navigator !== "undefined" ? String(!!navigator.mediaDevices) : "n/a",
    "getUserMedia=", String(!!(typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia)),
    "url=", typeof window !== "undefined" ? window.location.href : "n/a",
  )

  switch (name) {
    case "NotAllowedError":
      return "No diste permiso de cámara. Toca \"Permitir cámara\" para intentarlo de nuevo."
    case "NotFoundError":
      return "No se encontró ninguna cámara en este dispositivo."
    case "NotReadableError":
      return "La cámara está ocupada por otra aplicación. Ciérrala y vuelve a intentar."
    case "OverconstrainedError":
      return "La cámara no pudo configurarse. Prueba con otra cámara."
    case "SecurityError":
      return "El contexto no es seguro para la cámara. Actualiza la app e inténtalo de nuevo."
    case "AbortError":
      return "Se canceló el acceso a la cámara."
    case "TypeError":
      return "La cámara no está disponible en este dispositivo."
    default:
      return err instanceof Error && err.message
        ? err.message
        : "No se pudo acceder a la cámara. Permite el acceso o usa otro dispositivo."
  }
}
