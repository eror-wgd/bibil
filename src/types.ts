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
  request_limit?: number; // 0 or null for unlimited
  personal_dns_provider?: string; // id of custom/upstream provider
  ipv6_preference?: "default" | "prefer_ipv4" | "prefer_ipv6" | "ipv4_only" | "ipv6_only";
}

export interface DnsProvider {
  id: string;
  name: string;
  doh_url: string;
  ipv4: string;
  ipv6: string;
  country: string;
  description: string;
  enabled: boolean;
  priority: number;
  notes?: string;
  icon?: string;
  // Live health fields
  status?: "online" | "offline" | "unchecked";
  latency?: number;
  packetLoss?: number;
  successRate?: number;
  availability?: number;
  lastCheck?: number;
}

export interface BenchmarkHistory {
  id: string;
  time: number;
  results: {
    providerId: string;
    name: string;
    latency_avg: number;
    latency_min: number;
    latency_max: number;
    packet_loss: number;
    availability: number;
    success_rate: number;
    is_fastest: boolean;
  }[];
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
  dns_port?: string;
  doh_path?: string;
  dnssec?: string;
  http2?: string;
  http3?: string;
  tls13?: string;
  rate_limit?: string;
  edns_client_subnet?: string;
  ip_mode?: string;
}
