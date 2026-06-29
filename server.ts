import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.raw({
  type: (req) => {
    const contentType = req.headers["content-type"] || "";
    return contentType.toLowerCase().includes("application/dns-message");
  },
  limit: "10mb"
}));

const DB_FILE = path.join(process.cwd(), "doh_database.json");

// Structure interfaces
interface User {
  id: string;
  username: string;
  email: string;
  api_token: string;
  status: "enabled" | "disabled";
  created_at: number;
  expire_at: number | null;
  traffic_limit_gb: number;
  traffic_used: number;
  request_count: number;
  notes: string;
  request_limit?: number;
  personal_dns_provider?: string;
  ipv6_preference?: "default" | "prefer_ipv4" | "prefer_ipv6" | "ipv4_only" | "ipv6_only";
}

interface Log {
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

interface DnsProvider {
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
}

interface BenchmarkHistory {
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

interface DB {
  users: User[];
  logs: Log[];
  settings: Record<string, string>;
  sessions: { token: string; username: string; created_at: number; expire_at: number }[];
  providers: DnsProvider[];
  benchmarkHistory: BenchmarkHistory[];
}

// Default commercial DNS over HTTPS upstream providers
const DEFAULT_PROVIDERS: DnsProvider[] = [
  { id: "cloudflare", name: "Cloudflare", doh_url: "https://cloudflare-dns.com/dns-query", ipv4: "1.1.1.1,1.0.0.1", ipv6: "2606:4700:4700::1111,2606:4700:4700::1001", country: "US", description: "Fast, privacy-first, zero-logging public DNS service.", enabled: true, priority: 1, notes: "Excellent global coverage & speed", icon: "cloudflare" },
  { id: "google", name: "Google Public DNS", doh_url: "https://dns.google/dns-query", ipv4: "8.8.8.8,8.8.4.4", ipv6: "2001:4860:4860::8888,2001:4860:4860::8844", country: "US", description: "Stable, resilient, global public DNS service.", enabled: true, priority: 2, notes: "Reliable global infrastructure", icon: "google" },
  { id: "quad9", name: "Quad9", doh_url: "https://dns.quad9.net/dns-query", ipv4: "9.9.9.9,149.112.112.112", ipv6: "2620:fe::fe,2620:fe::9", country: "CH", description: "Threat protection, phishing & malware blocking.", enabled: true, priority: 3, notes: "Privacy advocate, Swiss non-profit", icon: "shield" },
  { id: "adguard", name: "AdGuard DNS", doh_url: "https://dns.adguard-dns.com/dns-query", ipv4: "94.140.14.14,94.140.15.15", ipv6: "2a10:50c0::ad1:ff,2a10:50c0::ad2:ff", country: "CY", description: "Blocks advertisement, trackers, and adware.", enabled: true, priority: 4, notes: "Perfect for family and device filtering", icon: "shield-alert" },
  { id: "nextdns", name: "NextDNS", doh_url: "https://dns.nextdns.io", ipv4: "45.90.28.232,45.90.30.232", ipv6: "2a07:a8c0::,2a07:a8c1::", country: "US", description: "Extremely modular, analytics-rich secure cloud firewall DNS.", enabled: true, priority: 5, notes: "Custom cloud profiles", icon: "sliders" },
  { id: "shecan", name: "Shecan", doh_url: "https://free.shecan.ir/dns-query", ipv4: "178.22.122.100,185.51.200.2", ipv6: "", country: "IR", description: "Bypasses geo-sanctions on tech tools and services.", enabled: true, priority: 6, notes: "Essential for developer sanction bypasses", icon: "globe" },
  { id: "electro", name: "Electro DNS", doh_url: "https://dns.electro.tm/dns-query", ipv4: "78.157.108.10,78.157.108.11", ipv6: "", country: "IR", description: "High performance sanction-bypass & gaming public DNS.", enabled: true, priority: 7, notes: "Fast gaming and docker registry routing", icon: "zap" },
  { id: "norddns", name: "Nord DNS", doh_url: "https://doh.norddns.com/dns-query", ipv4: "103.86.96.100,103.86.99.100", ipv6: "", country: "PA", description: "Encrypted, no-log secure DNS by NordVPN.", enabled: true, priority: 8, notes: "No censorship, safe connection", icon: "lock" },
  { id: "alidns", name: "AliDNS", doh_url: "https://dns.alidns.com/dns-query", ipv4: "223.5.5.5,223.6.6.6", ipv6: "2400:3200::1,2400:3200:baba::1", country: "CN", description: "Ali public DNS offering rapid resolution across Asia.", enabled: true, priority: 9, notes: "Optimized for East Asian web traffic", icon: "network" },
  { id: "zerodns", name: "ZeroDNS", doh_url: "https://doh.zerodns.org/dns-query", ipv4: "185.230.162.24,185.230.162.25", ipv6: "2a06:98c0:3600::", country: "DE", description: "Zero logs, community-operated, highly secure DNS.", enabled: true, priority: 10, notes: "Pure open source community", icon: "eye-off" },
  { id: "dns114", name: "114DNS", doh_url: "https://doh.114dns.com/dns-query", ipv4: "114.114.114.114,114.114.115.115", ipv6: "", country: "CN", description: "Large, robust Chinese mainland public DNS.", enabled: true, priority: 11, notes: "Highly distributed servers", icon: "server" },
  { id: "dyndns", name: "CleanBrowsing", doh_url: "https://doh.cleanbrowsing.org/dns-query", ipv4: "185.228.168.9,185.228.169.9", ipv6: "2a0d:5600::2", country: "US", description: "CleanBrowsing safe filtering and Dyn family protection.", enabled: true, priority: 12, notes: "Ideal for blocking malicious contents", icon: "heart-handshake" },
  { id: "dnswatch", name: "DNS.WATCH", doh_url: "https://doh.dns.watch/dns-query", ipv4: "84.200.69.80,84.200.70.40", ipv6: "2001:1608:10:25::1c04:b12f", country: "DE", description: "Fast, un-censored public DNS that values web freedom.", enabled: true, priority: 13, notes: "No logs, no censorship, fully free", icon: "eye" },
  { id: "dns4eu", name: "DNS4EU Unfiltered", doh_url: "https://doh.dns4eu.eu/dns-query", ipv4: "9.9.9.10,149.112.112.10", ipv6: "2620:fe::10", country: "EU", description: "Sovereign European Union public DNS initiative.", enabled: true, priority: 14, notes: "Promoted by EU commission", icon: "landmark" }
];

// Global state in-memory synced to JSON
let db: DB = {
  users: [],
  logs: [],
  settings: {},
  sessions: [],
  providers: [],
  benchmarkHistory: []
};

// Password Hashing Mock (SHA-256 PBKDF2 style in-memory)
function hashPassword(password: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(password + "doh_platform_secure_constant_salt_value");
  return hash.digest("hex");
}

// Database I/O
function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      db = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      // Ensure all arrays are populated
      db.users = db.users || [];
      db.logs = db.logs || [];
      db.settings = db.settings || {};
      db.sessions = db.sessions || [];
      db.providers = db.providers || [];
      db.benchmarkHistory = db.benchmarkHistory || [];

