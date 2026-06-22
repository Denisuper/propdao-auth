export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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
      }
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
      }
      user_challenges: {
        Row: {
          id: string
          user_id: string
          challenge_id: string
          purchase_date: string
          status: string
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
          terminal_username?: string | null
          terminal_password_hash?: string | null
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
