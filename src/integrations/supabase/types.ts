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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          key_prefix: string
          last_used_at: string | null
          monthly_limit: number
          name: string
          provider: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id: string
          key_prefix: string
          last_used_at?: string | null
          monthly_limit?: number
          name: string
          provider?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          key_prefix?: string
          last_used_at?: string | null
          monthly_limit?: number
          name?: string
          provider?: string
        }
        Relationships: []
      }
      app_pages: {
        Row: {
          enabled: boolean
          name: string
          path: string
          sort: number
        }
        Insert: {
          enabled?: boolean
          name: string
          path: string
          sort?: number
        }
        Update: {
          enabled?: boolean
          name?: string
          path?: string
          sort?: number
        }
        Relationships: []
      }
      app_role_permissions: {
        Row: {
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          page_path: string
          role_key: string
        }
        Insert: {
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          page_path: string
          role_key: string
        }
        Update: {
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          page_path?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_role_permissions_page_path_fkey"
            columns: ["page_path"]
            isOneToOne: false
            referencedRelation: "app_pages"
            referencedColumns: ["path"]
          },
          {
            foreignKeyName: "app_role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "app_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      app_roles: {
        Row: {
          description: string
          enabled: boolean
          key: string
          name: string
        }
        Insert: {
          description?: string
          enabled?: boolean
          key: string
          name: string
        }
        Update: {
          description?: string
          enabled?: boolean
          key?: string
          name?: string
        }
        Relationships: []
      }
      app_store: {
        Row: {
          device: string
          key: string
          updated_at: string
          value: Json | null
        }
        Insert: {
          device?: string
          key: string
          updated_at?: string
          value?: Json | null
        }
        Update: {
          device?: string
          key?: string
          updated_at?: string
          value?: Json | null
        }
        Relationships: []
      }
      relay_agent: {
        Row: {
          id: number
          info: Json
          last_seen: string
        }
        Insert: {
          id?: number
          info?: Json
          last_seen?: string
        }
        Update: {
          id?: number
          info?: Json
          last_seen?: string
        }
        Relationships: []
      }
      relay_jobs: {
        Row: {
          claimed_at: string | null
          created_at: string
          done_at: string | null
          error: string | null
          id: string
          kind: string
          payload: Json
          result: Json | null
          status: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          done_at?: string | null
          error?: string | null
          id?: string
          kind: string
          payload?: Json
          result?: Json | null
          status?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          done_at?: string | null
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          result?: Json | null
          status?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          at: string
          id: string
          key_id: string | null
          model: string
          ms: number
          output_tokens: number
          prompt_tokens: number
        }
        Insert: {
          at?: string
          id?: string
          key_id?: string | null
          model: string
          ms?: number
          output_tokens?: number
          prompt_tokens?: number
        }
        Update: {
          at?: string
          id?: string
          key_id?: string | null
          model?: string
          ms?: number
          output_tokens?: number
          prompt_tokens?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      relay_claim: {
        Args: { _limit: number }
        Returns: {
          claimed_at: string | null
          created_at: string
          done_at: string | null
          error: string | null
          id: string
          kind: string
          payload: Json
          result: Json | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "relay_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