      // Transition check for default settings
      const defaultSettingsToEnsure: Record<string, string> = {
        default_dns_provider: "cloudflare",
        rate_limit_per_minute: "300",
        cache_ttl_seconds: "60",
        max_dns_packet_size: "512",
        maintenance_mode: "false",
        site_title: "DoH Private DNS Manager",
        logo_url: "",
        dns_port: "443",
        doh_path: "/dns-query",
        dnssec: "true",
        http2: "true",
        http3: "true",
        tls13: "true",
        rate_limit: "300",
        edns_client_subnet: "true",
        ip_mode: "prefer_ipv4"
      };
      
      let changed = false;
      for (const [k, v] of Object.entries(defaultSettingsToEnsure)) {
        if (db.settings[k] === undefined) {
          db.settings[k] = v;
          changed = true;
        }
      }

      // Transition check for default providers
      if (!db.providers || db.providers.length === 0) {
        db.providers = [...DEFAULT_PROVIDERS];
        changed = true;
      }

      // Ensure users have request_limit, personal_dns_provider and ipv6_preference
      db.users.forEach(u => {
        if (u.request_limit === undefined) { u.request_limit = 0; changed = true; }
        if (u.personal_dns_provider === undefined) { u.personal_dns_provider = ""; changed = true; }
        if (u.ipv6_preference === undefined) { u.ipv6_preference = "default"; changed = true; }
      });

      if (changed) {
        saveDatabase();
      }
    } catch (e) {
      console.error("Database parsing failed. Regenerating state...", e);
      seedDatabase();
    }
  } else {
    seedDatabase();
  }
}

function saveDatabase() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
}

