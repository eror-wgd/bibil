// Shared interfaces and types for DNS over HTTPS Platform

export interface User {
  id: string;
  username: string;
  email: string;
  api_token: string;
  status: "enabled" | "disabled";
  created_at: number;
  expire_at: number | null;
  traffic_limit_gb: number;
  traffic_used: number; // in GB
  request_count: number;
  notes: string;
}

export interface Log {
  id: number;
  time: number;
  username: string;
  client_ip: string;
  domain: string;
  query_type: string;
  response_code: string;
  latency: number;
  request_size: number;
  response_size: number;
  country: string;
  asn: string;
}

export interface DashboardSummary {
  total_users: number;
  active_users: number;
  disabled_users: number;
  online_users: number;
  today_requests: number;
  today_bytes: number;
  total_traffic_gb: number;
}

export interface StatisticsData {
  top_domains: { domain: string; count: number }[];
  top_users: { username: string; count: number; bytes: number }[];
  traffic_history: { date_str: string; requests: number; bytes: number }[];
  countries: { country: string; count: number }[];
  query_types: { query_type: string; count: number }[];
}

export interface PlatformSettings {
  default_dns_provider: string;
  rate_limit_per_minute: string;
  cache_ttl_seconds: string;
  max_dns_packet_size: string;
  maintenance_mode: string;
  site_title: string;
  logo_url?: string;
}
