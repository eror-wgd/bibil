import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  Settings as SettingsIcon, 
  Terminal, 
  LogOut, 
  ShieldCheck, 
  Lock, 
  Cloud, 
  Sun, 
  Moon, 
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronRight,
  User as UserIcon,
  HardDrive
} from "lucide-react";

import { User, Log, DashboardSummary, StatisticsData, PlatformSettings } from "./types";
import DashboardTab from "./components/DashboardTab";
import UsersTab from "./components/UsersTab";
import LogsTab from "./components/LogsTab";
import StatsTab from "./components/StatsTab";
import SettingsTab from "./components/SettingsTab";
import DeployTab from "./components/DeployTab";

// Hardcoded copy strings for Deploy Tab
const WRANGLER_CODE = `# Wrangler configuration for Cloudflare DoH Platform
name = "cloudflare-doh-platform"
main = "worker.js"
compatibility_date = "2026-06-28"

[vars]
JWT_SECRET = "CHANGE_ME_IN_PRODUCTION_JWT_SECRET_KEY"
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "doh-dns-db"
database_id = "your-d1-database-uuid"

[[kv_namespaces]]
binding = "CACHE_KV"
id = "your-kv-namespace-uuid"

# Cloudflare Workers Assets Configuration (Serves the compiled React App)
[assets]
directory = "./dist"`;

const SCHEMA_CODE = `-- Cloudflare D1 Database Schema for Cloudflare DoH Platform
-- Tables: users, logs, statistics, settings, sessions

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  api_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'enabled',
  created_at INTEGER NOT NULL,
  expire_at INTEGER,
  traffic_limit_gb REAL NOT NULL DEFAULT 50.0,
  traffic_used REAL NOT NULL DEFAULT 0.0,
  request_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time INTEGER NOT NULL,
  username TEXT NOT NULL,
  client_ip TEXT NOT NULL,
  domain TEXT NOT NULL,
  query_type TEXT NOT NULL,
  response_code TEXT NOT NULL,
  latency INTEGER NOT NULL,
  request_size INTEGER NOT NULL,
  response_size INTEGER NOT NULL,
  country TEXT NOT NULL,
  asn TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statistics (
  id TEXT PRIMARY KEY,
  date_str TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL DEFAULT 0.0,
  username TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expire_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_api_token ON users(api_token);
CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(time DESC);
CREATE INDEX IF NOT EXISTS idx_logs_username ON logs(username);
CREATE INDEX IF NOT EXISTS idx_logs_domain ON logs(domain);
CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(date_str);

INSERT OR IGNORE INTO settings (key, value) VALUES ('default_dns_provider', 'cloudflare');
INSERT OR IGNORE INTO settings (key, value) VALUES ('rate_limit_per_minute', '300');
INSERT OR IGNORE INTO settings (key, value) VALUES ('cache_ttl_seconds', '60');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_dns_packet_size', '512');
INSERT OR IGNORE INTO settings (key, value) VALUES ('maintenance_mode', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_title', 'DoH Private DNS Manager');
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_password_hash', 'e8febc11c472c6cfb45789fbfcf378dfb9f074d0a3dcf194ef408a2862d64024'); -- 'admin123'`;

const README_CODE = `# Cloudflare Workers DNS over HTTPS (DoH) Platform

A production-ready Private DNS over HTTPS server running entirely inside Cloudflare Workers.

## Deployment

1. Create D1 database:
   \`wrangler d1 create doh-dns-db\`
2. Set wrangler.toml credentials.
3. Push Database migrations:
   \`wrangler d1 execute doh-dns-db --file=./schema.sql --remote\`
4. Create KV cache:
   \`wrangler kv:namespace create CACHE_KV\`
5. Build the React admin panel:
   \`npm run build\`
6. Push Worker code and static assets:
   \`wrangler deploy\``;

// We will fetch worker.js at runtime or just embed a clean description
const WORKER_CODE = `// Cloudflare Workers DNS over HTTPS (DoH) Server Script
// Refer to root worker.js for the complete 700+ line implementation containing:
// - RFC 8484 GET/POST DNS Wire Parsers
// - Multi-Upstream proxy resolvers
// - Token authorization headers
// - Dynamic D1/KV Traffic usage accountant
// - Expiration timers & Maintenance modules
// - API Controller endpoints`;

