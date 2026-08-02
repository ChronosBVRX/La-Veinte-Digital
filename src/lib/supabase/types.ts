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
      chat_room_invitations: {
        Row: {
          created_at: string | null
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_invitations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_invitations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_room_invitations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          room_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          room_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          id: string
          joined_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_private: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_private?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      forum_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          author_id: string
          category_id: string | null
          content: string
          created_at: string | null
          id: string
          is_locked: boolean | null
          is_pinned: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          category_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          category_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_locked?: boolean | null
          is_pinned?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "limited_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "forum_categories"
            referencedColumns: ["id"]
          },
        ]
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
          category_code: string | null
          category_id: string | null
          category_name: string | null
          consent_given: boolean
          consent_given_at: string | null
          consent_version: string | null
          effective_seniority_date: string | null
          employment_type: string | null
          occupational_conditions: Json
          payroll_facts: Json
          recurring_concepts: Json
          siap_concept_marks: Json
          updated_at: string
          user_id: string
          workday_hours: number | null
        }
        Insert: {
          category_code?: string | null
          category_id?: string | null
          category_name?: string | null
          consent_given?: boolean
          consent_given_at?: string | null
          consent_version?: string | null
          effective_seniority_date?: string | null
          employment_type?: string | null
          occupational_conditions?: Json
          payroll_facts?: Json
          recurring_concepts?: Json
          siap_concept_marks?: Json
          updated_at?: string
          user_id: string
          workday_hours?: number | null
        }
        Update: {
          category_code?: string | null
          category_id?: string | null
          category_name?: string | null
          consent_given?: boolean
          consent_given_at?: string | null
          consent_version?: string | null
          effective_seniority_date?: string | null
          employment_type?: string | null
          occupational_conditions?: Json
          payroll_facts?: Json
          recurring_concepts?: Json
          siap_concept_marks?: Json
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
      ensure_profile_exists: { Args: never; Returns: boolean }
      erase_user_payroll_data: { Args: never; Returns: undefined }
      increment_api_usage: {
        Args: { p_limit: number; p_route: string; p_user: string }
        Returns: boolean
      }
      search_catalogo: {
        Args: { catalogo_type: string; search_term: string }
        Returns: {
          nombre: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
