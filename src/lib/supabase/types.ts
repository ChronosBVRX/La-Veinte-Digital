export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          request_id?: string | null
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          bar_text: string | null
          body: string
          created_at: string
          created_by: string | null
          destination_path: string | null
          expires_at: string | null
          id: string
          kind: string
          publish_at: string | null
          push_summary: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          revision: number
          show_in_bar: boolean
          show_in_inbox: boolean
          source_document: string | null
          source_page: string | null
          source_reference: string | null
          source_version: string | null
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bar_text?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          destination_path?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          publish_at?: string | null
          push_summary?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          show_in_bar?: boolean
          show_in_inbox?: boolean
          source_document?: string | null
          source_page?: string | null
          source_reference?: string | null
          source_version?: string | null
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bar_text?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          destination_path?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          publish_at?: string | null
          push_summary?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          revision?: number
          show_in_bar?: boolean
          show_in_inbox?: boolean
          source_document?: string | null
          source_page?: string | null
          source_reference?: string | null
          source_version?: string | null
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_job_runs: {
        Row: {
          created_at: string
          details: Json | null
          error_code: string | null
          finished_at: string | null
          id: string
          job_kind: string
          processed_campaigns: number
          processed_deliveries: number
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          job_kind?: string
          processed_campaigns?: number
          processed_deliveries?: number
          started_at?: string
          status: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          error_code?: string | null
          finished_at?: string | null
          id?: string
          job_kind?: string
          processed_campaigns?: number
          processed_deliveries?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          announcements_push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          announcements_push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          announcements_push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_campaign_deliveries: {
        Row: {
          accepted_at: string | null
          attempts: number
          campaign_id: string
          claim_token: string | null
          created_at: string
          device_id: string | null
          error_code: string | null
          fcm_token: string
          id: string
          lease_until: string | null
          next_attempt_at: string | null
          snapshot_device_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          attempts?: number
          campaign_id: string
          claim_token?: string | null
          created_at?: string
          device_id?: string | null
          error_code?: string | null
          fcm_token: string
          id?: string
          lease_until?: string | null
          next_attempt_at?: string | null
          snapshot_device_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          attempts?: number
          campaign_id?: string
          claim_token?: string | null
          created_at?: string
          device_id?: string | null
          error_code?: string | null
          fcm_token?: string
          id?: string
          lease_until?: string | null
          next_attempt_at?: string | null
          snapshot_device_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_campaigns: {
        Row: {
          accepted_count: number
          announcement_id: string | null
          announcement_revision: number
          audience: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          failed_count: number
          id: string
          idempotency_key: string | null
          invalid_tokens_count: number
          notification_id: number
          purpose: string
          scheduled_at: string | null
          skipped_count: number
          snapshot_body: string
          snapshot_destination: string | null
          snapshot_title: string
          snapshot_type: string
          status: string
          target_accounts: number
          target_devices: number
          unknown_count: number
          updated_at: string
        }
        Insert: {
          accepted_count?: number
          announcement_id?: string | null
          announcement_revision?: number
          audience: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          failed_count?: number
          id?: string
          idempotency_key?: string | null
          invalid_tokens_count?: number
          notification_id?: number
          purpose: string
          scheduled_at?: string | null
          skipped_count?: number
          snapshot_body: string
          snapshot_destination?: string | null
          snapshot_title: string
          snapshot_type?: string
          status?: string
          target_accounts?: number
          target_devices?: number
          unknown_count?: number
          updated_at?: string
        }
        Update: {
          accepted_count?: number
          announcement_id?: string | null
          announcement_revision?: number
          audience?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          failed_count?: number
          id?: string
          idempotency_key?: string | null
          invalid_tokens_count?: number
          notification_id?: number
          purpose?: string
          scheduled_at?: string | null
          skipped_count?: number
          snapshot_body?: string
          snapshot_destination?: string | null
          snapshot_title?: string
          snapshot_type?: string
          status?: string
          target_accounts?: number
          target_devices?: number
          unknown_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      push_devices: {
        Row: {
          android_version: string | null
          app_version: string | null
          created_at: string
          device_model: string | null
          fcm_token: string
          id: string
          last_seen_at: string
          notifications_enabled: boolean
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          android_version?: string | null
          app_version?: string | null
          created_at?: string
          device_model?: string | null
          fcm_token: string
          id?: string
          last_seen_at?: string
          notifications_enabled?: boolean
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          android_version?: string | null
          app_version?: string | null
          created_at?: string
          device_model?: string | null
          fcm_token?: string
          id?: string
          last_seen_at?: string
          notifications_enabled?: boolean
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_history: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      android_releases: {
        Row: {
          apk_sha256: string | null
          apk_size: number | null
          apk_url: string | null
          channel: string
          commit_sha: string | null
          created_at: string
          force_update: boolean
          id: number
          minimum_version_code: number | null
          published_at: string | null
          published_by: string | null
          release_notes: string[] | null
          version_code: number
          version_name: string
        }
        Insert: {
          apk_sha256?: string | null
          apk_size?: number | null
          apk_url?: string | null
          channel?: string
          commit_sha?: string | null
          created_at?: string
          force_update?: boolean
          id?: never
          minimum_version_code?: number | null
          published_at?: string | null
          published_by?: string | null
          release_notes?: string[] | null
          version_code: number
          version_name: string
        }
        Update: {
          apk_sha256?: string | null
          apk_size?: number | null
          apk_url?: string | null
          channel?: string
          commit_sha?: string | null
          created_at?: string
          force_update?: boolean
          id?: never
          minimum_version_code?: number | null
          published_at?: string | null
          published_by?: string | null
          release_notes?: string[] | null
          version_code?: number
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "android_releases_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "android_releases_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_log: {
        Row: {
          count: number
          id: number
          route: string
          usage_date: string
          user_id: string
        }
        Insert: {
          count?: number
          id?: never
          route: string
          usage_date?: string
          user_id: string
        }
        Update: {
          count?: number
          id?: never
          route?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      bitacora_entries: {
        Row: {
          created_at: string
          description: string | null
          entry_date: string
          entry_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_date: string
          entry_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_adscripciones: {
        Row: {
          created_at: string | null
          id: number
          nombre: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          nombre: string
        }
        Update: {
          created_at?: string | null
          id?: number
          nombre?: string
        }
        Relationships: []
      }
      imported_payslip_lines: {
        Row: {
          amount: number
          concept_code: string
          confidence: number
          confirmed_by_user: boolean
          description: string
          id: string
          kind: string
          line_index: number
          payslip_id: string
        }
        Insert: {
          amount: number
          concept_code: string
          confidence?: number
          confirmed_by_user?: boolean
          description?: string
          id?: string
          kind: string
          line_index: number
          payslip_id: string
        }
        Update: {
          amount?: number
          concept_code?: string
          confidence?: number
          confirmed_by_user?: boolean
          description?: string
          id?: string
          kind?: string
          line_index?: number
          payslip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "imported_payslip_lines_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "imported_payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_payslip_observations: {
        Row: {
          amount: number | null
          concept_code: string
          control_number: string | null
          due_period: string | null
          id: string
          initial_charge: number | null
          line_index: number
          notes: string | null
          payslip_id: string
          units: number | null
        }
        Insert: {
          amount?: number | null
          concept_code?: string
          control_number?: string | null
          due_period?: string | null
          id?: string
          initial_charge?: number | null
          line_index: number
          notes?: string | null
          payslip_id: string
          units?: number | null
        }
        Update: {
          amount?: number | null
          concept_code?: string
          control_number?: string | null
          due_period?: string | null
          id?: string
          initial_charge?: number | null
          line_index?: number
          notes?: string | null
          payslip_id?: string
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "imported_payslip_observations_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "imported_payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      imported_payslips: {
        Row: {
          attendance: Json
          certification_date: string | null
          created_at: string
          employee_data: Json
          extraction_method: string
          fiscal_folio_hash: string | null
          folio: string | null
          global_confidence: number
          id: string
          payroll_totals: Json
          period_half: number | null
          period_month: number | null
          period_raw: string
          period_year: number | null
          source_hash: string
          user_id: string
          vacations: Json
          warnings: Json
        }
        Insert: {
          attendance?: Json
          certification_date?: string | null
          created_at?: string
          employee_data?: Json
          extraction_method: string
          fiscal_folio_hash?: string | null
          folio?: string | null
          global_confidence?: number
          id?: string
          payroll_totals?: Json
          period_half?: number | null
          period_month?: number | null
          period_raw?: string
          period_year?: number | null
          source_hash: string
          user_id: string
          vacations?: Json
          warnings?: Json
        }
        Update: {
          attendance?: Json
          certification_date?: string | null
          created_at?: string
          employee_data?: Json
          extraction_method?: string
          fiscal_folio_hash?: string | null
          folio?: string | null
          global_confidence?: number
          id?: string
          payroll_totals?: Json
          period_half?: number | null
          period_month?: number | null
          period_raw?: string
          period_year?: number | null
          source_hash?: string
          user_id?: string
          vacations?: Json
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "imported_payslips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imported_payslips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_contexts: {
        Row: {
          adscripcion: string | null
          category_code: string | null
          category_id: string | null
          category_name: string | null
          consent_given: boolean
          consent_given_at: string | null
          consent_version: string | null
          effective_seniority_date: string | null
          employment_type: string | null
          matricula: string | null
          occupational_conditions: Json
          payroll_facts: Json
          recurring_concepts: Json
          shift: string | null
          siap_concept_marks: Json
          source_adscripcion: string | null
          source_category_name: string | null
          source_effective_seniority_date: string | null
          source_employment_type: string | null
          source_matricula: string | null
          source_shift: string | null
          source_workday_hours: string | null
          updated_at: string
          user_id: string
          workday_hours: number | null
        }
        Insert: {
          adscripcion?: string | null
          category_code?: string | null
          category_id?: string | null
          category_name?: string | null
          consent_given?: boolean
          consent_given_at?: string | null
          consent_version?: string | null
          effective_seniority_date?: string | null
          employment_type?: string | null
          matricula?: string | null
          occupational_conditions?: Json
          payroll_facts?: Json
          recurring_concepts?: Json
          shift?: string | null
          siap_concept_marks?: Json
          source_adscripcion?: string | null
          source_category_name?: string | null
          source_effective_seniority_date?: string | null
          source_employment_type?: string | null
          source_matricula?: string | null
          source_shift?: string | null
          source_workday_hours?: string | null
          updated_at?: string
          user_id: string
          workday_hours?: number | null
        }
        Update: {
          adscripcion?: string | null
          category_code?: string | null
          category_id?: string | null
          category_name?: string | null
          consent_given?: boolean
          consent_given_at?: string | null
          consent_version?: string | null
          effective_seniority_date?: string | null
          employment_type?: string | null
          matricula?: string | null
          occupational_conditions?: Json
          payroll_facts?: Json
          recurring_concepts?: Json
          shift?: string | null
          siap_concept_marks?: Json
          source_adscripcion?: string | null
          source_category_name?: string | null
          source_effective_seniority_date?: string | null
          source_employment_type?: string | null
          source_matricula?: string | null
          source_shift?: string | null
          source_workday_hours?: string | null
          updated_at?: string
          user_id?: string
          workday_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_contexts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_contexts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          adscripcion: string | null
          antiguedad: string | null
          avatar_url: string | null
          categoria: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_online: boolean | null
          matricula: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          adscripcion?: string | null
          antiguedad?: string | null
          avatar_url?: string | null
          categoria?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          is_online?: boolean | null
          matricula?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          adscripcion?: string | null
          antiguedad?: string | null
          avatar_url?: string | null
          categoria?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_online?: boolean | null
          matricula?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transfer_files: {
        Row: {
          content_type: string
          created_at: string
          data: string
          id: string
          name: string
          session_id: string
          size_bytes: number
        }
        Insert: {
          content_type: string
          created_at?: string
          data: string
          id?: string
          name: string
          session_id: string
          size_bytes: number
        }
        Update: {
          content_type?: string
          created_at?: string
          data?: string
          id?: string
          name?: string
          session_id?: string
          size_bytes?: number
        }
        Relationships: [
          {
            foreignKeyName: "transfer_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "transfer_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          owner_id: string | null
          owner_token: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          owner_id?: string | null
          owner_token: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          owner_id?: string | null
          owner_token?: string
          token?: string
        }
        Relationships: []
      }
      vacation_calendar_roles: {
        Row: {
          calendar_id: string
          enabled: boolean
          id: string
          label: string | null
          role_number: number
          start_date: string
        }
        Insert: {
          calendar_id: string
          enabled?: boolean
          id?: string
          label?: string | null
          role_number: number
          start_date: string
        }
        Update: {
          calendar_id?: string
          enabled?: boolean
          id?: string
          label?: string | null
          role_number?: number
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_calendar_roles_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "vacation_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_calendars: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          source_date: string | null
          source_name: string
          status: string
          updated_at: string
          version: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          source_date?: string | null
          source_name?: string
          status?: string
          updated_at?: string
          version: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          source_date?: string | null
          source_name?: string
          status?: string
          updated_at?: string
          version?: string
          year?: number
        }
        Relationships: []
      }
      vacation_mandatory_rest_days: {
        Row: {
          date: string
          id: string
          label: string
          source_document: string | null
          year: number
        }
        Insert: {
          date: string
          id?: string
          label: string
          source_document?: string | null
          year: number
        }
        Update: {
          date?: string
          id?: string
          label?: string
          source_document?: string | null
          year?: number
        }
        Relationships: []
      }
      vacation_profile_data: {
        Row: {
          adscription: string | null
          category: string | null
          category_code: string | null
          contract_end_date: string | null
          contract_type: string | null
          created_at: string
          effective_seniority_days: number | null
          effective_seniority_fortnights: number | null
          effective_seniority_years: number | null
          entry_date: string | null
          id: string
          radiological_exposure: string | null
          service: string | null
          shift: string | null
          unit: string | null
          updated_at: string
          user_id: string
          weekly_rest_days: number[] | null
          work_schedule_type: string | null
        }
        Insert: {
          adscription?: string | null
          category?: string | null
          category_code?: string | null
          contract_end_date?: string | null
          contract_type?: string | null
          created_at?: string
          effective_seniority_days?: number | null
          effective_seniority_fortnights?: number | null
          effective_seniority_years?: number | null
          entry_date?: string | null
          id?: string
          radiological_exposure?: string | null
          service?: string | null
          shift?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
          weekly_rest_days?: number[] | null
          work_schedule_type?: string | null
        }
        Update: {
          adscription?: string | null
          category?: string | null
          category_code?: string | null
          contract_end_date?: string | null
          contract_type?: string | null
          created_at?: string
          effective_seniority_days?: number | null
          effective_seniority_fortnights?: number | null
          effective_seniority_years?: number | null
          entry_date?: string | null
          id?: string
          radiological_exposure?: string | null
          service?: string | null
          shift?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
          weekly_rest_days?: number[] | null
          work_schedule_type?: string | null
        }
        Relationships: []
      }
      vacation_rule_versions: {
        Row: {
          code: string
          configuration: Json
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          enabled: boolean
          id: string
          priority: number
          regime: string
          source_document: string
          source_reference: string
        }
        Insert: {
          code: string
          configuration?: Json
          created_at?: string
          created_by?: string | null
          effective_from: string
          effective_to?: string | null
          enabled?: boolean
          id?: string
          priority?: number
          regime: string
          source_document: string
          source_reference: string
        }
        Update: {
          code?: string
          configuration?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          enabled?: boolean
          id?: string
          priority?: number
          regime?: string
          source_document?: string
          source_reference?: string
        }
        Relationships: []
      }
      vacation_simulation_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          simulation_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          simulation_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          simulation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_simulation_events_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "vacation_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_simulations: {
        Row: {
          calendar_id: string | null
          created_at: string
          id: string
          input_snapshot: Json
          result_snapshot: Json
          rule_version_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id?: string | null
          created_at?: string
          id?: string
          input_snapshot: Json
          result_snapshot: Json
          rule_version_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string | null
          created_at?: string
          id?: string
          input_snapshot?: Json
          result_snapshot?: Json
          rule_version_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_simulations_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "vacation_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      commitment_reminder_deliveries: {
        Row: {
          commitment_id: string
          delivered_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          reminder_type: string
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          commitment_id: string
          delivered_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          reminder_type: string
          scheduled_for: string
          status?: string
          user_id: string
        }
        Update: {
          commitment_id?: string
          delivered_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          reminder_type?: string
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitment_reminder_deliveries_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "worker_commitments"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_commitments: {
        Row: {
          created_at: string
          details: Json
          end_at: string
          id: string
          legacy_local_id: string | null
          notes: string | null
          reminder_at_start: boolean
          reminder_day_before: boolean
          reminder_hours_before: boolean
          service: string | null
          start_at: string
          status: string
          substitute_worker_name: string | null
          title: string
          type: string
          user_id: string
          workplace: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          end_at: string
          id?: string
          legacy_local_id?: string | null
          notes?: string | null
          reminder_at_start?: boolean
          reminder_day_before?: boolean
          reminder_hours_before?: boolean
          service?: string | null
          start_at: string
          status?: string
          substitute_worker_name?: string | null
          title: string
          type: string
          user_id: string
          workplace?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          end_at?: string
          id?: string
          legacy_local_id?: string | null
          notes?: string | null
          reminder_at_start?: boolean
          reminder_day_before?: boolean
          reminder_hours_before?: boolean
          service?: string | null
          start_at?: string
          status?: string
          substitute_worker_name?: string | null
          title?: string
          type?: string
          user_id?: string
          workplace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_commitments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_commitments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_consents: {
        Row: {
          accepted_at: string
          accepted_source: string
          created_at: string
          id: string
          purpose: string
          revoked_at: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          accepted_source: string
          created_at?: string
          id?: string
          purpose: string
          revoked_at?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          accepted_source?: string
          created_at?: string
          id?: string
          purpose?: string
          revoked_at?: string | null
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_data_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          metadata: Json
          priority: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json
          priority: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json
          priority?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_data_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_data_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_preferences: {
        Row: {
          created_at: string
          onboarding_state: string
          preferred_worker_mode: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          onboarding_state: string
          preferred_worker_mode?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          onboarding_state?: string
          preferred_worker_mode?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      limited_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_announcement_atomic: {
        Args: { p_announcement_id: string }
        Returns: undefined
      }
      _insert_worker_event: {
        Args: { p_event_type: string; p_metadata?: Json; p_priority: string }
        Returns: undefined
      }
      backfill_worker_profile: {
        Args: never
        Returns: {
          conflicts_mismatch: number
          conflicts_unparseable: number
          contexts_filled: number
          preferences_created: number
        }[]
      }
      change_worker_profile_mode: {
        Args: { p_new_mode: string }
        Returns: undefined
      }
      choose_basic_mode: { Args: never; Returns: undefined }
      confirm_imported_payslip: {
        Args: {
          p_acknowledge_total_difference: boolean
          p_authorize_server_storage: boolean
          p_parsed: Json
          p_profile_updates: Json
          p_source_hash: string
        }
        Returns: Json
      }
      confirm_imported_payslip_v1: {
        Args: {
          p_acknowledge_total_difference: boolean
          p_authorize_server_storage: boolean
          p_parsed: Json
          p_profile_updates: Json
          p_source_hash: string
        }
        Returns: Json
      }
      confirm_manual_worker_profile: {
        Args: {
          p_consent_version: string
          p_identity: Json
          p_situation: Json
          p_sources: Json
        }
        Returns: undefined
      }
      confirm_payslip_worker_profile: {
        Args: {
          p_confidence?: number
          p_consent_version: string
          p_extraction_method?: string
          p_period?: string
          p_profile_updates: Json
        }
        Returns: undefined
      }
      // → hand-added pending `supabase gen types` after migration 20260830000000_account_deletion.sql
      delete_my_account: { Args: never; Returns: undefined }
      delete_worker_data: { Args: never; Returns: undefined }
      ensure_profile_exists: { Args: never; Returns: boolean }
      erase_user_payroll_data: { Args: never; Returns: undefined }
      get_effective_consent: { Args: { p_purpose: string }; Returns: Json }
      grant_worker_consent: {
        Args: { p_purpose: string; p_version: string }
        Returns: undefined
      }
      increment_api_usage: {
        Args: { p_limit: number; p_route: string; p_user: string }
        Returns: boolean
      }
      mexico_date: { Args: never; Returns: string }
      revoke_worker_consent: { Args: { p_purpose: string }; Returns: undefined }
      safe_numeric_cast: { Args: { value: string }; Returns: number }
      search_catalogo: {
        Args: { catalogo_type: string; search_term: string }
        Returns: {
          nombre: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      transfer_close_session: { Args: { p_owner_token: string }; Returns: Json }
      transfer_create_session: {
        Args: { p_ttl_minutes?: number }
        Returns: Json
      }
      transfer_get_file: {
        Args: { p_file_id: string; p_owner_token: string }
        Returns: Json
      }
      transfer_list_files: { Args: { p_owner_token: string }; Returns: Json }
      transfer_upload_file: {
        Args: {
          p_content_type: string
          p_data: string
          p_name: string
          p_size_bytes: number
          p_token: string
        }
        Returns: Json
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
