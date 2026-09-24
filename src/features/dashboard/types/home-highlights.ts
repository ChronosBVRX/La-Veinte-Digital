import type { ComponentType } from "react"
import type { IconProps } from "@phosphor-icons/react"

export type HighlightType = "system" | "announcement"

export type IconComponent = ComponentType<
  IconProps & { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" }
>

export interface HighlightPill {
  label: string
  icon?: IconComponent
  color?: string
}

export interface BaseHighlight {
  id: string
  type: HighlightType
  priority: number
  eyebrow: string
  title: string
  description: string
  ctaText: string
  ctaHref?: string
  ctaAction?: () => void
  icon?: IconComponent
  pills?: HighlightPill[]
  badgeText?: string
  gradient?: string
  enabled: boolean
  startsAt?: string
  endsAt?: string
  testId?: string
}

export interface SystemHighlight extends BaseHighlight {
  type: "system"
}

export interface AnnouncementHighlight extends BaseHighlight {
  type: "announcement"
  kind: "announcement" | "tip" | "tool"
  ctaHref: string
}

export type HomeHighlight = SystemHighlight | AnnouncementHighlight

/**
 * Escala canónica de prioridades para los destacados de Inicio:
 * - Aumento salarial personalizado: alta (80)
 * - Roles vacacionales 2027: alta (75)
 * - Servicio de copias: alta (70)
 * - Avisos urgentes / administración: muy alta / alta (60 - 95)
 * - Transferencia de documentos: media (50)
 * - Calculadoras concretas: media (45)
 * - Guía del Tarjetón: media (40)
 */
export const HIGHLIGHT_PRIORITIES = {
  URGENT_ANNOUNCEMENT: 95,
  SALARY_INCREASE: 80,
  VACATION_ROLES_2027: 75,
  COPY_SERVICE: 70,
  DEFAULT_ANNOUNCEMENT: 60,
  TRANSFER_DOCUMENTS: 50,
  CALCULATOR: 45,
  GUIA_TARJETON: 40,
} as const