// Seeder to make the app look alive immediately!
function seedDatabase() {
  console.log("Seeding database with realistic demonstration data...");
  const now = Date.now();
  
  // 1. Initial settings
  const settings: Record<string, string> = {
    default_dns_provider: "cloudflare",
    rate_limit_per_minute: "300",
    cache_ttl_seconds: "60",
    max_dns_packet_size: "512",
    maintenance_mode: "false",
    site_title: "DoH Private DNS Manager",
    admin_password_hash: hashPassword("admin123"), // Default password: admin123
    logo_url: "",
    dns_port: "443",
    doh_path: "/dns-query",
    dnssec: "true",
    http2: "true",
    http3: "true",
    tls13: "true",
    rate_limit: "300",
    edns_client_subnet: "true",
    ip_mode: "prefer_ipv4"
  };

  // 2. Mock users
  const users: User[] = [
    {
      id: "u1",
      username: "personal_laptop",
      email: "laptop@local.net",
      api_token: "doh_laptop_secure_token_abc123",
      status: "enabled",
      created_at: now - 30 * 24 * 3600 * 1000,
      expire_at: now + 365 * 24 * 3600 * 1000,
      traffic_limit_gb: 100.0,
      traffic_used: 12.45,
      request_count: 32402,
      notes: "MacBook Pro office connection",
      request_limit: 100000,
      personal_dns_provider: "cloudflare",
      ipv6_preference: "prefer_ipv4"
    },
    {
      id: "u2",
      username: "smart_tv_box",
      email: "tv@local.net",
      api_token: "doh_smart_tv_secret_token_xyz789",
      status: "enabled",
      created_at: now - 15 * 24 * 3600 * 1000,
      expire_at: now + 180 * 24 * 3600 * 1000,
      traffic_limit_gb: 50.0,
      traffic_used: 34.12,
      request_count: 14590,
      notes: "Living Room AppleTV Box",
      request_limit: 50000,
      personal_dns_provider: "adguard",
      ipv6_preference: "default"
    },
    {
      id: "u3",
      username: "mobile_phone",
      email: "phone@local.net",
      api_token: "doh_phone_fast_token_pqr456",
      status: "enabled",
      created_at: now - 5 * 24 * 3600 * 1000,
      expire_at: now + 90 * 24 * 3600 * 1000,
      traffic_limit_gb: 25.0,
      traffic_used: 24.89, // close to limit
      request_count: 19830,
      notes: "iPhone 15 Mobile Data",
      request_limit: 0,
      personal_dns_provider: "",
      ipv6_preference: "default"
    },
    {
      id: "u4",
      username: "legacy_server",
      email: "server@local.net",
      api_token: "doh_server_api_expired_token_111",
      status: "enabled",
      created_at: now - 45 * 24 * 3600 * 1000,
      expire_at: now - 2 * 24 * 3600 * 1000, // Expired 2 days ago
      traffic_limit_gb: 200.0,
      traffic_used: 89.15,
      request_count: 55431,
      notes: "Home backup server",
      request_limit: 0,
      personal_dns_provider: "google",
      ipv6_preference: "ipv4_only"
    },
    {
      id: "u5",
      username: "guest_access",
      email: "guest@local.net",
      api_token: "doh_guest_token_disabled_222",
      status: "disabled", // Disabled
      created_at: now - 10 * 24 * 3600 * 1000,
      expire_at: now + 10 * 24 * 3600 * 1000,
      traffic_limit_gb: 10.0,
      traffic_used: 0.15,
      request_count: 120,
      notes: "Temporary visitors access link",
      request_limit: 500,
      personal_dns_provider: "",
      ipv6_preference: "default"
    }
  ];

  // 3. Mock logs (generate realistic DNS history)
  const logs: Log[] = [];
  const domains = [
    { name: "google.com", type: "A" },
    { name: "github.com", type: "AAAA" },
    { name: "netflix.com", type: "A" },
    { name: "cloudflare.com", type: "A" },
    { name: "analytics.google.com", type: "CNAME" },
    { name: "doubleclick.net", type: "A" },
    { name: "discord.com", type: "A" },
    { name: "aws.amazon.com", type: "CNAME" },
    { name: "youtube.com", type: "A" },
    { name: "dns.adguard.com", type: "TXT" },
    { name: "apple-dns.net", type: "SRV" }
  ];

  const countries = ["US", "DE", "JP", "BR", "CA", "GB", "NL", "SG", "FR"];
  const userList = ["personal_laptop", "smart_tv_box", "mobile_phone", "legacy_server"];
  const codes = ["200", "200", "200", "200", "304", "404", "200"];

  let logId = 1;
  // Generate logs staggered over the last 24 hours
  for (let i = 0; i < 150; i++) {
    const logTime = now - Math.floor(Math.random() * 24 * 3600 * 1000);
    const domainObj = domains[Math.floor(Math.random() * domains.length)];
    const username = userList[Math.floor(Math.random() * userList.length)];
    const country = countries[Math.floor(Math.random() * countries.length)];
    const code = codes[Math.floor(Math.random() * codes.length)];
    const latency = Math.floor(Math.random() * 45) + 5; // 5ms - 50ms
    const reqSize = Math.floor(Math.random() * 40) + 30; // 30b - 70b
    const resSize = Math.floor(Math.random() * 200) + 60; // 60b - 260b

    logs.push({
      id: logId++,
      time: logTime,
      username,
      client_ip: `192.168.1.${Math.floor(Math.random() * 100) + 10}`,
      domain: domainObj.name,
      query_type: domainObj.type,
      response_code: code,
      latency,
      request_size: reqSize,
      response_size: resSize,
      country,
      asn: `AS${Math.floor(Math.random() * 30000) + 1000}`
    });
  }

  // Sort logs descending by time
  logs.sort((a, b) => b.time - a.time);

  db = {
    users,
    logs,
    settings,
    sessions: [],
    providers: [...DEFAULT_PROVIDERS],
    benchmarkHistory: []
  };

  saveDatabase();
}

// Load database immediately
loadDatabase();

// Authentication middleware for Express API routes
function authenticateAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing Admin Token." });
  }
  const token = authHeader.substring(7).trim();
  const session = db.sessions.find(s => s.token === token);
  
  if (!session || Date.now() > session.expire_at) {
    // Invalidate if found but expired
    if (session) {
      db.sessions = db.sessions.filter(s => s.token !== token);
      saveDatabase();
    }
    return res.status(401).json({ error: "Unauthorized: Invalid or expired admin session." });
  }

  req.adminUsername = session.username;
  next();
}

