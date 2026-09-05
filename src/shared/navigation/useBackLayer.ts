"use client"

import { useEffect, useId, useRef } from "react"
import {
  backNavigationCoordinator,
  ensureLaVeinteNavigation,
} from "./back-navigation-coordinator"

/**
 * Hook reutilizable para integrar capas transitorias al Back canónico.
 *
 * @param open - `true` mientras la capa (modal, sheet, menú, popover…) esté visible.
 * @param onClose - Cierre canónico de la capa. Debe ser EL MISMO que usan
 *   Escape, click fuera y el botón X (no crear un cierre paralelo).
 * @param label - Etiqueta opcional de diagnóstico ("modal", "sheet", …).
 * @returns El `id` estable de la capa (útil para comprobar si es la superior).
 *
 * El componente NO necesita conocer Android: basta con registrarse al abrirse.
 * La desregistración ocurre al cerrarse o desmontarse. Sin duplicados.
 */
export function useBackLayer(
  open: boolean,
  onClose: (() => void) | undefined,
  label?: string
): string {
  const id = useId()
  const onCloseRef = useRef(onClose)

  // Mantener siempre el cierre más reciente sin re-registrar por cada render.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    ensureLaVeinteNavigation()
    // Sin cierre canónico no hay capa que Atrás pueda cerrar: no registrar.
    if (!open || !onClose) return
    const stableClose = () => {
      onCloseRef.current?.()
    }
    const unregister = backNavigationCoordinator.register(id, stableClose, label)
    return unregister
    // onClose intencionalmente excluido: se lee vía ref para no duplicar capas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id, label])

  return id
}
