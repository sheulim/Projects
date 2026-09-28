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
      approval_events: {
        Row: {
          action: string
          actor_id: string
          campaign_id: string
          created_at: string
          id: string
          item_id: string
          item_kind: string
          item_title: string
          note: string
        }
        Insert: {
          action: string
          actor_id: string
          campaign_id: string
          created_at?: string
          id?: string
          item_id: string
          item_kind: string
          item_title?: string
          note?: string
        }
        Update: {
          action?: string
          actor_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          item_id?: string
          item_kind?: string
          item_title?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_dna: {
        Row: {
          brand_name: string
          disclaimer: string
          example_post: string
          facts: string
          languages: string
          persona: string
          phrases_use: string
          updated_at: string
          user_id: string
          voice: string
          words_avoid: string
        }
        Insert: {
          brand_name?: string
          disclaimer?: string
          example_post?: string
          facts?: string
          languages?: string
          persona?: string
          phrases_use?: string
          updated_at?: string
          user_id?: string
          voice?: string
          words_avoid?: string
        }
        Update: {
          brand_name?: string
          disclaimer?: string
          example_post?: string
          facts?: string
          languages?: string
          persona?: string
          phrases_use?: string
          updated_at?: string
          user_id?: string
          voice?: string
          words_avoid?: string
        }
        Relationships: []
      }
      calendar_items: {
        Row: {
          campaign_id: string
          channel: string
          created_at: string
          description: string
          id: string
          item_date: string
          item_type: string
          position: number
          status: string
          title: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          channel?: string
          created_at?: string
          description?: string
          id?: string
          item_date: string
          item_type?: string
          position?: number
          status?: string
          title: string
          user_id?: string
        }
        Update: {
          campaign_id?: string
          channel?: string
          created_at?: string
          description?: string
          id?: string
          item_date?: string
          item_type?: string
          position?: number
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recommendations: {
        Row: {
          brief: string
          campaign_id: string
          created_at: string
          id: string
          result: Json
          user_id: string
        }
        Insert: {
          brief: string
          campaign_id: string
          created_at?: string
          id?: string
          result: Json
          user_id: string
        }
        Update: {
          brief?: string
          campaign_id?: string
          created_at?: string
          id?: string
          result?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recommendations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_reviewers: {
        Row: {
          assigned_by: string
          campaign_id: string
          created_at: string
          id: string
          reviewer_id: string
        }
        Insert: {
          assigned_by: string
          campaign_id: string
          created_at?: string
          id?: string
          reviewer_id: string
        }
        Update: {
          assigned_by?: string
          campaign_id?: string
          created_at?: string
          id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_reviewers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          actual_cost: number
          budget: number
          business_brief: string
          campaign_goal: string
          channels: string[]
          created_at: string
          end_date: string
          expected_revenue: number
          id: string
          start_date: string
          status: string
          target_audience: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_cost?: number
          budget?: number
          business_brief?: string
          campaign_goal?: string
          channels?: string[]
          created_at?: string
          end_date?: string
          expected_revenue?: number
          id?: string
          start_date?: string
          status?: string
          target_audience?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          actual_cost?: number
          budget?: number
          business_brief?: string
          campaign_goal?: string
          channels?: string[]
          created_at?: string
          end_date?: string
          expected_revenue?: number
          id?: string
          start_date?: string
          status?: string
          target_audience?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_assets: {
        Row: {
          audio_path: string | null
          campaign_id: string
          channel: string
          content: Json
          created_at: string
          id: string
          image_path: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_path?: string | null
          campaign_id: string
          channel: string
          content?: Json
          created_at?: string
          id?: string
          image_path?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          audio_path?: string | null
          campaign_id?: string
          channel?: string
          content?: Json
          created_at?: string
          id?: string
          image_path?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_assets: {
        Row: {
          asset_type: string
          campaign_id: string
          content: string
          created_at: string
          id: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          asset_type: string
          campaign_id: string
          content?: string
          created_at?: string
          id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Update: {
          asset_type?: string
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_campaign_owner: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      is_campaign_reviewer: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      list_members: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
        }[]
      }
      record_approval: {
        Args: {
          _action: string
          _item_id: string
          _kind: string
          _note?: string
        }
        Returns: undefined
      }
      set_user_role: {
        Args: {
          _enabled: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "reviewer"
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
    Enums: {
      app_role: ["admin", "manager", "reviewer"],
    },
  },
} as const
