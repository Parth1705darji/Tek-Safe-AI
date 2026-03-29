// Database types matching Supabase schema
// Using `type` aliases (not `interface`) so they satisfy Record<string, unknown>
// constraints in @supabase/postgrest-js generic types.

export type User = {
  id: string;
  clerk_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: 'free' | 'pro' | 'team' | 'premium';
  role: 'user' | 'admin';
  daily_message_count: number;
  daily_message_reset_at: string | null;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
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

// ── Infrastructure types ──────────────────────────────────────────────────────

export type InfrastructureAgent = {
  id: string;
  user_id: string;
  activation_code: string;
  agent_version: string | null;
  agent_hostname: string | null;
  agent_platform: string | null;
  last_heartbeat: string | null;
  status: 'pending' | 'active' | 'offline';
  scan_interval_min: number;
  created_at: string;
};

export type NetworkAsset = {
  id: string;
  agent_id: string;
  ip_address: string;
  mac_address: string | null;
  hostname: string | null;
  device_type:
    | 'firewall'
    | 'router'
    | 'switch'
    | 'server'
    | 'workstation'
    | 'database'
    | 'printer'
    | 'iot'
    | 'phone'
    | 'unknown';
  vendor: string | null;
  os_name: string | null;
  os_version: string | null;
  open_ports: number[];
  services: Record<string, unknown>[];
  security_score: number | null;
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  cve_count: number;
  is_new: boolean;
  is_internet_facing: boolean;
  first_seen: string;
  last_seen: string;
  created_at: string;
};

export type NetworkConnection = {
  id: string;
  agent_id: string;
  source_asset_id: string;
  target_asset_id: string;
  connection_type: 'layer2' | 'layer3' | 'inferred';
  created_at: string;
};

export type AssetVulnerability = {
  id: string;
  asset_id: string;
  cve_id: string;
  cvss_score: number | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string | null;
  affected_product: string | null;
  published_date: string | null;
  patch_available: boolean;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
};

export type InfrastructureScanEvent = {
  id: string;
  agent_id: string;
  asset_count: number;
  new_assets: number;
  disappeared_assets: number;
  cve_count: number;
  scan_duration_seconds: number | null;
  subnets_scanned: string[];
  scanned_at: string;
};

// Activation API response shapes
export type ActivationStatus =
  | { status: 'active'; activation_code: string; agent_hostname: string | null; last_heartbeat: string | null }
  | { status: 'pending'; activation_code: string }
  | { status: 'none' };

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
          tier?: 'free' | 'pro' | 'team' | 'premium';
          role?: 'user' | 'admin';
          daily_message_count?: number;
          daily_message_reset_at?: string | null;
          is_suspended?: boolean;
          suspended_at?: string | null;
          suspended_reason?: string | null;
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
      infrastructure_agents: {
        Row: InfrastructureAgent;
        Insert: {
          id?: string;
          user_id: string;
          activation_code: string;
          agent_version?: string | null;
          agent_hostname?: string | null;
          agent_platform?: string | null;
          last_heartbeat?: string | null;
          status?: 'pending' | 'active' | 'offline';
          scan_interval_min?: number;
          created_at?: string;
        };
        Update: Partial<InfrastructureAgent>;
        Relationships: [];
      };
      network_assets: {
        Row: NetworkAsset;
        Insert: {
          id?: string;
          agent_id: string;
          ip_address: string;
          mac_address?: string | null;
          hostname?: string | null;
          device_type?: NetworkAsset['device_type'];
          vendor?: string | null;
          os_name?: string | null;
          os_version?: string | null;
          open_ports?: number[];
          services?: Record<string, unknown>[];
          security_score?: number | null;
          risk_level?: NetworkAsset['risk_level'];
          cve_count?: number;
          is_new?: boolean;
          is_internet_facing?: boolean;
          first_seen?: string;
          last_seen?: string;
          created_at?: string;
        };
        Update: Partial<NetworkAsset>;
        Relationships: [];
      };
      network_connections: {
        Row: NetworkConnection;
        Insert: {
          id?: string;
          agent_id: string;
          source_asset_id: string;
          target_asset_id: string;
          connection_type?: NetworkConnection['connection_type'];
          created_at?: string;
        };
        Update: Partial<NetworkConnection>;
        Relationships: [];
      };
      asset_vulnerabilities: {
        Row: AssetVulnerability;
        Insert: {
          id?: string;
          asset_id: string;
          cve_id: string;
          cvss_score?: number | null;
          severity?: AssetVulnerability['severity'];
          description?: string | null;
          affected_product?: string | null;
          published_date?: string | null;
          patch_available?: boolean;
          resolved?: boolean;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<AssetVulnerability>;
        Relationships: [];
      };
      infrastructure_scan_events: {
        Row: InfrastructureScanEvent;
        Insert: {
          id?: string;
          agent_id: string;
          asset_count?: number;
          new_assets?: number;
          disappeared_assets?: number;
          cve_count?: number;
          scan_duration_seconds?: number | null;
          subnets_scanned?: string[];
          scanned_at?: string;
        };
        Update: Partial<InfrastructureScanEvent>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
