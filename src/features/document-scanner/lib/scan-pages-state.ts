/**
 * Operaciones puras sobre la sesión de escaneo (lista de páginas).
 *
 * Todas las funciones devuelven una nueva lista; ninguna muta la entrada ni revoca
 * object URLs (esa responsabilidad es del hook/componente que las posee).
 *
 * La Veinte Digital
 */

import type { MoveDirection, ScanFilter, ScanPage, RotationDegrees } from "../types/scanner-types"
import { rotateClockwise } from "../types/scanner-types"

export function createPageId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    // ignore
  }
  return `scan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function addPage(pages: ScanPage[], page: ScanPage): ScanPage[] {
  return [...pages, page]
}

export function addPages(pages: ScanPage[], newPages: ScanPage[]): ScanPage[] {
  return [...pages, ...newPages]
}

export function removePage(pages: ScanPage[], id: string): ScanPage[] {
  return pages.filter((p) => p.id !== id)
}

export function movePage(pages: ScanPage[], id: string, direction: MoveDirection): ScanPage[] {
  const index = pages.findIndex((p) => p.id === id)
  if (index < 0) return pages
  const target = direction === "up" ? index - 1 : index + 1
  if (target < 0 || target >= pages.length) return pages
  const next = [...pages]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

export function reorderPages(pages: ScanPage[], fromIndex: number, toIndex: number): ScanPage[] {
  if (fromIndex === toIndex) return pages
  if (fromIndex < 0 || fromIndex >= pages.length) return pages
  if (toIndex < 0 || toIndex >= pages.length) return pages
  const next = [...pages]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

export function replacePage(pages: ScanPage[], id: string, replacement: ScanPage): ScanPage[] {
  return pages.map((p) => (p.id === id ? replacement : p))
}

export function updatePage(
  pages: ScanPage[],
  id: string,
  patch: Partial<
    Pick<ScanPage, "blob" | "previewUrl" | "filter" | "rotation" | "corners" | "width" | "height" | "sourceBlob" | "engine">
  >
): ScanPage[] {
  return pages.map((p) => (p.id === id ? { ...p, ...patch } : p))
}

export function rotatePage(pages: ScanPage[], id: string): ScanPage[] {
  return pages.map((p) =>
    p.id === id ? { ...p, rotation: rotateClockwise(p.rotation) as RotationDegrees } : p
  )
}

export function setPageFilter(pages: ScanPage[], id: string, filter: ScanFilter): ScanPage[] {
  return pages.map((p) => (p.id === id ? { ...p, filter } : p))
}

export function clearPages(): ScanPage[] {
  return []
}

export function pageCount(pages: ScanPage[]): number {
  return pages.length
}

/** Revoca todas las previewUrl de las páginas (limpieza de memoria). */
export function releasePages(pages: ScanPage[]): void {
  for (const page of pages) {
    if (page.previewUrl && page.previewUrl.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(page.previewUrl)
      } catch {
        // ignore
      }
    }
  }
}