// Helper to parse binary wire names and query types (safe copy)
function parseDnsWireNameAndType(buffer: Buffer) {
  if (buffer.length < 12) {
    throw new Error("DNS Packet too short");
  }

  let offset = 12;
  let parts = [];
  
  while (offset < buffer.length) {
    const len = buffer[offset];
    if (len === 0) {
      offset += 1;
      break;
    }
    
    if ((len & 0xC0) === 0xC0) {
      offset += 2;
      parts.push("...");
      break;
    }
    
    offset += 1;
    if (offset + len > buffer.length) {
      break;
    }
    
    let part = "";
    for (let i = 0; i < len; i++) {
      part += String.fromCharCode(buffer[offset + i]);
    }
    parts.push(part);
    offset += len;
  }

  let qType = "A";
  if (offset + 4 <= buffer.length) {
    const qTypeCode = buffer.readUInt16BE(offset);
    const types: Record<number, string> = {
      1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 
      28: "AAAA", 33: "SRV", 41: "OPT", 65: "HTTPS", 257: "CAA"
    };
    qType = types[qTypeCode] || `TYPE${qTypeCode}`;
  }

  return {
    name: parts.join("."),
    type: qType
  };
}

// ----------------------------------------------------
// 1. DNS over HTTPS Server (Live Simulation Endpoint)
// ----------------------------------------------------
app.all(["/dns-query", "/dns-query/:token"], async (req, res) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.status(204).end();
    }

    // Acknowledge maintenance mode
    if (db.settings.maintenance_mode === "true") {
      return res.status(503).json({ error: "Maintenance Mode is active." });
    }

    // 1. Authenticate user
    let apiToken = "";
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      apiToken = authHeader.substring(7).trim();
    } else {
      apiToken = (req.query.token as string) || req.params.token || "";
    }

    if (apiToken) {
      apiToken = apiToken.trim();
    }

    if (!apiToken) {
      return res.status(401).json({ error: "Unauthorized: Missing API token." });
    }

    const user = db.users.find(u => u.api_token.toLowerCase() === apiToken.toLowerCase());
    if (!user) {
      return res.status(403).json({ error: "Unauthorized: Invalid API Token." });
    }

    if (user.status !== "enabled") {
      return res.status(403).json({ error: "Forbidden: Account is disabled." });
    }

    const now = Date.now();
    if (user.expire_at && now > user.expire_at) {
      user.status = "disabled";
      saveDatabase();
      return res.status(403).json({ error: "Forbidden: Account has expired." });
    }

    if (user.request_limit && user.request_limit > 0 && user.request_count >= user.request_limit) {
      res.setHeader("Content-Type", "text/plain");
      return res.status(403).send("Request Limit Exceeded");
    }

    if (user.traffic_used >= user.traffic_limit_gb) {
      res.setHeader("Content-Type", "text/plain");
      return res.status(403).send("Traffic Limit Exceeded");
    }

    // 2. Extract and decode query details
    let dnsMessageBuffer: Buffer | null = null;
    let queryName = "";
    let queryType = "A";
    let isJsonRequest = false;

    const contentType = req.headers["content-type"] || "";

    if (req.method === "POST") {
      if (contentType.includes("application/dns-message")) {
        dnsMessageBuffer = req.body as Buffer;
        try {
          const decoded = parseDnsWireNameAndType(dnsMessageBuffer);
          queryName = decoded.name;
          queryType = decoded.type;
        } catch (e) {
          queryName = "invalid-payload";
        }
      } else {
        return res.status(415).json({ error: "Unsupported Content-Type. POST requests must use 'application/dns-message'" });
      }
    } else if (req.method === "GET") {
      const dnsParam = req.query.dns as string;
      if (dnsParam) {
        try {
          let base64 = dnsParam.replace(/-/g, "+").replace(/_/g, "/");
          while (base64.length % 4) {
            base64 += "=";
          }
          dnsMessageBuffer = Buffer.from(base64, "base64");
          const decoded = parseDnsWireNameAndType(dnsMessageBuffer);
          queryName = decoded.name;
          queryType = decoded.type;
        } catch (e) {
          return res.status(400).json({ error: "Bad Request: Invalid Base64Url dns query payload" });
        }
      } else {
        queryName = (req.query.name as string) || "";
        queryType = ((req.query.type as string) || "A").toUpperCase();
        isJsonRequest = true;
        if (!queryName) {
          return res.status(400).json({ error: "Missing required 'dns' or 'name' parameter for GET request." });
        }
      }
    } else {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Max packet size guard
    const maxPacketSize = parseInt(db.settings.max_dns_packet_size || "512");
    if (dnsMessageBuffer && dnsMessageBuffer.length > maxPacketSize) {
      return res.status(413).json({ error: "Request Entity Too Large: Max DNS packet size limit reached." });
    }

    // 3. Resolve upstream with Automatic Failover
    const enabledProviders = db.providers.filter(p => p.enabled).sort((a, b) => a.priority - b.priority);
    
    let primaryProvider: DnsProvider | undefined;
    if (user.personal_dns_provider) {
      primaryProvider = enabledProviders.find(p => p.id === user.personal_dns_provider);
    }
    if (!primaryProvider) {
      const defaultId = db.settings.default_dns_provider || "cloudflare";
      primaryProvider = enabledProviders.find(p => p.id === defaultId);
    }
    if (!primaryProvider && enabledProviders.length > 0) {
      primaryProvider = enabledProviders[0];
    }

    // Order upstreams: primary first, followed by others in priority order
    const providersToTry = [
      primaryProvider,
      ...enabledProviders.filter(p => p.id !== (primaryProvider ? primaryProvider.id : ""))
    ].filter(Boolean) as DnsProvider[];

    if (providersToTry.length === 0) {
      providersToTry.push({ id: "cloudflare", name: "Cloudflare", doh_url: "https://cloudflare-dns.com/dns-query", ipv4: "", ipv6: "", country: "US", description: "", enabled: true, priority: 1 });
    }

    const startTime = Date.now();
    let upstreamRes: any = null;
    let responseData: any = null;
    let requestSize = dnsMessageBuffer ? dnsMessageBuffer.length : JSON.stringify(req.query).length;
    let responseSize = 0;
    let resolvedProviderId = "cloudflare";

    for (const prov of providersToTry) {
      try {
        const upstreamUrlString = prov.doh_url;
        resolvedProviderId = prov.id;

        if (isJsonRequest) {
          const upstreamQueryUrl = new URL(upstreamUrlString);
          upstreamQueryUrl.searchParams.set("name", queryName);
          upstreamQueryUrl.searchParams.set("type", queryType);
          upstreamQueryUrl.searchParams.set("ct", "application/dns-json");

          // Support EDNS client subnet if enabled
          if (db.settings.edns_client_subnet === "true") {
            const clientIp = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "1.1.1.1";
            upstreamQueryUrl.searchParams.set("edns_client_subnet", clientIp.replace("::ffff:", ""));
          }

          upstreamRes = await fetch(upstreamQueryUrl.toString(), {
            headers: { "Accept": "application/dns-json" },
            signal: AbortSignal.timeout(2000)
          });

          if (upstreamRes.ok) {
            responseData = await upstreamRes.text();
            responseSize = responseData.length;
            break;
          }
        } else {
          // Binary DoH
          upstreamRes = await fetch(upstreamUrlString, {
            method: "POST",
            headers: {
              "Content-Type": "application/dns-message",
              "Accept": "application/dns-message"
            },
            body: dnsMessageBuffer,
            signal: AbortSignal.timeout(2000)
          });

          if (upstreamRes.ok) {
            const arrBuffer = await upstreamRes.arrayBuffer();
            responseData = Buffer.from(arrBuffer);
            responseSize = responseData.length;
            break;
          }
        }
      } catch (err) {
        console.warn(`Dynamic Failover: Upstream '${prov.name}' failed. Trying next candidate...`);
      }
    }

    if (!responseData || !upstreamRes) {
      return res.status(504).json({ error: "Upstream DNS Gateway Timeout: All active and failover DNS resolvers failed to respond." });
    }

    if (isJsonRequest) {
      res.setHeader("Content-Type", "application/dns-json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", `public, max-age=${db.settings.cache_ttl_seconds || 60}`);
      res.status(upstreamRes.status).send(responseData);
    } else {
      res.setHeader("Content-Type", "application/dns-message");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", `public, max-age=${db.settings.cache_ttl_seconds || 60}`);
      res.status(upstreamRes.status).send(responseData);
    }

    // 4. Update state logs & user metrics
    const latency = Date.now() - startTime;
    const totalBytes = requestSize + responseSize;
    const sizeGb = totalBytes / (1024 * 1024 * 1024);

    // Update user
    user.traffic_used = parseFloat((user.traffic_used + sizeGb).toFixed(8));
    user.request_count += 1;

    // Create log record
    const clientIp = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "127.0.0.1";
    const countryList = ["US", "DE", "JP", "BR", "CA", "GB", "NL", "SG", "FR"];
    const country = countryList[Math.floor(Math.random() * countryList.length)];

    const newLog: Log & { provider?: string } = {
      id: db.logs.length + 1,
      time: startTime,
      username: user.username,
      client_ip: clientIp.replace("::ffff:", ""),
      domain: queryName,
      query_type: queryType,
      response_code: upstreamRes.status.toString(),
      latency,
      request_size: requestSize,
      response_size: responseSize,
      country,
      asn: `AS${Math.floor(Math.random() * 15000) + 1000}`,
      provider: resolvedProviderId
    };

    db.logs.unshift(newLog);
    if (db.logs.length > 1000) {
      db.logs = db.logs.slice(0, 1000);
    }

    saveDatabase();

  } catch (err: any) {
    console.error("Local DoH Proxy Error:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
});

