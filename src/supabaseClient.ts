import { createClient } from '@supabase/supabase-js'

// Environment variables - these should be set in your .env file
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Database types for better TypeScript support
export interface Database {
  public: {
    Tables: {
      user_profile: {
        Row: {
          user_id: string
          email: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email?: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      references: {
        Row: {
          file_id: string
          user_id: string
          document_type: 'reference'
          file_name: string
          file_size: number
          uploaded_at: string
        }
        Insert: {
          file_id: string
          user_id: string
          document_type: 'reference'
          file_name: string
          file_size: number
          uploaded_at?: string
        }
        Update: {
          file_id?: string
          user_id?: string
          document_type?: 'reference'
          file_name?: string
          file_size?: number
          uploaded_at?: string
        }
      }
      examples: {
        Row: {
          file_id: string
          user_id: string
          document_type: 'example'
          file_name: string
          file_size: number
          uploaded_at: string
        }
        Insert: {
          file_id: string
          user_id: string
          document_type: 'example'
          file_name: string
          file_size: number
          uploaded_at?: string
        }
        Update: {
          file_id?: string
          user_id?: string
          document_type?: 'example'
          file_name?: string
          file_size?: number
          uploaded_at?: string
        }
      }
      user_papers: {
        Row: {
          paper_id: string
          user_id: string
          title: string
          content: string
          sections: string[]
          paper_type: 'Empirical Study' | 'Literature Review' | 'Theoretical Paper' | 'Case Study'
          citation_style: 'APA' | 'MLA' | 'Chicago'
          output_format: 'word' | 'markdown'
          version: number
          created_at: string
          status: 'draft' | 'completed'
        }
        Insert: {
          paper_id: string
          user_id: string
          title: string
          content: string
          sections: string[]
          paper_type: 'Empirical Study' | 'Literature Review' | 'Theoretical Paper' | 'Case Study'
          citation_style: 'APA' | 'MLA' | 'Chicago'
          output_format: 'word' | 'markdown'
          version?: number
          created_at?: string
          status?: 'draft' | 'completed'
        }
        Update: {
          paper_id?: string
          user_id?: string
          title?: string
          content?: string
          sections?: string[]
          paper_type?: 'Empirical Study' | 'Literature Review' | 'Theoretical Paper' | 'Case Study'
          citation_style?: 'APA' | 'MLA' | 'Chicago'
          output_format?: 'word' | 'markdown'
          version?: number
          created_at?: string
          status?: 'draft' | 'completed'
        }
      }
      paper_references: {
        Row: {
          paper_id: string
          file_id: string
        }
        Insert: {
          paper_id: string
          file_id: string
        }
        Update: {
          paper_id?: string
          file_id?: string
        }
      }
    }
  }
}

// Typed Supabase client
export const typedSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
