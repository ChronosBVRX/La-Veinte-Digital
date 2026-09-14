/**
 * Tipos internos del módulo de digitalización.
 * La frontera compartida vive en `@/shared/contracts/document-scan`.
 *
 * La Veinte Digital
 */

import type { ScanDocumentKind, ScanEngine, ScanFilter } from "@/shared/contracts/document-scan"

export type { ScanDocumentKind, ScanEngine, ScanFilter }

export interface Point {
  x: number
  y: number
}

/** Esquinas en orden canónico: superior-izquierda, superior-derecha, inferior-derecha, inferior-izquierda. */
export type Quad = [Point, Point, Point, Point]

export interface DetectedQuad {
  quad: Quad
  /** 0..1 — confianza heurística de la detección automática. */
  confidence: number
}

export type RotationDegrees = 0 | 90 | 180 | 270

export interface ScanPage {
  id: string
  /** Blob JPEG ya procesado (recortado/enderezado según corresponda). */
  blob: Blob
  /** URL para previsualización (object URL). El consumidor es responsable de revocarla. */
  previewUrl: string
  width: number
  height: number
  filter: ScanFilter
  rotation: RotationDegrees
  engine: ScanEngine
  /** Esquinas usadas en el recorte (solo escaneo web; útil para re-editar). */
  corners?: Quad
}

export interface ScanSession {
  engine: ScanEngine
  pages: ScanPage[]
}

export type ScanStatus =
  | "idle"
  | "starting"
  | "capturing"
  | "processing"
  | "review"
  | "saving"
  | "saved"
  | "error"

/** Dirección de reordenamiento de páginas. */
export type MoveDirection = "up" | "down"

export function rotateClockwise(rotation: RotationDegrees): RotationDegrees {
  return (((rotation + 90) % 360) as RotationDegrees)
}