export default function App() {
  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem("admin_token"));
  const [username, setUsername] = useState<string>("admin");
  const [password, setPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "logs" | "stats" | "settings" | "deploy">("dashboard");

  // Domain Data State
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary>({
    total_users: 0,
    active_users: 0,
    disabled_users: 0,
    online_users: 0,
    today_requests: 0,
    today_bytes: 0,
    total_traffic_gb: 0,
  });
  
  const [statistics, setStatistics] = useState<StatisticsData>({
    top_domains: [],
    top_users: [],
    traffic_history: [],
    countries: [],
    query_types: []
  });

  const [settings, setSettings] = useState<PlatformSettings>({
    default_dns_provider: "cloudflare",
    rate_limit_per_minute: "300",
    cache_ttl_seconds: "60",
    max_dns_packet_size: "512",
    maintenance_mode: "false",
    site_title: "DoH Private DNS Manager",
  });

  // Logs stream query filters
  const [logsFilters, setLogsFilters] = useState({ search: "", username: "", country: "", type: "" });
  const [liveStreamActive, setLiveStreamActive] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // UTC clock state
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync state if logged in
  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  // Live stream interval polling
  useEffect(() => {
    let pollInterval: any;
    if (token && liveStreamActive && activeTab === "logs") {
      pollInterval = setInterval(() => {
        fetchLogs(true);
      }, 3000);
    }
    return () => clearInterval(pollInterval);
  }, [token, liveStreamActive, activeTab, logsFilters]);

  // Sync dashboard background logs
  useEffect(() => {
    let dashPoll: any;
    if (token && activeTab === "dashboard") {
      dashPoll = setInterval(() => {
        // Silently pull updates for ticker
        fetchDashboardSummary();
        fetchLogs(true);
      }, 4000);
    }
    return () => clearInterval(dashPoll);
  }, [token, activeTab]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchDashboardSummary(),
        fetchUsers(),
        fetchLogs(false),
        fetchStatistics(),
        fetchSettings()
      ]);
    } catch (e) {
      console.error("Sync data failure:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDashboardSummary = async () => {
    const res = await apiFetch("/api/dashboard-summary");
    if (res) setDashboardSummary(res);
  };

  const fetchUsers = async () => {
    const res = await apiFetch("/api/users");
    if (res) setUsers(res);
  };

  const fetchLogs = async (silent = false) => {
    const queryParams = new URLSearchParams({
      search: logsFilters.search,
      username: logsFilters.username,
      country: logsFilters.country,
      type: logsFilters.type,
      limit: "100"
    }).toString();

    if (!silent) setIsLoading(true);
    const res = await apiFetch(`/api/logs?${queryParams}`);
    if (res) setLogs(res);
    if (!silent) setIsLoading(false);
  };

  const fetchStatistics = async () => {
    const res = await apiFetch("/api/statistics");
    if (res) setStatistics(res);
  };

  const fetchSettings = async () => {
    const res = await apiFetch("/api/settings");
    if (res) setSettings(res);
  };

  // REST Authentication Call
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (response.ok && data.token) {
        localStorage.setItem("admin_token", data.token);
        setToken(data.token);
      } else {
        setAuthError(data.error || "Login credentials rejected.");
      }
    } catch (err) {
      setAuthError("Failed to communicate with authentication server.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setToken(null);
    setPassword("");
  };

  // Helper for Authenticated API requests
  const apiFetch = async (route: string, options: RequestInit = {}) => {
    if (!token) return null;
    
    const headers = {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    try {
      const response = await fetch(route, { ...options, headers });
      if (response.status === 401) {
        handleLogout();
        return null;
      }
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "API failure");
      }
      return await response.json();
    } catch (e: any) {
      console.error(`API Fetch failed (${route}):`, e.message);
      return null;
    }
  };

  // User Actions handlers
  const handleCreateUser = async (u: string, email: string, limit: number, exp: string | null, n: string) => {
    const body = { username: u, email, traffic_limit_gb: limit, expire_at: exp, notes: n };
    const res = await apiFetch("/api/users", {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (res && res.success) {
      await fetchUsers();
      await fetchDashboardSummary();
    }
  };

  const handleUpdateUser = async (userId: string, data: Partial<User>) => {
    const res = await apiFetch(`/api/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
    if (res && res.success) {
      await fetchUsers();
      await fetchDashboardSummary();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const res = await apiFetch(`/api/users/${userId}`, {
      method: "DELETE"
    });
    if (res && res.success) {
      await fetchUsers();
      await fetchDashboardSummary();
    }
  };

  const handleSaveSettings = async (data: Partial<PlatformSettings> & { admin_password?: string }) => {
    const res = await apiFetch("/api/settings", {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (res && res.success) {
      await fetchSettings();
    }
  };

  // Get unique usernames, countries, query types for logs filters
  const uniqueUsernames: string[] = users.map(u => u.username).filter((v, i, a) => a.indexOf(v) === i);
  const uniqueCountries = ["US", "DE", "JP", "BR", "CA", "GB", "NL", "SG", "FR"];
  const uniqueTypes = ["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "CAA", "HTTPS"];

  if (!token) {
    // Elegant, highly secure Dark Login Screen
    return (
      <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col justify-between items-center relative overflow-hidden selection:bg-indigo-500 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black" id="login-screen">
        {/* Abstract vector backgrounds */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

        <div className="m-auto w-full max-w-md p-6">
          <div className="text-center mb-8">
            <div className="inline-flex p-3.5 bg-white/5 border border-white/10 rounded-3xl text-indigo-400 mb-4 shadow-xl">
              <Cloud className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white">DoH Private DNS Manager</h2>
            <p className="text-xs text-slate-400 mt-1.5 font-sans">Enter credentials to authenticate into the server controller</p>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-2xl relative z-10">
            {authError && (
              <div className="mb-4 bg-rose-950/50 border border-rose-900 text-rose-400 p-3 rounded-lg text-xs font-semibold">
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Administrator Username</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    placeholder="admin"
                  />
                  <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    placeholder="••••••••"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-500 transition shadow-lg active:scale-[0.98]"
                >
                  {isLoggingIn ? "Authenticating Session..." : "Secure Login"}
                </button>
              </div>
            </form>

            <div className="mt-5 pt-4 border-t border-white/5 text-center">
              <span className="text-[10px] text-slate-500 font-mono">
                Hint: default password is <span className="text-slate-400 font-bold">admin123</span>
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <footer className="pb-6 text-center text-[10px] text-slate-600 font-mono">
          Cloudflare Workers DNS over HTTPS Server Control Center
        </footer>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col selection:bg-indigo-500 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black" id="admin-panel-container">
      {/* Maintenance Mode Alert banner */}
      {settings.maintenance_mode === "true" && (
        <div className="bg-rose-950 border-b border-rose-900 text-rose-300 py-2 px-4 text-xs text-center font-semibold flex items-center justify-center space-x-2 relative z-50 animate-bounce">
          <span>⚠️ Maintenance mode active. Public DoH lookup endpoints will block requests.</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-64 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col justify-between hidden lg:flex shrink-0">
          <div className="flex-1 flex flex-col">
            {/* Sidebar Logo Header */}
            <div className="px-6 py-5 border-b border-white/10 flex items-center space-x-3">
              <div className="p-2 bg-indigo-600 rounded-xl text-white">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm tracking-tight truncate max-w-[140px] text-white">
                  {settings.site_title || "DoH Private DNS"}
                </h3>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center space-x-1">
                  <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping mr-1"></span>
                  <span>Server Connected</span>
                </span>
              </div>
            </div>

            {/* Menu Items */}
            <nav className="p-4 space-y-1 flex-1">
              {[
                { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
                { id: "users", label: "Client Users", icon: Users },
                { id: "logs", label: "DNS query logs", icon: FileText },
                { id: "stats", label: "Query Statistics", icon: BarChart3 },
                { id: "settings", label: "System settings", icon: SettingsIcon },
                { id: "deploy", label: "Deploy to cloud", icon: Terminal }
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition duration-200 group ${
                      activeTab === item.id
                        ? "bg-white/10 text-white border-white/10 shadow-sm"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 ${activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity ${activeTab === item.id ? "text-white opacity-100" : "text-slate-500"}`} />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer Account info */}
          <div className="p-4 border-t border-white/10 bg-white/2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 truncate">
                <div className="w-7 h-7 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-[10px] text-indigo-400 font-bold font-mono">
                  AD
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-200 leading-none">Admin Controller</p>
                  <span className="text-[9px] text-slate-500 font-mono">ID: {username}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-white/5 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-semibold border border-white/10 hover:border-rose-900/40 transition duration-300"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* MAIN BODY WRAPPER */}
        <div className="flex-grow flex flex-col overflow-hidden bg-transparent">
          
          {/* HEADER NAV */}
          <header className="h-16 border-b border-white/10 bg-white/5 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
            {/* Left Header info */}
            <div className="flex items-center space-x-4">
              <div className="lg:hidden flex items-center space-x-2">
                <Cloud className="w-6 h-6 text-indigo-500" />
                <span className="font-extrabold text-sm text-white">DoH Private DNS</span>
              </div>
              <div className="hidden lg:flex items-center space-x-2 font-mono text-[10px] text-slate-400 bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>UTC Time: {currentTime.toISOString().replace("T", " ").substring(0, 19)}</span>
              </div>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={fetchDashboardData}
                disabled={isLoading}
                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white rounded-xl transition"
                title="Synchronize Database"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              
              <div className="flex items-center space-x-1.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 px-2.5 py-1 rounded-xl text-[10px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edge Gateway Secured</span>
              </div>
            </div>
          </header>

          {/* MOBILE NAV (Small screens only) */}
          <div className="lg:hidden flex border-b border-white/10 bg-white/5 overflow-x-auto py-1.5 px-4 space-x-1 scrollbar-none shrink-0">
            {[
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "users", label: "Clients", icon: Users },
              { id: "logs", label: "Logs", icon: FileText },
              { id: "stats", label: "Stats", icon: BarChart3 },
              { id: "settings", label: "Settings", icon: SettingsIcon },
              { id: "deploy", label: "Deploy", icon: Terminal }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition duration-150 ${
                    activeTab === item.id
                      ? "bg-white/10 text-white border-white/10"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border-transparent"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* CONTENT WORKSPACE VIEW CONTAINER */}
          <main className="flex-1 overflow-y-auto p-6 relative">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Tab render delegation */}
              {activeTab === "dashboard" && (
                <DashboardTab
                  summary={dashboardSummary}
                  stats={statistics}
                  recentLogs={logs}
                  onRefresh={fetchDashboardData}
                  isLoading={isLoading}
                />
              )}

              {activeTab === "users" && (
                <UsersTab
                  users={users}
                  onCreateUser={handleCreateUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                />
              )}

              {activeTab === "logs" && (
                <LogsTab
                  logs={logs}
                  usernames={uniqueUsernames}
                  countries={uniqueCountries}
                  queryTypes={uniqueTypes}
                  onRefresh={() => fetchLogs(false)}
                  isLoading={isLoading}
                  liveStreamActive={liveStreamActive}
                  onToggleLiveStream={() => setLiveStreamActive(!liveStreamActive)}
                  onFilterChange={(f) => {
                    setLogsFilters(f);
                  }}
                />
              )}

              {activeTab === "stats" && (
                <StatsTab
                  stats={statistics}
                  onRefresh={fetchStatistics}
                  isLoading={isLoading}
                />
              )}

              {activeTab === "settings" && (
                <SettingsTab
                  settings={settings}
                  onSaveSettings={handleSaveSettings}
                />
              )}

              {activeTab === "deploy" && (
                <DeployTab
                  workerCode={WORKER_CODE}
                  wranglerCode={WRANGLER_CODE}
                  schemaCode={SCHEMA_CODE}
                  readmeCode={README_CODE}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
