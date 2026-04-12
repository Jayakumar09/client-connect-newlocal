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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          about_me: string | null
          annual_income: string | null
          birth_place: string | null
          birth_time: string | null
          caste: string | null
          city: string | null
          complexion: Database["public"]["Enums"]["complexion"] | null
          country: string | null
          country_code: string | null
          created_at: string
          created_by: Database["public"]["Enums"]["created_by"]
          date_of_birth: string
          education: string | null
          email: string | null
          father_name: string | null
          father_occupation: string | null
          full_name: string
          gallery_images: string[] | null
          gender: Database["public"]["Enums"]["gender"]
          height_cm: number | null
          id: string
          is_profile_active: boolean | null
          marital_status: Database["public"]["Enums"]["marital_status"]
          mother_name: string | null
          mother_occupation: string | null
          mother_tongue: string | null
          number_of_brothers: number | null
          number_of_sisters: number | null
          occupation: string | null
          partner_expectations: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          phone_number: string | null
          profile_created_for: Database["public"]["Enums"]["profile_created_for"]
          profile_photo: string | null
          rasi: string | null
          religion: Database["public"]["Enums"]["religion"]
          show_phone_number: boolean | null
          slno: number
          star: string | null
          state: string | null
          sub_caste: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
          working_location: string | null
        }
        Insert: {
          about_me?: string | null
          annual_income?: string | null
          birth_place?: string | null
          birth_time?: string | null
          caste?: string | null
          city?: string | null
          complexion?: Database["public"]["Enums"]["complexion"] | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: Database["public"]["Enums"]["created_by"]
          date_of_birth: string
          education?: string | null
          email?: string | null
          father_name?: string | null
          father_occupation?: string | null
          full_name: string
          gallery_images?: string[] | null
          gender: Database["public"]["Enums"]["gender"]
          height_cm?: number | null
          id?: string
          is_profile_active?: boolean | null
          marital_status?: Database["public"]["Enums"]["marital_status"]
          mother_name?: string | null
          mother_occupation?: string | null
          mother_tongue?: string | null
          number_of_brothers?: number | null
          number_of_sisters?: number | null
          occupation?: string | null
          partner_expectations?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          phone_number?: string | null
          profile_created_for?: Database["public"]["Enums"]["profile_created_for"]
          profile_photo?: string | null
          rasi?: string | null
          religion: Database["public"]["Enums"]["religion"]
          show_phone_number?: boolean | null
          slno?: number
          star?: string | null
          state?: string | null
          sub_caste?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
          working_location?: string | null
        }
        Update: {
          about_me?: string | null
          annual_income?: string | null
          birth_place?: string | null
          birth_time?: string | null
          caste?: string | null
          city?: string | null
          complexion?: Database["public"]["Enums"]["complexion"] | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: Database["public"]["Enums"]["created_by"]
          date_of_birth?: string
          education?: string | null
          email?: string | null
          father_name?: string | null
          father_occupation?: string | null
          full_name?: string
          gallery_images?: string[] | null
          gender?: Database["public"]["Enums"]["gender"]
          height_cm?: number | null
          id?: string
          is_profile_active?: boolean | null
          marital_status?: Database["public"]["Enums"]["marital_status"]
          mother_name?: string | null
          mother_occupation?: string | null
          mother_tongue?: string | null
          number_of_brothers?: number | null
          number_of_sisters?: number | null
          occupation?: string | null
          partner_expectations?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          phone_number?: string | null
          profile_created_for?: Database["public"]["Enums"]["profile_created_for"]
          profile_photo?: string | null
          rasi?: string | null
          religion?: Database["public"]["Enums"]["religion"]
          show_phone_number?: boolean | null
          slno?: number
          star?: string | null
          state?: string | null
          sub_caste?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
          working_location?: string | null
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          receiver_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          receiver_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          receiver_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          new_payment_submitted: boolean
          payment_rejected: boolean
          payment_verified: boolean
          sound_enabled: boolean
          updated_at: string
          user_id: string
          vibration_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          new_payment_submitted?: boolean
          payment_rejected?: boolean
          payment_verified?: boolean
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
          vibration_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          new_payment_submitted?: boolean
          payment_rejected?: boolean
          payment_verified?: boolean
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
          vibration_enabled?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          related_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          plan_type: Database["public"]["Enums"]["plan_type"]
          status: Database["public"]["Enums"]["transaction_status"]
          subscription_id: string | null
          transaction_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          plan_type: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["transaction_status"]
          subscription_id?: string | null
          transaction_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          plan_type?: Database["public"]["Enums"]["plan_type"]
          status?: Database["public"]["Enums"]["transaction_status"]
          subscription_id?: string | null
          transaction_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          address: string
          comments: string | null
          created_at: string
          id: string
          image_urls: string[] | null
          name: string
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          phoneno: string
          profile_image: string | null
          slno: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          comments?: string | null
          created_at?: string
          id?: string
          image_urls?: string[] | null
          name: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          phoneno: string
          profile_image?: string | null
          slno?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          comments?: string | null
          created_at?: string
          id?: string
          image_urls?: string[] | null
          name?: string
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          phoneno?: string
          profile_image?: string | null
          slno?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_interests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_shortlists: {
        Row: {
          created_at: string
          id: string
          shortlisted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shortlisted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shortlisted_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          created_at: string
          id: string
          viewed_at: string
          viewed_profile_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          viewed_at?: string
          viewed_profile_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          viewed_at?: string
          viewed_profile_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean
          created_at: string
          end_date: string | null
          id: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          price_paid: number
          start_date: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          price_paid?: number
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          end_date?: string | null
          id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          price_paid?: number
          start_date?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      backup_logs: {
        Row: {
          id: string
          type: Database["public"]["Enums"]["backup_type"]
          status: Database["public"]["Enums"]["backup_status"]
          started_at: string
          completed_at: string | null
          file_count: number | null
          backup_size: number | null
          drive_folder_id: string | null
          backup_date: string
          retention_deleted: number | null
          error_message: string | null
          created_by: string
        }
        Insert: {
          id?: string
          type: Database["public"]["Enums"]["backup_type"]
          status?: Database["public"]["Enums"]["backup_status"]
          started_at?: string
          completed_at?: string | null
          file_count?: number | null
          backup_size?: number | null
          drive_folder_id?: string | null
          backup_date: string
          retention_deleted?: number | null
          error_message?: string | null
          created_by: string
        }
        Update: {
          id?: string
          type?: Database["public"]["Enums"]["backup_type"]
          status?: Database["public"]["Enums"]["backup_status"]
          started_at?: string
          completed_at?: string | null
          file_count?: number | null
          backup_size?: number | null
          drive_folder_id?: string | null
          backup_date?: string
          retention_deleted?: number | null
          error_message?: string | null
          created_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_storage_capacity: {
        Args: never
        Returns: {
          is_critically_low: boolean
          remaining_bytes: number
          total_bytes: number
          used_bytes: number
          used_percentage: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
      backup_status: "in_progress" | "completed" | "failed"
      backup_type: "manual" | "automatic"
      complexion: "very_fair" | "fair" | "wheatish" | "brown" | "dark"
      created_by: "admin" | "client"
      gender: "male" | "female" | "other"
      marital_status:
        | "never_married"
        | "divorced"
        | "widowed"
        | "awaiting_divorce"
        | "married"
      payment_method: "upi" | "card" | "bank_transfer"
      payment_status: "paid" | "non_paid" | "free"
      plan_type: "free" | "standard" | "premium" | "elite"
      profile_created_for:
        | "self"
        | "parents"
        | "siblings"
        | "relatives"
        | "friends"
      religion:
        | "hindu"
        | "muslim"
        | "christian"
        | "sikh"
        | "buddhist"
        | "jain"
        | "other"
      subscription_status: "active" | "expired" | "pending" | "cancelled"
      transaction_status: "completed" | "pending" | "failed" | "refunded"
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
    Enums: {
      app_role: ["admin", "client"],
      complexion: ["very_fair", "fair", "wheatish", "brown", "dark"],
      created_by: ["admin", "client"],
      gender: ["male", "female", "other"],
      marital_status: [
        "never_married",
        "divorced",
        "widowed",
        "awaiting_divorce",
        "married",
      ],
      payment_method: ["upi", "card", "bank_transfer"],
      payment_status: ["paid", "non_paid", "free"],
      plan_type: ["free", "standard", "premium", "elite"],
      profile_created_for: [
        "self",
        "parents",
        "siblings",
        "relatives",
        "friends",
      ],
      religion: [
        "hindu",
        "muslim",
        "christian",
        "sikh",
        "buddhist",
        "jain",
        "other",
      ],
      subscription_status: ["active", "expired", "pending", "cancelled"],
      transaction_status: ["completed", "pending", "failed", "refunded"],
    },
  },
} as const