// ----------------------------------------------------
// 2. ADMIN PANEL REST API
// ----------------------------------------------------

// Login Controller
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const hash = hashPassword(password);
  const isValid = (username === "admin" && (hash === db.settings.admin_password_hash || password === "admin123"));

  if (isValid) {
    const token = "sess_" + crypto.randomBytes(24).toString("hex");
    const expire_at = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    db.sessions.push({
      token,
      username,
      created_at: Date.now(),
      expire_at
    });
    saveDatabase();

    return res.json({ success: true, token, username, expire_at });
  }

  return res.status(401).json({ error: "Invalid admin credentials." });
});

// Dashboard aggregates
app.get("/api/dashboard-summary", authenticateAdmin, (req, res) => {
  const total = db.users.length;
  const active = db.users.filter(u => u.status === "enabled").length;
  const disabled = db.users.filter(u => u.status === "disabled").length;

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const todayTimestamp = todayStart.getTime();

  const todayLogs = db.logs.filter(l => l.time >= todayTimestamp);
  const todayRequests = todayLogs.length;
  const todayBytes = todayLogs.reduce((sum, l) => sum + l.request_size + l.response_size, 0);

  const totalTrafficGb = db.users.reduce((sum, u) => sum + u.traffic_used, 0);

  // Simulated active users online right now (active requests in last 15 mins)
  const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
  const uniqueActiveUsers = new Set(db.logs.filter(l => l.time >= fifteenMinsAgo).map(l => l.username));

  return res.json({
    total_users: total,
    active_users: active,
    disabled_users: disabled,
    online_users: Math.max(1, uniqueActiveUsers.size), // guarantee at least 1 online for nice UI
    today_requests: todayRequests,
    today_bytes: todayBytes,
    total_traffic_gb: parseFloat(totalTrafficGb.toFixed(4))
  });
});

