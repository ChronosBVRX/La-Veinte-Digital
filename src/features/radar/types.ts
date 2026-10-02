export type RadarCategory =
  | "NOMINA"
  | "ESCALAFON"
  | "PRESTACIONES"
  | "SALUD_RIESGO"
  | "CLIMA_LABORAL"
  | "NORMATIVA"
  | "OTRO"

export type RadarStatus = "PENDING" | "APPROVED" | "REJECTED"

export type RadarSourceType =
  | "GOOGLE_NEWS"
  | "REDDIT"
  | "YOUTUBE"
  | "COMUNICADO_OFICIAL"
  | "OTRO"

export interface RadarTopic {
  id: string
  title: string
  url: string
  source: string
  sourceType: RadarSourceType
  snippet: string
  publishedAt: string
  detectedAt: string
  category: RadarCategory
  relevanceScore: number // 0 a 100
  isRealInterest: boolean
  keyTopic: string
  justification: string
  relatedClause?: string
  status: RadarStatus
  reviewedAt?: string
  reviewedBy?: string
}

export type CalendarAlertKind =
  | "pago_santander"
  | "pago_otros_bancos"
  | "pago_cheque"
  | "pago_jubilados"
  | "inicio_vacaciones"
  | "inicio_interactivo"
  | "fin_interactivo"
  | "descanso_cct"

export interface CalendarAlertItem {
  kind: CalendarAlertKind
  title: string
  message: string
  date: string // YYYY-MM-DD
  badge: string
}

export interface CalendarDayEvaluation {
  date: string
  hasEvents: boolean
  alerts: CalendarAlertItem[]
  pushPayload?: {
    title: string
    body: string
    destination: string
  }
}

export interface CalendarNotificationRecord {
  id: string
  date: string
  title: string
  body: string
  sentAt: string
  targetDevices: number
  status: "SENT" | "FAILED"
  error?: string
}
