export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// The installed database client version requires every table entry to
// include a Relationships array (see GenericTable in
// node_modules/@supabase/postgrest-js/src/types/common/common.ts). Without
// it, structural typing silently degrades every table lookup to `never`,
// which previously made `next build` fail outright (TS2698/TS2339/TS2353 in
// src/lib/challenges.ts) since nothing here uses embedded-select
// syntax (e.g. `.select('*, challenge:challenges(*)')`), an empty array is
// correct — it just means "no embedded relations are typed for this table".
type NoRelationships = { Relationships: [] }

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      } & NoRelationships
      challenges: {
        Row: {
          id: string
          name: string
          difficulty: string
          duration: number
          price: number
          description: string
          rules: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          difficulty: string
          duration: number
          price: number
          description: string
          rules: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          difficulty?: string
          duration?: number
          price?: number
          description?: string
          rules?: string
          created_at?: string
        }
      } & NoRelationships
      user_challenges: {
        Row: {
          id: string
          user_id: string
          challenge_id: string
          purchase_date: string
          status: string
          account_id: string | null
          terminal_username: string | null
          terminal_password_hash: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          challenge_id: string
          purchase_date?: string
          status: string
          account_id?: string | null
          terminal_username?: string | null
          terminal_password_hash?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          challenge_id?: string
          purchase_date?: string
          status?: string
          account_id?: string | null
          terminal_username?: string | null
          terminal_password_hash?: string | null
          created_at?: string
        }
      } & NoRelationships
      prop_account_states: {
        Row: {
          user_id: string
          account_id: string
          challenge_id: string | null
          balance: number
          equity: number
          starting_balance: number
          drawdown_hwm: number
          profit_target_pct: number
          max_drawdown_pct: number
          drawdown_mode: string
          stage: string
          status: string
          day_count: number
          open_positions: Json
          trade_history: Json
          extra: Json
          updated_at: string
        }
        Insert: {
          user_id: string
          account_id: string
          challenge_id?: string | null
          balance?: number
          equity?: number
          starting_balance?: number
          drawdown_hwm?: number
          profit_target_pct?: number
          max_drawdown_pct?: number
          drawdown_mode?: string
          stage?: string
          status?: string
          day_count?: number
          open_positions?: Json
          trade_history?: Json
          extra?: Json
          updated_at?: string
        }
        Update: {
          user_id?: string
          account_id?: string
          challenge_id?: string | null
          balance?: number
          equity?: number
          starting_balance?: number
          drawdown_hwm?: number
          profit_target_pct?: number
          max_drawdown_pct?: number
          drawdown_mode?: string
          stage?: string
          status?: string
          day_count?: number
          open_positions?: Json
          trade_history?: Json
          extra?: Json
          updated_at?: string
        }
      } & NoRelationships
      affiliates: {
        Row: {
          id: string
          user_id: string | null
          ref_code: string
          commission_pct: number
          payout_email: string
          status: string
          total_earned: number
          total_paid_out: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          ref_code: string
          commission_pct?: number
          payout_email: string
          status?: string
          total_earned?: number
          total_paid_out?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          ref_code?: string
          commission_pct?: number
          payout_email?: string
          status?: string
          total_earned?: number
          total_paid_out?: number
          created_at?: string
        }
      } & NoRelationships
      referrals: {
        Row: {
          id: string
          affiliate_id: string
          referred_user_id: string
          challenge_id: string
          user_challenge_id: string | null
          sale_amount: number
          commission_amt: number
          status: string
          converted_at: string
          paid_at: string | null
        }
        Insert: {
          id?: string
          affiliate_id: string
          referred_user_id: string
          challenge_id: string
          user_challenge_id?: string | null
          sale_amount?: number
          commission_amt?: number
          status?: string
          converted_at?: string
          paid_at?: string | null
        }
        Update: {
          id?: string
          affiliate_id?: string
          referred_user_id?: string
          challenge_id?: string
          user_challenge_id?: string | null
          sale_amount?: number
          commission_amt?: number
          status?: string
          converted_at?: string
          paid_at?: string | null
        }
      } & NoRelationships
      affiliate_clicks: {
        Row: {
          id: number
          ref_code: string
          ip_hash: string | null
          clicked_at: string
        }
        Insert: {
          id?: number
          ref_code: string
          ip_hash?: string | null
          clicked_at?: string
        }
        Update: {
          id?: number
          ref_code?: string
          ip_hash?: string | null
          clicked_at?: string
        }
      } & NoRelationships
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
