-- Cloudflare D1 Database Schema for Cloudflare DoH Platform
-- Tables: users, logs, statistics, settings, sessions

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  api_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'enabled', -- 'enabled', 'disabled'
  created_at INTEGER NOT NULL, -- Unix timestamp in ms
  expire_at INTEGER, -- Unix timestamp in ms or NULL
  traffic_limit_gb REAL NOT NULL DEFAULT 50.0,
  traffic_used REAL NOT NULL DEFAULT 0.0, -- In GB
  request_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT ''
);

-- DNS Logs Table
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time INTEGER NOT NULL, -- Unix timestamp in ms
  username TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  domain TEXT NOT NULL,
  query_type TEXT NOT NULL,
  response_code TEXT NOT NULL,
  latency INTEGER NOT NULL, -- In ms
  request_size INTEGER NOT NULL, -- In bytes
  response_size INTEGER NOT NULL, -- In bytes
  country TEXT NOT NULL,
  asn TEXT NOT NULL
);

-- Statistics Table (Accumulator for fast charts)
CREATE TABLE IF NOT EXISTS statistics (
  id TEXT PRIMARY KEY, -- format: 'YYYY-MM-DD:metric:username' or similar
  date_str TEXT NOT NULL, -- YYYY-MM-DD
  metric_name TEXT NOT NULL, -- 'requests', 'traffic_bytes'
  metric_value REAL NOT NULL DEFAULT 0.0,
  username TEXT NOT NULL
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Sessions Table (for Admin authentication)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expire_at INTEGER NOT NULL
);

-- Index creation for optimized searching and filtering
CREATE INDEX IF NOT EXISTS idx_users_api_token ON users(api_token);
CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(time DESC);
CREATE INDEX IF NOT EXISTS idx_logs_username ON logs(username);
CREATE INDEX IF NOT EXISTS idx_logs_domain ON logs(domain);
CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(date_str);

-- Insert initial default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_dns_provider', 'cloudflare');
INSERT OR IGNORE INTO settings (key, value) VALUES ('rate_limit_per_minute', '300');
INSERT OR IGNORE INTO settings (key, value) VALUES ('cache_ttl_seconds', '60');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_dns_packet_size', '512');
INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance_mode', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_title', 'DoH Private DNS Manager');
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password_hash', '$2b$10$EPfN0vVpU1o65x0E8204keU0gEqoKq0ZcK4V2XU0fN9N9B3vB4Z5y'); -- Default hash for password 'admin123'
INSERT OR IGNORE INTO settings (key, value) VALUES ('logo_url', '');