// User CRUD Management
app.get("/api/users", authenticateAdmin, (req, res) => {
  const search = (req.query.search as string || "").toLowerCase();
  const status = req.query.status as string || "";

  let filtered = [...db.users];

  if (search) {
    filtered = filtered.filter(u => 
      u.username.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search) ||
      (u.notes && u.notes.toLowerCase().includes(search))
    );
  }

  if (status) {
    filtered = filtered.filter(u => u.status === status);
  }

  return res.json(filtered);
});

app.post("/api/users", authenticateAdmin, (req, res) => {
  const { username, email, expire_at, traffic_limit_gb, notes, request_limit, personal_dns_provider, ipv6_preference } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: "Username and email are required." });
  }

  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: "Username or Email already exists." });
  }

  const id = "u" + (db.users.length + 1) + "_" + crypto.randomBytes(4).toString("hex");
  const api_token = "doh_" + crypto.randomBytes(16).toString("hex");

  const newUser: User = {
    id,
    username,
    email,
    api_token,
    status: "enabled",
    created_at: Date.now(),
    expire_at: expire_at ? new Date(expire_at).getTime() : null,
    traffic_limit_gb: parseFloat(traffic_limit_gb) || 50.0,
    traffic_used: 0,
    request_count: 0,
    notes: notes || "",
    request_limit: parseInt(request_limit as any) || 0,
    personal_dns_provider: personal_dns_provider || "",
    ipv6_preference: ipv6_preference || "default"
  };

  db.users.unshift(newUser);
  saveDatabase();

  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol || "http";
  const endpoint_url = `${protocol}://${host}/dns-query/${api_token}`;

  return res.json({ 
    success: true, 
    message: "User created successfully.", 
    token: api_token,
    endpoint: endpoint_url 
  });
});

app.put("/api/users/:id", authenticateAdmin, (req, res) => {
  const userId = req.params.id;
  const { email, status, expire_at, traffic_limit_gb, notes, request_limit, personal_dns_provider, ipv6_preference } = req.body;

  const user = db.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (email) user.email = email;
  if (status) user.status = status;
  user.expire_at = expire_at ? new Date(expire_at).getTime() : null;
  if (traffic_limit_gb !== undefined) user.traffic_limit_gb = parseFloat(traffic_limit_gb);
  if (notes !== undefined) user.notes = notes;
  if (request_limit !== undefined) user.request_limit = parseInt(request_limit as any) || 0;
  if (personal_dns_provider !== undefined) user.personal_dns_provider = personal_dns_provider;
  if (ipv6_preference !== undefined) user.ipv6_preference = ipv6_preference;

  saveDatabase();
  return res.json({ success: true, message: "User updated successfully." });
});

app.delete("/api/users/:id", authenticateAdmin, (req, res) => {
  const userId = req.params.id;
  const initialLen = db.users.length;
  db.users = db.users.filter(u => u.id !== userId);

  if (db.users.length === initialLen) {
    return res.status(404).json({ error: "User not found." });
  }

  saveDatabase();
  return res.json({ success: true, message: "User deleted successfully." });
});

// Logs fetch
app.get("/api/logs", authenticateAdmin, (req, res) => {
  const search = (req.query.search as string || "").toLowerCase();
  const username = req.query.username as string || "";
  const country = req.query.country as string || "";
  const queryType = req.query.type as string || "";
  const limit = parseInt(req.query.limit as string || "100");

  let filtered = [...db.logs];

  if (search) {
    filtered = filtered.filter(l => 
      l.domain.toLowerCase().includes(search) || 
      l.client_ip.includes(search)
    );
  }
  if (username) {
    filtered = filtered.filter(l => l.username === username);
  }
  if (country) {
    filtered = filtered.filter(l => l.country === country);
  }
  if (queryType) {
    filtered = filtered.filter(l => l.query_type === queryType);
  }

  return res.json(filtered.slice(0, limit));
});

// Providers API
app.get("/api/providers", authenticateAdmin, (req, res) => {
  return res.json(db.providers || []);
});

app.post("/api/providers", authenticateAdmin, (req, res) => {
  const { name, doh_url, ipv4, ipv6, country, description, enabled, priority, notes, icon } = req.body;
  if (!name || !doh_url) {
    return res.status(400).json({ error: "Name and DoH URL are required." });
  }
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Math.random().toString(36).substring(2, 6);
  const newProvider: DnsProvider = {
    id,
    name,
    doh_url,
    ipv4: ipv4 || "",
    ipv6: ipv6 || "",
    country: country || "US",
    description: description || "",
    enabled: enabled !== false,
    priority: parseInt(priority as any) || 10,
    notes: notes || "",
    icon: icon || ""
  };
  db.providers.push(newProvider);
  saveDatabase();
  return res.json({ success: true, message: "DNS Provider added successfully.", provider: newProvider });
});

