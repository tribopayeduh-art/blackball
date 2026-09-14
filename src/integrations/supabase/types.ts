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
      admin_audit: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          details: Json | null
          id: string
          target_user: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          target_user?: string | null
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          title?: string
        }
        Relationships: []
      }
      api_calls: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip: string | null
          method: string
          partner_id: string | null
          payload: Json | null
          response: Json | null
          status_code: number
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip?: string | null
          method: string
          partner_id?: string | null
          payload?: Json | null
          response?: Json | null
          status_code: number
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip?: string | null
          method?: string
          partner_id?: string | null
          payload?: Json | null
          response?: Json | null
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_calls_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "api_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      api_partners: {
        Row: {
          active: boolean
          api_key: string
          api_secret: string
          balance: number
          callback_url: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_key: string
          api_secret: string
          balance?: number
          callback_url?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_key?: string
          api_secret?: string
          balance?: number
          callback_url?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      api_rounds: {
        Row: {
          created_at: string
          external_round_id: string
          external_user_id: string
          id: string
          meta: Json | null
          partner_id: string
          payout: number
          settled_at: string | null
          stake: number
          status: string
        }
        Insert: {
          created_at?: string
          external_round_id: string
          external_user_id: string
          id?: string
          meta?: Json | null
          partner_id: string
          payout?: number
          settled_at?: string | null
          stake: number
          status?: string
        }
        Update: {
          created_at?: string
          external_round_id?: string
          external_user_id?: string
          id?: string
          meta?: Json | null
          partner_id?: string
          payout?: number
          settled_at?: string | null
          stake?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rounds_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "api_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          bot_creation_rate: number
          bot_max_stake: number
          bot_min_stake: number
          bots_enabled: boolean
          deposits_enabled: boolean
          global_rtp: number
          id: boolean
          maintenance_message: string
          maintenance_mode: boolean
          matches_enabled: boolean
          max_stake: number
          min_stake: number
          signups_enabled: boolean
          updated_at: string
          updated_by: string | null
          withdrawals_enabled: boolean
        }
        Insert: {
          bot_creation_rate?: number
          bot_max_stake?: number
          bot_min_stake?: number
          bots_enabled?: boolean
          deposits_enabled?: boolean
          global_rtp?: number
          id?: boolean
          maintenance_message?: string
          maintenance_mode?: boolean
          matches_enabled?: boolean
          max_stake?: number
          min_stake?: number
          signups_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          withdrawals_enabled?: boolean
        }
        Update: {
          bot_creation_rate?: number
          bot_max_stake?: number
          bot_min_stake?: number
          bots_enabled?: boolean
          deposits_enabled?: boolean
          global_rtp?: number
          id?: boolean
          maintenance_message?: string
          maintenance_mode?: boolean
          matches_enabled?: boolean
          max_stake?: number
          min_stake?: number
          signups_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          withdrawals_enabled?: boolean
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string | null
          user_id: string
          username: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          user_id: string
          username: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      cue_skins: {
        Row: {
          active: boolean
          color: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          lore: string | null
          name: string
          payout_multiplier: number
          price: number
          rarity: Database["public"]["Enums"]["cue_rarity"]
          slug: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          lore?: string | null
          name: string
          payout_multiplier?: number
          price: number
          rarity?: Database["public"]["Enums"]["cue_rarity"]
          slug: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          lore?: string | null
          name?: string
          payout_multiplier?: number
          price?: number
          rarity?: Database["public"]["Enums"]["cue_rarity"]
          slug?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          payout: number
          payout_multiplier: number
          rtp_outcome: boolean | null
          server_seed: string | null
          settled_at: string | null
          skin_id: string | null
          stake: number
          started_at: string
          status: Database["public"]["Enums"]["match_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payout?: number
          payout_multiplier?: number
          rtp_outcome?: boolean | null
          server_seed?: string | null
          settled_at?: string | null
          skin_id?: string | null
          stake: number
          started_at?: string
          status?: Database["public"]["Enums"]["match_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payout?: number
          payout_multiplier?: number
          rtp_outcome?: boolean | null
          server_seed?: string | null
          settled_at?: string | null
          skin_id?: string | null
          stake?: number
          started_at?: string
          status?: Database["public"]["Enums"]["match_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_skin_id_fkey"
            columns: ["skin_id"]
            isOneToOne: false
            referencedRelation: "cue_skins"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pix_deposits: {
        Row: {
          amount: number
          created_at: string
          credited_at: string | null
          gateway_id: string | null
          id: string
          identifier: string
          pix_code: string | null
          pix_image: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          credited_at?: string | null
          gateway_id?: string | null
          id?: string
          identifier: string
          pix_code?: string | null
          pix_image?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credited_at?: string | null
          gateway_id?: string | null
          id?: string
          identifier?: string
          pix_code?: string | null
          pix_image?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          ban_reason: string | null
          banned: boolean
          created_at: string
          id: string
          last_login_date: string | null
          last_seen_at: string | null
          level: number
          login_streak: number
          referral_code: string
          referred_by: string | null
          updated_at: string
          username: string
          xp: number
        }
        Insert: {
          balance?: number
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          id: string
          last_login_date?: string | null
          last_seen_at?: string | null
          level?: number
          login_streak?: number
          referral_code: string
          referred_by?: string | null
          updated_at?: string
          username: string
          xp?: number
        }
        Update: {
          balance?: number
          ban_reason?: string | null
          banned?: boolean
          created_at?: string
          id?: string
          last_login_date?: string | null
          last_seen_at?: string | null
          level?: number
          login_streak?: number
          referral_code?: string
          referred_by?: string | null
          updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pvp_matches: {
        Row: {
          created_at: string
          fee_pct: number
          guest_id: string
          guest_seen_at: string
          host_id: string
          host_seen_at: string
          id: string
          last_state: Json | null
          loser_id: string | null
          pot: number
          settled_at: string | null
          shot_num: number
          stake: number
          status: Database["public"]["Enums"]["pvp_status"]
          turn_started_at: string | null
          turn_user_id: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          created_at?: string
          fee_pct?: number
          guest_id: string
          guest_seen_at?: string
          host_id: string
          host_seen_at?: string
          id?: string
          last_state?: Json | null
          loser_id?: string | null
          pot: number
          settled_at?: string | null
          shot_num?: number
          stake: number
          status?: Database["public"]["Enums"]["pvp_status"]
          turn_started_at?: string | null
          turn_user_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          created_at?: string
          fee_pct?: number
          guest_id?: string
          guest_seen_at?: string
          host_id?: string
          host_seen_at?: string
          id?: string
          last_state?: Json | null
          loser_id?: string | null
          pot?: number
          settled_at?: string | null
          shot_num?: number
          stake?: number
          status?: Database["public"]["Enums"]["pvp_status"]
          turn_started_at?: string | null
          turn_user_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          commission: number
          created_at: string
          deposit_amount: number
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          commission: number
          created_at?: string
          deposit_amount: number
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          commission?: number
          created_at?: string
          deposit_amount?: number
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_earnings_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rtp_config: {
        Row: {
          id: boolean
          target_rtp: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          target_rtp?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          target_rtp?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_cues: {
        Row: {
          acquired_at: string
          equipped: boolean
          id: string
          skin_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          equipped?: boolean
          id?: string
          skin_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          equipped?: boolean
          id?: string
          skin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cues_skin_id_fkey"
            columns: ["skin_id"]
            isOneToOne: false
            referencedRelation: "cue_skins"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_missions: {
        Row: {
          claimed: boolean
          created_at: string
          day: string
          id: string
          kind: string
          progress: number
          reward: number
          target: number
          user_id: string
        }
        Insert: {
          claimed?: boolean
          created_at?: string
          day?: string
          id?: string
          kind: string
          progress?: number
          reward: number
          target: number
          user_id: string
        }
        Update: {
          claimed?: boolean
          created_at?: string
          day?: string
          id?: string
          kind?: string
          progress?: number
          reward?: number
          target?: number
          user_id?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_active_matches: {
        Args: never
        Returns: {
          age_seconds: number
          id: string
          stake: number
          started_at: string
          user_id: string
          username: string
        }[]
      }
      admin_adjust_balance: {
        Args: { _delta: number; _note?: string; _user: string }
        Returns: number
      }
      admin_advanced_stats: { Args: never; Returns: Json }
      admin_broadcast: {
        Args: { _body: string; _kind?: string; _title: string }
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "admin_notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_create_partner: {
        Args: { _callback_url?: string; _name: string }
        Returns: {
          active: boolean
          api_key: string
          api_secret: string
          balance: number
          callback_url: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "api_partners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_cue_skin: { Args: { _id: string }; Returns: boolean }
      admin_delete_partner: { Args: { _id: string }; Returns: boolean }
      admin_force_end_match: {
        Args: { _match: string; _refund?: boolean }
        Returns: boolean
      }
      admin_get_settings: {
        Args: never
        Returns: {
          bot_creation_rate: number
          bot_max_stake: number
          bot_min_stake: number
          bots_enabled: boolean
          deposits_enabled: boolean
          global_rtp: number
          id: boolean
          maintenance_message: string
          maintenance_mode: boolean
          matches_enabled: boolean
          max_stake: number
          min_stake: number
          signups_enabled: boolean
          updated_at: string
          updated_by: string | null
          withdrawals_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "app_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_cue_skins: {
        Args: never
        Returns: {
          active: boolean
          color: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          lore: string | null
          name: string
          payout_multiplier: number
          price: number
          rarity: Database["public"]["Enums"]["cue_rarity"]
          slug: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cue_skins"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_partners: {
        Args: never
        Returns: {
          active: boolean
          api_key: string
          api_secret: string
          balance: number
          callback_url: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "api_partners"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_users: {
        Args: { _limit?: number; _offset?: number; _search?: string }
        Returns: {
          balance: number
          created_at: string
          email: string
          id: string
          is_admin: boolean
          last_sign_in: string
          level: number
          username: string
          xp: number
        }[]
      }
      admin_partner_stats: { Args: { _id: string }; Returns: Json }
      admin_recent_api_calls: {
        Args: { _limit?: number; _partner?: string }
        Returns: {
          created_at: string
          endpoint: string
          id: string
          ip: string | null
          method: string
          partner_id: string | null
          payload: Json | null
          response: Json | null
          status_code: number
        }[]
        SetofOptions: {
          from: "*"
          to: "api_calls"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_recent_referral_earnings: {
        Args: { _limit?: number }
        Returns: {
          commission: number
          created_at: string
          deposit_amount: number
          id: string
          referred: string
          referrer: string
        }[]
      }
      admin_rotate_partner_secret: {
        Args: { _id: string }
        Returns: {
          active: boolean
          api_key: string
          api_secret: string
          balance: number
          callback_url: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "api_partners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_banned: {
        Args: { _banned: boolean; _reason?: string; _user: string }
        Returns: boolean
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: boolean
      }
      admin_set_user_progress: {
        Args: { _level: number; _user: string; _xp: number }
        Returns: {
          balance: number
          ban_reason: string | null
          banned: boolean
          created_at: string
          id: string
          last_login_date: string | null
          last_seen_at: string | null
          level: number
          login_streak: number
          referral_code: string
          referred_by: string | null
          updated_at: string
          username: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_stats: { Args: never; Returns: Json }
      admin_top_affiliates: {
        Args: { _limit?: number }
        Returns: {
          email: string
          referred_count: number
          referrer_id: string
          total_commission: number
          total_volume: number
          username: string
        }[]
      }
      admin_update_partner: {
        Args: { _id: string; _patch: Json }
        Returns: {
          active: boolean
          api_key: string
          api_secret: string
          balance: number
          callback_url: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "api_partners"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_settings: {
        Args: { _patch: Json }
        Returns: {
          bot_creation_rate: number
          bot_max_stake: number
          bot_min_stake: number
          bots_enabled: boolean
          deposits_enabled: boolean
          global_rtp: number
          id: boolean
          maintenance_message: string
          maintenance_mode: boolean
          matches_enabled: boolean
          max_stake: number
          min_stake: number
          signups_enabled: boolean
          updated_at: string
          updated_by: string | null
          withdrawals_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "app_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_upsert_cue_skin: {
        Args: { _id: string; _patch: Json }
        Returns: {
          active: boolean
          color: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          lore: string | null
          name: string
          payout_multiplier: number
          price: number
          rarity: Database["public"]["Enums"]["cue_rarity"]
          slug: string
        }
        SetofOptions: {
          from: "*"
          to: "cue_skins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_referral_code: {
        Args: { _code: string }
        Returns: {
          balance: number
          ban_reason: string | null
          banned: boolean
          created_at: string
          id: string
          last_login_date: string | null
          last_seen_at: string | null
          level: number
          login_streak: number
          referral_code: string
          referred_by: string | null
          updated_at: string
          username: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      claim_daily_bonus: {
        Args: never
        Returns: {
          already_claimed: boolean
          balance: number
          reward: number
          streak: number
        }[]
      }
      claim_mission: {
        Args: { _mission_id: string }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_pix_deposit: {
        Args: { _gateway_id: string; _identifier: string; _status: string }
        Returns: Json
      }
      cue_skin_stats: {
        Args: never
        Returns: {
          skin_id: string
          total_profit: number
          total_wins: number
        }[]
      }
      current_active_match: {
        Args: never
        Returns: {
          created_at: string
          id: string
          payout: number
          payout_multiplier: number
          rtp_outcome: boolean | null
          server_seed: string | null
          settled_at: string | null
          skin_id: string | null
          stake: number
          started_at: string
          status: Database["public"]["Enums"]["match_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_daily_missions: {
        Args: never
        Returns: {
          claimed: boolean
          created_at: string
          day: string
          id: string
          kind: string
          progress: number
          reward: number
          target: number
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "user_daily_missions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      equip_cue: {
        Args: { _skin_id: string }
        Returns: {
          acquired_at: string
          equipped: boolean
          id: string
          skin_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_cues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      friend_request: {
        Args: { _username: string }
        Returns: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "friendships"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      guard_user_not_banned: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      live_pvp_matches: {
        Args: { _limit?: number }
        Returns: {
          guest_id: string
          guest_level: number
          guest_name: string
          host_id: string
          host_level: number
          host_name: string
          id: string
          pot: number
          shot_num: number
          stake: number
          turn_user_id: string
          updated_at: string
        }[]
      }
      match_settle: {
        Args: { _forfeit?: boolean; _match_id: string; _won: boolean }
        Returns: {
          created_at: string
          id: string
          payout: number
          payout_multiplier: number
          rtp_outcome: boolean | null
          server_seed: string | null
          settled_at: string | null
          skin_id: string | null
          stake: number
          started_at: string
          status: Database["public"]["Enums"]["match_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      match_start: {
        Args: { _stake: number }
        Returns: {
          created_at: string
          id: string
          payout: number
          payout_multiplier: number
          rtp_outcome: boolean | null
          server_seed: string | null
          settled_at: string | null
          skin_id: string | null
          stake: number
          started_at: string
          status: Database["public"]["Enums"]["match_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      online_players: {
        Args: { _limit?: number }
        Returns: {
          id: string
          last_seen_at: string
          level: number
          username: string
        }[]
      }
      purchase_cue: {
        Args: { _skin_id: string }
        Returns: {
          acquired_at: string
          equipped: boolean
          id: string
          skin_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_cues"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_accept_invite: {
        Args: { _match_id: string }
        Returns: {
          created_at: string
          fee_pct: number
          guest_id: string
          guest_seen_at: string
          host_id: string
          host_seen_at: string
          id: string
          last_state: Json | null
          loser_id: string | null
          pot: number
          settled_at: string | null
          shot_num: number
          stake: number
          status: Database["public"]["Enums"]["pvp_status"]
          turn_started_at: string | null
          turn_user_id: string | null
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_claim_walkover: {
        Args: { _match_id: string }
        Returns: {
          created_at: string
          fee_pct: number
          guest_id: string
          guest_seen_at: string
          host_id: string
          host_seen_at: string
          id: string
          last_state: Json | null
          loser_id: string | null
          pot: number
          settled_at: string | null
          shot_num: number
          stake: number
          status: Database["public"]["Enums"]["pvp_status"]
          turn_started_at: string | null
          turn_user_id: string | null
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_create_invite: {
        Args: { _guest_id: string; _stake: number }
        Returns: {
          created_at: string
          fee_pct: number
          guest_id: string
          guest_seen_at: string
          host_id: string
          host_seen_at: string
          id: string
          last_state: Json | null
          loser_id: string | null
          pot: number
          settled_at: string | null
          shot_num: number
          stake: number
          status: Database["public"]["Enums"]["pvp_status"]
          turn_started_at: string | null
          turn_user_id: string | null
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_current_active: {
        Args: never
        Returns: {
          created_at: string
          fee_pct: number
          guest_id: string
          guest_seen_at: string
          host_id: string
          host_seen_at: string
          id: string
          last_state: Json | null
          loser_id: string | null
          pot: number
          settled_at: string | null
          shot_num: number
          stake: number
          status: Database["public"]["Enums"]["pvp_status"]
          turn_started_at: string | null
          turn_user_id: string | null
          updated_at: string
          winner_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "pvp_matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      pvp_decline_invite: {
        Args: { _match_id: string }
        Returns: {
          created_at: string
          fee_pct: number
          guest_id: string
          guest_seen_at: string
          host_id: string
          host_seen_at: string
          id: string
          last_state: Json | null
          loser_id: string | null
          pot: number
          settled_at: string | null
          shot_num: number
          stake: number
          status: Database["public"]["Enums"]["pvp_status"]
          turn_started_at: string | null
          turn_user_id: string | null
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_heartbeat: { Args: { _match_id: string }; Returns: undefined }
      pvp_settle: {
        Args: { _match_id: string; _winner_id: string }
        Returns: {
          created_at: string
          fee_pct: number
          guest_id: string
          guest_seen_at: string
          host_id: string
          host_seen_at: string
          id: string
          last_state: Json | null
          loser_id: string | null
          pot: number
          settled_at: string | null
          shot_num: number
          stake: number
          status: Database["public"]["Enums"]["pvp_status"]
          turn_started_at: string | null
          turn_user_id: string | null
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pvp_submit_turn: {
        Args: { _match_id: string; _next_user: string; _state: Json }
        Returns: {
          created_at: string
          fee_pct: number
          guest_id: string
          guest_seen_at: string
          host_id: string
          host_seen_at: string
          id: string
          last_state: Json | null
          loser_id: string | null
          pot: number
          settled_at: string | null
          shot_num: number
          stake: number
          status: Database["public"]["Enums"]["pvp_status"]
          turn_started_at: string | null
          turn_user_id: string | null
          updated_at: string
          winner_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "pvp_matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      touch_last_seen: { Args: never; Returns: undefined }
      wallet_apply: {
        Args: {
          _amount: number
          _description?: string
          _type: Database["public"]["Enums"]["tx_type"]
        }
        Returns: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      weekly_leaderboard: {
        Args: never
        Returns: {
          level: number
          profit: number
          user_id: string
          username: string
          wins: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      cue_rarity: "common" | "rare" | "epic" | "legendary"
      match_status: "active" | "won" | "lost" | "forfeit"
      pvp_status: "pending" | "active" | "finished" | "cancelled" | "expired"
      tx_type: "deposit" | "withdraw" | "bet" | "win" | "refund"
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
      app_role: ["admin", "user"],
      cue_rarity: ["common", "rare", "epic", "legendary"],
      match_status: ["active", "won", "lost", "forfeit"],
      pvp_status: ["pending", "active", "finished", "cancelled", "expired"],
      tx_type: ["deposit", "withdraw", "bet", "win", "refund"],
    },
  },
} as const
