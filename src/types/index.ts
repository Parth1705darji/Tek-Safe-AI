// Database types matching Supabase schema
// Using `type` aliases (not `interface`) so they satisfy Record<string, unknown>
// constraints in @supabase/postgrest-js generic types.

export type User = {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: 'free' | 'premium';
  role: 'user' | 'admin';
  daily_message_count: number;
  daily_message_reset_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: KBSource[];
  tool_used: 'breach_check' | 'url_scan' | 'ip_check' | null;
  tool_result: Record<string, unknown> | null;
  diagnose_questions: string[] | null;
  diagnose_answered: boolean;
  feedback: 'up' | 'down' | null;
  feedback_text: string | null;
  created_at: string;
};

export type KBDocument = {
  id: string;
  title: string;
  category: 'tech_support' | 'cybersecurity';
  subcategory: string;
  content: string;
  source_url: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type KBEmbedding = {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  created_at: string;
};

export type AnalyticsEvent = {
  id: string;
  user_id: string | null;
  event_type:
    | 'message_sent'
    | 'tool_used'
    | 'feedback_given'
    | 'sign_up'
    | 'login'
    | 'conversation_created';
  event_data: Record<string, unknown>;
  created_at: string;
};

// Helper types

export type KBSource = {
  document_id: string;
  title: string;
  chunk_text: string;
  similarity: number;
};

export type BreachCheckResult = {
  email: string;
  breached: boolean;
  breach_count: number;
  breaches: Array<{
    name: string;
    domain: string;
    breach_date: string;
    data_classes: string[];
  }>;
  advice?: string;
};

export type UrlScanResult = {
  url: string;
  verdict: 'safe' | 'suspicious' | 'malicious';
  positives: number;
  total_scanners: number;
  details: Record<string, unknown>;
  advice?: string;
};

export type IpCheckResult = {
  ip: string;
  abuse_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  country: string;
  isp: string;
  usage_type?: string;
  domain?: string;
  is_tor?: boolean;
  total_reports: number;
  last_reported: string | null;
  categories?: string[];
  advice?: string;
};

// Supabase Database type (for typed client)
// Insert types mark server-generated fields (id, created_at, updated_at) as optional.
// Each table must include Relationships to satisfy GenericTable from @supabase/postgrest-js.

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: {
          id?: string;
          clerk_id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          tier?: 'free' | 'premium';
          role?: 'user' | 'admin';
          daily_message_count?: number;
          daily_message_reset_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<User>;
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Conversation>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: {
          id?: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          sources?: KBSource[];
          tool_used?: 'breach_check' | 'url_scan' | 'ip_check' | null;
          tool_result?: Record<string, unknown> | null;
          diagnose_questions?: string[] | null;
          diagnose_answered?: boolean;
          feedback?: 'up' | 'down' | null;
          feedback_text?: string | null;
          created_at?: string;
        };
        Update: Partial<Message>;
        Relationships: [];
      };
      kb_documents: {
        Row: KBDocument;
        Insert: {
          id?: string;
          title: string;
          category: 'tech_support' | 'cybersecurity';
          subcategory: string;
          content: string;
          source_url?: string | null;
          tags?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<KBDocument>;
        Relationships: [];
      };
      kb_embeddings: {
        Row: KBEmbedding;
        Insert: {
          id?: string;
          document_id: string;
          chunk_index: number;
          chunk_text: string;
          embedding?: number[];
          created_at?: string;
        };
        Update: Partial<KBEmbedding>;
        Relationships: [];
      };
      analytics_events: {
        Row: AnalyticsEvent;
        Insert: {
          id?: string;
          user_id?: string | null;
          event_type: AnalyticsEvent['event_type'];
          event_data?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<AnalyticsEvent>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