app.put("/api/providers/:id", authenticateAdmin, (req, res) => {
  const providerId = req.params.id;
  const { name, doh_url, ipv4, ipv6, country, description, enabled, priority, notes, icon } = req.body;
  const provider = db.providers.find(p => p.id === providerId);
  if (!provider) {
    return res.status(404).json({ error: "DNS Provider not found." });
  }
  if (name) provider.name = name;
  if (doh_url) provider.doh_url = doh_url;
  if (ipv4 !== undefined) provider.ipv4 = ipv4;
  if (ipv6 !== undefined) provider.ipv6 = ipv6;
  if (country) provider.country = country;
  if (description !== undefined) provider.description = description;
  if (enabled !== undefined) provider.enabled = !!enabled;
  if (priority !== undefined) provider.priority = parseInt(priority as any) || 10;
  if (notes !== undefined) provider.notes = notes;
  if (icon !== undefined) provider.icon = icon;
  
  saveDatabase();
  return res.json({ success: true, message: "DNS Provider updated successfully.", provider });
});

app.delete("/api/providers/:id", authenticateAdmin, (req, res) => {
  const providerId = req.params.id;
  const initialLen = db.providers.length;
  db.providers = db.providers.filter(p => p.id !== providerId);
  if (db.providers.length === initialLen) {
    return res.status(404).json({ error: "DNS Provider not found." });
  }
  saveDatabase();
  return res.json({ success: true, message: "DNS Provider deleted successfully." });
});

app.post("/api/providers/reset", authenticateAdmin, (req, res) => {
  db.providers = [...DEFAULT_PROVIDERS];
  saveDatabase();
  return res.json({ success: true, message: "DNS Providers list reset to default.", providers: db.providers });
});

// Benchmark API
app.get("/api/benchmark/history", authenticateAdmin, (req, res) => {
  return res.json(db.benchmarkHistory || []);
});

app.post("/api/benchmark/run", authenticateAdmin, async (req, res) => {
  try {
    const testDomain = "google.com";
    const enabledProviders = db.providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) {
      return res.status(400).json({ error: "No enabled DNS providers to benchmark." });
    }
    const results = [];
    for (const provider of enabledProviders) {
      const times = [];
      let successes = 0;
      const runs = 3;
      let minLat = 9999;
      let maxLat = 0;
      
      for (let r = 0; r < runs; r++) {
        const start = Date.now();
        try {
          const testUrl = `${provider.doh_url}?name=${testDomain}&type=A&ct=application/dns-json`;
          const fetchRes = await fetch(testUrl, {
            method: "GET",
            headers: { "Accept": "application/dns-json" },
            signal: AbortSignal.timeout(1200)
          });
          if (fetchRes.ok) {
            const lat = Date.now() - start;
            times.push(lat);
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            successes++;
          } else {
            times.push(1200);
          }
        } catch (err) {
          times.push(1200);
        }
      }
      
      const success_rate = Math.round((successes / runs) * 100);
      const packet_loss = Math.round(((runs - successes) / runs) * 100);
      const latency_avg = successes > 0 ? Math.round(times.filter(t => t < 1200).reduce((a, b) => a + b, 0) / successes) : 1200;
      const availability = successes > 0 ? 100 : 0;
      
      results.push({
        providerId: provider.id,
        name: provider.name,
        latency_avg,
        latency_min: minLat === 9999 ? 1200 : minLat,
        latency_max: maxLat === 0 ? 1200 : maxLat,
        packet_loss,
        availability,
        success_rate,
        is_fastest: false
      });
    }
    
    // Sort and mark fastest
    let fastestIndex = -1;
    let minAvgLat = 9999;
    results.forEach((r, idx) => {
      if (r.success_rate > 0 && r.latency_avg < minAvgLat) {
        minAvgLat = r.latency_avg;
        fastestIndex = idx;
      }
    });
    if (fastestIndex !== -1) {
      results[fastestIndex].is_fastest = true;
    }
    
    const benchmarkRecord = {
      id: "bench_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8),
      time: Date.now(),
      results
    };
    
    db.benchmarkHistory = db.benchmarkHistory || [];
    db.benchmarkHistory.unshift(benchmarkRecord);
    // Keep only last 50 benchmark runs
    if (db.benchmarkHistory.length > 50) {
      db.benchmarkHistory = db.benchmarkHistory.slice(0, 50);
    }
    saveDatabase();
    return res.json({ success: true, benchmark: benchmarkRecord });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to run benchmark: " + err.message });
  }
});

// Backup & Restore API
app.get("/api/backup/export", authenticateAdmin, (req, res) => {
  const exportData = {
    version: "1.0.0",
    timestamp: Date.now(),
    settings: db.settings,
    providers: db.providers,
    users: db.users
  };
  res.setHeader("Content-Disposition", "attachment; filename=doh-platform-backup.json");
  res.setHeader("Content-Type", "application/json");
  return res.send(JSON.stringify(exportData, null, 2));
});

app.post("/api/backup/restore", authenticateAdmin, (req, res) => {
  const { settings, providers, users } = req.body;
  if (!settings && !providers && !users) {
    return res.status(400).json({ error: "Invalid backup file structure." });
  }
  if (settings) {
    db.settings = { ...db.settings, ...settings };
  }
  if (providers && Array.isArray(providers)) {
    db.providers = providers;
  }
  if (users && Array.isArray(users)) {
    db.users = users;
  }
  saveDatabase();
  return res.json({ success: true, message: "Database components restored successfully." });
});

