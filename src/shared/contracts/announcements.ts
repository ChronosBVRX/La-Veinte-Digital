export type AnnouncementKind = "announcement" | "tip" | "tool"

export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"

export type PushPurpose = "TEST" | "LIVE"

export type CampaignStatus =
  | "QUEUED"
  | "PROCESSING"
  | "PAUSED"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED"
  | "CANCELLED"
  | "NEEDS_REVIEW"

export type DeliveryStatus =
  | "PENDING"
  | "PROCESSING"
  | "ACCEPTED"
  | "RETRY_PENDING"
  | "FAILED"
  | "INVALID"
  | "SKIPPED"
  | "UNKNOWN"

export interface Announcement {
  id: string
  kind: AnnouncementKind
  title: string
  push_summary: string | null
  body: string
  bar_text: string | null
  destination_path: string | null
  status: AnnouncementStatus
  show_in_inbox: boolean
  show_in_bar: boolean
  publish_at: string | null
  expires_at: string | null
  revision: number
  source_document: string | null
  source_reference: string | null
  source_version: string | null
  source_page: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface AnnouncementInput {
  kind: AnnouncementKind
  title: string
  push_summary?: string | null
  body: string
  bar_text?: string | null
  destination_path?: string | null
  show_in_inbox: boolean
  show_in_bar: boolean
  publish_at?: string | null
  expires_at?: string | null
  source_document?: string | null
  source_reference?: string | null
  source_version?: string | null
  source_page?: string | null
}

export interface AnnouncementRead {
  announcement_id: string
  user_id: string
  read_at: string
}

export interface NotificationPreferences {
  user_id: string
  announcements_push_enabled: boolean
  updated_at: string
}

export interface PushCampaign {
  id: string
  announcement_id: string | null
  announcement_revision: number
  purpose: PushPurpose
  snapshot_title: string
  snapshot_body: string
  snapshot_destination: string | null
  snapshot_type: string
  audience: "ALL" | "SELF"
  status: CampaignStatus
  scheduled_at: string | null
  expires_at: string | null
  created_by: string | null
  idempotency_key: string | null
  notification_id: number
  target_accounts: number
  target_devices: number
  accepted_count: number
  failed_count: number
  invalid_tokens_count: number
  skipped_count: number
  unknown_count: number
  created_at: string
  updated_at: string
}

export interface PushCampaignDelivery {
  id: string
  campaign_id: string
  snapshot_device_id: string
  device_id: string | null
  user_id: string
  fcm_token: string
  status: DeliveryStatus
  attempts: number
  next_attempt_at: string | null
  lease_until: string | null
  claim_token: string | null
  error_code: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}
