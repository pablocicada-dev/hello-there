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
      data_sources: {
        Row: {
          last_synced_at: string | null
          newest_observation_at: string | null
          payload: Json
          source_id: string
        }
        Insert: {
          last_synced_at?: string | null
          newest_observation_at?: string | null
          payload?: Json
          source_id: string
        }
        Update: {
          last_synced_at?: string | null
          newest_observation_at?: string | null
          payload?: Json
          source_id?: string
        }
        Relationships: []
      }
      gate_commands: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          device_id: string | null
          id: number
          reason: string
          sent_at: string | null
          source: string
          status: string
          target_pct: number
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          device_id?: string | null
          id?: never
          reason?: string
          sent_at?: string | null
          source: string
          status?: string
          target_pct: number
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          device_id?: string | null
          id?: never
          reason?: string
          sent_at?: string | null
          source?: string
          status?: string
          target_pct?: number
        }
        Relationships: []
      }
      gate_events: {
        Row: {
          created_at: string
          ec: number | null
          h_in: number | null
          h_out: number | null
          id: number
          is_sample: boolean
          reason: string
          source: string
          target_pct: number
        }
        Insert: {
          created_at?: string
          ec?: number | null
          h_in?: number | null
          h_out?: number | null
          id?: never
          is_sample?: boolean
          reason?: string
          source: string
          target_pct: number
        }
        Update: {
          created_at?: string
          ec?: number | null
          h_in?: number | null
          h_out?: number | null
          id?: never
          is_sample?: boolean
          reason?: string
          source?: string
          target_pct?: number
        }
        Relationships: []
      }
      gate_state: {
        Row: {
          alert: string | null
          checks: Json
          draining: boolean
          engine_mode: string
          engine_ran_at: string | null
          engine_reason: string
          engine_target: number
          estop: boolean
          id: number
          mode: string
          target_pct: number
          updated_at: string
        }
        Insert: {
          alert?: string | null
          checks?: Json
          draining?: boolean
          engine_mode?: string
          engine_ran_at?: string | null
          engine_reason?: string
          engine_target?: number
          estop?: boolean
          id?: number
          mode?: string
          target_pct?: number
          updated_at?: string
        }
        Update: {
          alert?: string | null
          checks?: Json
          draining?: boolean
          engine_mode?: string
          engine_ran_at?: string | null
          engine_reason?: string
          engine_target?: number
          estop?: boolean
          id?: number
          mode?: string
          target_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      rain_observations: {
        Row: {
          id: number
          is_sample: boolean
          last24h_mm: number
          last3h_mm: number
          observed_at: string
          rate_mm_h: number
        }
        Insert: {
          id?: never
          is_sample?: boolean
          last24h_mm?: number
          last3h_mm?: number
          observed_at: string
          rate_mm_h?: number
        }
        Update: {
          id?: never
          is_sample?: boolean
          last24h_mm?: number
          last3h_mm?: number
          observed_at?: string
          rate_mm_h?: number
        }
        Relationships: []
      }
      sensor_readings: {
        Row: {
          created_at: string
          device_id: string
          ec_polder: number | null
          ec_river: number
          gate_pct: number
          h_in: number
          h_out: number
          id: number
          is_sample: boolean
          water_temp: number | null
        }
        Insert: {
          created_at?: string
          device_id?: string
          ec_polder?: number | null
          ec_river: number
          gate_pct?: number
          h_in: number
          h_out: number
          id?: never
          is_sample?: boolean
          water_temp?: number | null
        }
        Update: {
          created_at?: string
          device_id?: string
          ec_polder?: number | null
          ec_river?: number
          gate_pct?: number
          h_in?: number
          h_out?: number
          id?: never
          is_sample?: boolean
          water_temp?: number | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          area_name: string
          danger_level: number
          drain_start: number
          drain_stop: number
          id: number
          latitude: number
          longitude: number
          min_head: number
          rain_alert_3h: number
          salinity_limit: number
          simulator_enabled: boolean
          updated_at: string
        }
        Insert: {
          area_name?: string
          danger_level?: number
          drain_start?: number
          drain_stop?: number
          id?: number
          latitude?: number
          longitude?: number
          min_head?: number
          rain_alert_3h?: number
          salinity_limit?: number
          simulator_enabled?: boolean
          updated_at?: string
        }
        Update: {
          area_name?: string
          danger_level?: number
          drain_start?: number
          drain_stop?: number
          id?: number
          latitude?: number
          longitude?: number
          min_head?: number
          rain_alert_3h?: number
          salinity_limit?: number
          simulator_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      rain_bucketed: {
        Args: { p_bucket_seconds: number; p_from: string; p_to: string }
        Returns: {
          bucket: string
          max_rate: number
          n: number
          rain_mm: number
        }[]
      }
      readings_bucketed: {
        Args: { p_bucket_seconds: number; p_from: string; p_to: string }
        Returns: {
          bucket: string
          ec_polder: number
          ec_river: number
          h_in: number
          h_out: number
          max_ec: number
          max_gate_pct: number
          max_h_in: number
          max_h_out: number
          n: number
        }[]
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