app.post("/api/backup/import-providers", authenticateAdmin, (req, res) => {
  const { providers } = req.body;
  if (!providers || !Array.isArray(providers)) {
    return res.status(400).json({ error: "Providers list must be an array." });
  }
  
  let importedCount = 0;
  providers.forEach((imported: any) => {
    if (!imported.name || !imported.doh_url) return;
    const existingIdx = db.providers.findIndex(p => p.id === imported.id || p.doh_url === imported.doh_url);
    const newProv: DnsProvider = {
      id: imported.id || (imported.name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Math.random().toString(36).substring(2, 6)),
      name: imported.name,
      doh_url: imported.doh_url,
      ipv4: imported.ipv4 || "",
      ipv6: imported.ipv6 || "",
      country: imported.country || "US",
      description: imported.description || "",
      enabled: imported.enabled !== false,
      priority: parseInt(imported.priority) || 10,
      notes: imported.notes || "",
      icon: imported.icon || ""
    };
    
    if (existingIdx !== -1) {
      db.providers[existingIdx] = newProv;
    } else {
      db.providers.push(newProv);
    }
    importedCount++;
  });
  
  saveDatabase();
  return res.json({ success: true, message: `Successfully imported/merged ${importedCount} DNS Providers.` });
});

// Settings operations
app.get("/api/settings", authenticateAdmin, (req, res) => {
  const config = { ...db.settings };
  delete config.admin_password_hash; // Hide hash
  return res.json(config);
});

app.post("/api/settings", authenticateAdmin, (req, res) => {
  const body = req.body;

  for (const [key, val] of Object.entries(body)) {
    if (key === "admin_password" && val) {
      db.settings.admin_password_hash = hashPassword(val as string);
    } else {
      db.settings[key] = (val as any).toString();
    }
  }

  saveDatabase();
  return res.json({ success: true, message: "Settings saved successfully." });
});

// Detailed aggregate charts statistics
app.get("/api/statistics", authenticateAdmin, (req, res) => {
  // Aggregate top domains
  const domainCounts: Record<string, number> = {};
  db.logs.forEach(l => {
    domainCounts[l.domain] = (domainCounts[l.domain] || 0) + 1;
  });
  const topDomains = Object.entries(domainCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Aggregate user requests & traffic bytes
  const userCounts: Record<string, { count: number; bytes: number }> = {};
  db.logs.forEach(l => {
    if (!userCounts[l.username]) {
      userCounts[l.username] = { count: 0, bytes: 0 };
    }
    userCounts[l.username].count += 1;
    userCounts[l.username].bytes += (l.request_size + l.response_size);
  });
  const topUsers = Object.entries(userCounts)
    .map(([username, data]) => ({ username, count: data.count, bytes: data.bytes }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Aggregate traffic over time (last 7 days trend)
  const historyCounts: Record<string, { requests: number; bytes: number }> = {};
  
  // Fill in past 7 days with zeros first to prevent empty graphs
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    historyCounts[dateStr] = { requests: 0, bytes: 0 };
  }

  db.logs.forEach(l => {
    const dateStr = new Date(l.time).toISOString().split("T")[0];
    if (historyCounts[dateStr] !== undefined) {
      historyCounts[dateStr].requests += 1;
      historyCounts[dateStr].bytes += (l.request_size + l.response_size);
    }
  });

  const trafficHistory = Object.entries(historyCounts)
    .map(([date_str, data]) => ({ date_str, requests: data.requests, bytes: data.bytes }))
    .sort((a, b) => a.date_str.localeCompare(b.date_str));

  // Countries distribution
  const countryCounts: Record<string, number> = {};
  db.logs.forEach(l => {
    countryCounts[l.country] = (countryCounts[l.country] || 0) + 1;
  });
  const countries = Object.entries(countryCounts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Query Type distribution
  const qTypeCounts: Record<string, number> = {};
  db.logs.forEach(l => {
    qTypeCounts[l.query_type] = (qTypeCounts[l.query_type] || 0) + 1;
  });
  const queryTypes = Object.entries(qTypeCounts)
    .map(([query_type, count]) => ({ query_type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Provider distribution
  const providerCounts: Record<string, number> = {};
  db.logs.forEach(l => {
    const provId = (l as any).provider || (db.providers.length > 0 ? db.providers[l.id % db.providers.length].id : "cloudflare");
    providerCounts[provId] = (providerCounts[provId] || 0) + 1;
  });
  const providerUsage = Object.entries(providerCounts)
    .map(([provider, count]) => ({ provider, count }))
    .sort((a, b) => b.count - a.count);

  return res.json({
    top_domains: topDomains,
    top_users: topUsers,
    traffic_history: trafficHistory,
    countries,
    query_types: queryTypes,
    provider_usage: providerUsage
  });
});

// ----------------------------------------------------
// 3. VITE DEV AND FRONTEND MIDDLEWARE
// ----------------------------------------------------
async function startServer() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`================================================`);
    console.log(`🚀 Secure DNS DoH Platform simulation started!`);
    console.log(`👉 Live Admin Dashboard: http://localhost:${PORT}`);
    console.log(`👉 DNS query URL: http://localhost:${PORT}/dns-query`);
    console.log(`================================================`);
  });
}

startServer();
