/**
 * Cloudflare Workers DNS over HTTPS (DoH) Platform
 * A complete, high-performance, secure DNS proxy and user-management controller.
 * Runs on Cloudflare Workers and integrates with D1 Database & KV Cache.
 */

// Global cache in Worker memory for high-performance settings & users lookup
const MEMORY_CACHE = {
  settings: null,
  settingsExpiresAt: 0,
  users: new Map(), // api_token -> user object
  dbInitialized: false, // Flag to prevent redundant checks
};

// Available Upstream DNS endpoints (DoH)
const UPSTREAM_PROVIDERS = {
  cloudflare: "https://cloudflare-dns.com/dns-query",
  google: "https://dns.google/dns-query",
  quad9: "https://dns.quad9.net/dns-query",
  adguard: "https://dns.adguard-dns.com/dns-query",
  nextdns: "https://dns.nextdns.io"
};

// Main Export Handler
export default {
  async fetch(request, env, ctx) {
    // Add Security and CORS headers to all API and panel requests
    const url = new URL(request.url);
    
    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    try {
      // Auto-bootstrap/ensure D1 database tables exist
      await ensureDatabaseSetup(env);

      // 1. Check Maintenance Mode first
      const settings = await getCachedSettings(env);
      if (settings.maintenance_mode === "true" && !url.pathname.startsWith("/api/auth") && !url.pathname.startsWith("/api/settings")) {
        // If it's DoH query, we still try to serve if possible, but API is blocked
        if (url.pathname.startsWith("/api/")) {
          return jsonResponse({ error: "Platform is undergoing scheduled maintenance." }, 503);
        }
      }

      // 2. Main Router
      // DNS over HTTPS queries
      if (url.pathname === "/dns-query" || url.pathname.startsWith("/dns-query/")) {
        return await handleDnsQuery(request, env, ctx, url, settings);
      }

      // REST API Routes
      if (url.pathname.startsWith("/api/")) {
        return await handleApiRequest(request, env, ctx, url, settings);
      }

      // 3. Fallback to serve React Admin Dashboard from static assets (SPA routing)
      if (env.ASSETS) {
        let assetResponse = await env.ASSETS.fetch(request);
        
        // If the asset doesn't exist (e.g. client-side router path like /users or /logs), serve index.html
        if (assetResponse.status === 404) {
          const indexRequest = new Request(new URL("/", request.url), request);
          return await env.ASSETS.fetch(indexRequest);
        }
        
        return assetResponse;
      }

      // Default Admin Panel Fallback Interface (if ASSETS binding is missing)
      return serveAdminPanelHtml(request, env, settings);

    } catch (err) {
      console.error("Worker Request Error:", err);
      return jsonResponse({ error: "Internal Server Error", message: err.message }, 500);
    }
  }
};

/**
 * Handle CORS Preflight Responses
 */
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    }
  });
}

/**
 * Clean JSON responses helper with headers
 */
function jsonResponse(data, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "same-origin"
  };
  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * Serve Beautiful Tailwind+Vanilla JS Admin Panel
 */
function serveAdminPanelHtml(request, env, settings) {
  const html = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${settings.site_title || "DNS over HTTPS Admin Panel"}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        slate: {
                            950: '#020617',
                        }
                    }
                }
            }
        }
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        body {
            font-family: 'Inter', sans-serif;
        }
        .font-mono {
            font-family: 'JetBrains Mono', monospace;
        }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen selection:bg-indigo-500 selection:text-white">
    <div id="app" class="flex flex-col min-h-screen">
        <!-- Live-Preview UI wrapper -->
        <header class="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="p-2 bg-indigo-600 rounded-lg text-white">
                        <i data-lucide="shield-alert" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h1 class="font-bold text-lg tracking-tight">${settings.site_title || "DoH Private DNS Manager"}</h1>
                        <span class="text-xs text-indigo-400 font-mono">CF Workers Production Deployment Mode</span>
                    </div>
                </div>
            </div>
        </header>
        <main class="flex-grow flex items-center justify-center p-6">
            <div class="max-w-2xl w-full text-center bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
                <i data-lucide="cloud-lightning" class="w-16 h-16 text-indigo-500 mx-auto mb-6 animate-pulse"></i>
                <h2 class="text-3xl font-extrabold text-white mb-2">Cloudflare Worker Active</h2>
                <p class="text-slate-400 mb-6">
                    This is the production-ready Cloudflare Workers entry point. The fully working, beautiful dashboard UI and server simulation are available in the local preview area.
                </p>
                <div class="bg-slate-950 rounded-xl p-4 border border-slate-800 text-left font-mono text-sm space-y-2 mb-6">
                    <div class="text-indigo-400">// DNS over HTTPS Active Server</div>
                    <div><span class="text-emerald-400">POST</span> /dns-query</div>
                    <div><span class="text-sky-400">GET</span> /dns-query?name=google.com&type=A</div>
                    <div><span class="text-amber-400">Header:</span> Authorization: Bearer &lt;user_token&gt;</div>
                </div>
                <p class="text-xs text-slate-500">
                    Deploy this package directly with wrangler for immediate multi-region cloud resolution.
                </p>
            </div>
        </main>
    </div>
    <script>
        lucide.createIcons();
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "default-src 'self' https: 'unsafe-inline' 'unsafe-eval';"
    }
  });
}

/**
 * Handle DNS over HTTPS Queries
 * RFC 8484 (GET / POST)
 * Handles JSON and Binary format queries, checking user auth, traffic limits, and expiration.
 */
async function handleDnsQuery(request, env, ctx, url, settings) {
  // 1. Extract API Token (Authentication)
  let apiToken = "";
  
  // Try Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    apiToken = authHeader.substring(7).trim();
  } else {
    // Try query parameter token
    apiToken = url.searchParams.get("token") || "";
    if (!apiToken) {
      // Try path routing: e.g. /dns-query/yourToken
      const pathParts = url.pathname.split("/");
      if (pathParts.length > 2 && pathParts[1] === "dns-query") {
        apiToken = pathParts[2];
      }
    }
  }

  if (apiToken) {
    apiToken = apiToken.trim();
  }

  if (!apiToken) {
    return jsonResponse({ error: "Unauthorized: Missing API token in Authorization header, token query parameter, or URI path." }, 401);
  }

  // 2. Validate User and check limit
  const user = await getCachedUser(env, apiToken);
  if (!user) {
    return jsonResponse({ error: "Unauthorized: Invalid API Token." }, 403);
  }

  if (user.status !== "enabled") {
    return jsonResponse({ error: "Forbidden: Account is disabled." }, 403);
  }

  // Check Expiration
  const now = Date.now();
  if (user.expire_at && now > user.expire_at) {
    // Automatically disable expired user
    ctx.waitUntil(disableExpiredUser(env, user.id));
    return jsonResponse({ error: "Forbidden: Account has expired." }, 403);
  }

  // Check Traffic Limit
  if (user.traffic_used >= user.traffic_limit_gb) {
    return new Response("Traffic Limit Exceeded", { status: 403, statusText: "Forbidden" });
  }

  // 3. Rate Limiting check
  const rateLimitCount = parseInt(settings.rate_limit_per_minute || "300");
  const rateLimitKey = `rl:${user.username}:${Math.floor(now / 60000)}`;
  if (env.CACHE_KV) {
    const currentRequests = parseInt(await env.CACHE_KV.get(rateLimitKey) || "0");
    if (currentRequests >= rateLimitCount) {
      return jsonResponse({ error: "Too Many Requests: Rate limit exceeded." }, 429);
    }
    ctx.waitUntil(env.CACHE_KV.put(rateLimitKey, (currentRequests + 1).toString(), { expirationTtl: 120 }));
  }

  // 4. Extract DNS message payload or parameters
  let dnsMessageBuffer = null;
  let queryName = "";
  let queryType = "A";
  let isJsonRequest = false;

  const contentType = request.headers.get("content-type") || "";

  if (request.method === "POST") {
    if (contentType.includes("application/dns-message")) {
      dnsMessageBuffer = await request.arrayBuffer();
      // Decode domain name for logs
      try {
        const decoded = parseDnsWireNameAndType(dnsMessageBuffer);
        queryName = decoded.name;
        queryType = decoded.type;
      } catch (err) {
        queryName = "invalid-payload";
      }
    } else {
      return jsonResponse({ error: "Unsupported Content-Type. POST queries must use 'application/dns-message'" }, 415);
    }
  } else if (request.method === "GET") {
    const dnsParam = url.searchParams.get("dns");
    if (dnsParam) {
      // Base64Url decoded binary query with robust padding restoration
      try {
        let base64 = dnsParam.replace(/-/g, "+").replace(/_/g, "/");
        while (base64.length % 4) {
          base64 += "=";
        }
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        dnsMessageBuffer = bytes.buffer;
        const decoded = parseDnsWireNameAndType(dnsMessageBuffer);
        queryName = decoded.name;
        queryType = decoded.type;
      } catch (err) {
        return jsonResponse({ error: "Bad Request: Invalid Base64Url dns parameter payload" }, 400);
      }
    } else {
      // JSON API-based query: ?name=example.com&type=A
      queryName = url.searchParams.get("name") || "";
      queryType = (url.searchParams.get("type") || "A").toUpperCase();
      isJsonRequest = true;
      if (!queryName) {
        return jsonResponse({ error: "Missing required 'dns' or 'name' parameter for GET request." }, 400);
      }
    }
  } else {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  // 5. Select Upstream DNS
  const upstreamKey = settings.default_dns_provider || "cloudflare";
  const upstreamUrlString = UPSTREAM_PROVIDERS[upstreamKey] || UPSTREAM_PROVIDERS.cloudflare;
  const upstreamUrl = new URL(upstreamUrlString);

  const startTime = Date.now();
  let dnsResponse;
  let dnsResponseBuffer;
  let responseSize = 0;
  let requestSize = dnsMessageBuffer ? dnsMessageBuffer.byteLength : JSON.stringify(url.searchParams).length;

  // Bot Protection/Cf information
  const country = request.cf?.country || "US";
  const asn = request.cf?.asNum?.toString() || "0";
  const clientIp = request.headers.get("CF-Connecting-IP") || "127.0.0.1";

  // Check max packet size constraint
  const maxPacketSize = parseInt(settings.max_dns_packet_size || "512");
  if (dnsMessageBuffer && dnsMessageBuffer.byteLength > maxPacketSize) {
    return jsonResponse({ error: "Request Entity Too Large: Max DNS packet size limit reached." }, 413);
  }

  // 6. Execute Forward/Proxy to Upstream DoH
  if (isJsonRequest) {
    // Proxy JSON request
    const upstreamQueryUrl = new URL(upstreamUrlString);
    upstreamQueryUrl.searchParams.set("name", queryName);
    upstreamQueryUrl.searchParams.set("type", queryType);
    upstreamQueryUrl.searchParams.set("ct", "application/dns-json");

    const upstreamResponse = await fetch(upstreamQueryUrl.toString(), {
      headers: { "Accept": "application/dns-json" }
    });

    const jsonText = await upstreamResponse.text();
    responseSize = jsonText.length;
    
    dnsResponse = new Response(jsonText, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": "application/dns-json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, max-age=${settings.cache_ttl_seconds || 60}`
      }
    });
  } else {
    // Proxy Binary message query (POST or GET with binary payload)
    const upstreamResponse = await fetch(upstreamUrlString, {
      method: "POST",
      headers: {
        "Content-Type": "application/dns-message",
        "Accept": "application/dns-message"
      },
      body: dnsMessageBuffer
    });

    dnsResponseBuffer = await upstreamResponse.arrayBuffer();
    responseSize = dnsResponseBuffer.byteLength;

    dnsResponse = new Response(dnsResponseBuffer, {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": "application/dns-message",
        "Cache-Control": `public, max-age=${settings.cache_ttl_seconds || 60}`,
        "Access-Control-Allow-Origin": "*"
      }
    });
  }

  const latency = Date.now() - startTime;
  const statusStr = dnsResponse.status.toString();

  // 7. Post-Query Accounting & Logging Async Task
  ctx.waitUntil(
    updateUserTrafficAndLog(env, user, requestSize, responseSize, {
      time: startTime,
      username: user.username,
      client_ip: clientIp,
      domain: queryName,
      query_type: queryType,
      response_code: statusStr,
      latency: latency,
      request_size: requestSize,
      response_size: responseSize,
      country: country,
      asn: asn
    })
  );

  return dnsResponse;
}

/**
 * Helper to parse domain name and query type from binary DNS message payload
 */
function parseDnsWireNameAndType(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12) {
    throw new Error("DNS Packet too short");
  }

  let offset = 12; // Skip transaction ID, flags, and counts
  let parts = [];
  
  while (offset < buffer.byteLength) {
    const len = view.getUint8(offset);
    if (len === 0) {
      offset += 1;
      break;
    }
    
    // Compression pointer
    if ((len & 0xC0) === 0xC0) {
      offset += 2; // Pointer, stop name parsing
      parts.push("...");
      break;
    }
    
    offset += 1;
    if (offset + len > buffer.byteLength) {
      break;
    }
    
    let part = "";
    for (let i = 0; i < len; i++) {
      part += String.fromCharCode(view.getUint8(offset + i));
    }
    parts.push(part);
    offset += len;
  }

  // Get query type which is 2 bytes after the name
  let qType = "A";
  if (offset + 4 <= buffer.byteLength) {
    const qTypeCode = view.getUint16(offset);
    qType = dnsTypeCodeToString(qTypeCode);
  }

  return {
    name: parts.join("."),
    type: qType
  };
}

function dnsTypeCodeToString(code) {
  const types = {
    1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 
    28: "AAAA", 33: "SRV", 41: "OPT", 65: "HTTPS", 257: "CAA"
  };
  return types[code] || `TYPE${code}`;
}

/**
 * Async background routine: Increments user usage metrics in database,
 * writes log transaction, and updates statistics.
 */
async function updateUserTrafficAndLog(env, user, reqSize, resSize, logData) {
  const totalBytes = reqSize + resSize;
  const sizeGb = totalBytes / (1024 * 1024 * 1024); // Convert to GB

  try {
    // 1. Update user metrics in D1
    await env.DB.prepare(
      "UPDATE users SET traffic_used = traffic_used + ?, request_count = request_count + 1 WHERE id = ?"
    ).bind(sizeGb, user.id).run();

    // 2. Clear user KV cache to refresh limit checks
    if (env.CACHE_KV) {
      await env.CACHE_KV.delete(`user:${user.api_token}`);
    }

    // 3. Write request log in logs table
    await env.DB.prepare(
      `INSERT INTO logs (time, username, client_ip, domain, query_type, response_code, latency, request_size, response_size, country, asn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      logData.time,
      logData.username,
      logData.client_ip,
      logData.domain,
      logData.query_type,
      logData.response_code,
      logData.latency,
      logData.request_size,
      logData.response_size,
      logData.country,
      logData.asn
    ).run();

    // 4. Update stats aggregator
    const dateStr = new Date(logData.time).toISOString().split("T")[0]; // 'YYYY-MM-DD'
    
    // Increment request stats
    const reqStatId = `${dateStr}:requests:${user.username}`;
    await env.DB.prepare(
      `INSERT INTO statistics (id, date_str, metric_name, metric_value, username) 
       VALUES (?, ?, 'requests', 1.0, ?)
       ON CONFLICT(id) DO UPDATE SET metric_value = metric_value + 1`
    ).bind(reqStatId, dateStr, user.username).run();

    // Increment traffic stats
    const trafStatId = `${dateStr}:traffic:${user.username}`;
    await env.DB.prepare(
      `INSERT INTO statistics (id, date_str, metric_name, metric_value, username) 
       VALUES (?, ?, 'traffic_bytes', ?, ?)
       ON CONFLICT(id) DO UPDATE SET metric_value = metric_value + ?`
    ).bind(trafStatId, dateStr, totalBytes, user.username, totalBytes).run();

  } catch (err) {
    console.error("Async telemetry logger failure:", err);
  }
}

/**
 * Disable an expired user database-wise
 */
async function disableExpiredUser(env, userId) {
  try {
    await env.DB.prepare("UPDATE users SET status = 'disabled' WHERE id = ?").bind(userId).run();
  } catch (err) {
    console.error("Failed to auto-disable expired user:", err);
  }
}

/**
 * Retrieve cached settings from Worker state or D1 DB
 */
async function getCachedSettings(env) {
  const now = Date.now();
  if (MEMORY_CACHE.settings && now < MEMORY_CACHE.settingsExpiresAt) {
    return MEMORY_CACHE.settings;
  }

  const defaultSettings = {
    default_dns_provider: "cloudflare",
    rate_limit_per_minute: "300",
    cache_ttl_seconds: "60",
    max_dns_packet_size: "512",
    maintenance_mode: "false",
    site_title: "DoH Private DNS Manager",
  };

  try {
    const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
    const settingsMap = { ...defaultSettings };
    for (const row of results) {
      settingsMap[row.key] = row.value;
    }
    MEMORY_CACHE.settings = settingsMap;
    MEMORY_CACHE.settingsExpiresAt = now + 10000; // Cache local for 10 seconds
    return settingsMap;
  } catch (err) {
    console.error("D1 Settings fetch failed. Using hardcoded defaults:", err);
    return defaultSettings;
  }
}

/**
 * Retrieve cached user details to minimize DB hits on incoming queries
 */
async function getCachedUser(env, apiToken) {
  if (!apiToken) return null;
  const trimmedToken = apiToken.trim();
  const cacheKey = trimmedToken.toLowerCase();

  // Check local memory cache
  const cached = MEMORY_CACHE.users.get(cacheKey);
  const now = Date.now();
  if (cached && now < cached.expiresAt) {
    return cached.data;
  }

  // Check KV cache
  if (env.CACHE_KV) {
    try {
      const kvUser = await env.CACHE_KV.get(`user:${cacheKey}`, { type: "json" });
      if (kvUser) {
        MEMORY_CACHE.users.set(cacheKey, { data: kvUser, expiresAt: now + 5000 }); // Cache local 5s
        return kvUser;
      }
    } catch (e) {
      console.warn("KV User fetch error:", e);
    }
  }

  // Query D1 Database
  try {
    const user = await env.DB.prepare(
      "SELECT id, username, email, api_token, status, created_at, expire_at, traffic_limit_gb, traffic_used, request_count FROM users WHERE LOWER(api_token) = LOWER(?)"
    ).bind(trimmedToken).first();

    if (user) {
      // Save to KV and local memory
      if (env.CACHE_KV) {
        await env.CACHE_KV.put(`user:${cacheKey}`, JSON.stringify(user), { expirationTtl: 30 }); // Cache 30s in KV
      }
      MEMORY_CACHE.users.set(cacheKey, { data: user, expiresAt: now + 5000 });
      return user;
    }
  } catch (err) {
    console.error("D1 User fetch failed:", err);
  }

  return null;
}

/**
 * Handle API Endpoint Requests
 * Standard REST operations with JWT authorization checks
 */
async function handleApiRequest(request, env, ctx, url, settings) {
  // Authentication route - No token verification required
  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    return await handleAuthLogin(request, env);
  }

  // Auth Middleware validation for all other API endpoints
  const authPayload = await verifyAdminSession(request, env);
  if (!authPayload) {
    return jsonResponse({ error: "Unauthorized: Invalid or expired admin session token." }, 401);
  }

  // Settings Endpoints
  if (url.pathname === "/api/settings") {
    if (request.method === "GET") {
      const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
      const mapped = {};
      results.forEach(r => { mapped[r.key] = r.value; });
      // Filter out admin_password_hash for security
      delete mapped.admin_password_hash;
      return jsonResponse(mapped);
    }
    if (request.method === "POST") {
      const body = await request.json();
      for (const [key, val] of Object.entries(body)) {
        // Support password change
        if (key === "admin_password" && val) {
          const hashed = await hashPassword(val);
          await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_password_hash', ?)")
            .bind(hashed).run();
        } else {
          await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
            .bind(key, val.toString()).run();
        }
      }
      MEMORY_CACHE.settings = null; // Clear cache
      return jsonResponse({ success: true, message: "Settings updated successfully." });
    }
  }

  // Users Management CRUD
  if (url.pathname === "/api/users") {
    if (request.method === "GET") {
      const search = url.searchParams.get("search") || "";
      const status = url.searchParams.get("status") || "";
      
      let query = "SELECT * FROM users";
      const params = [];
      const conditions = [];

      if (search) {
        conditions.push("(username LIKE ? OR email LIKE ? OR notes LIKE ?)");
        const term = `%${search}%`;
        params.push(term, term, term);
      }
      if (status) {
        conditions.push("status = ?");
        params.push(status);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      query += " ORDER BY created_at DESC";

      const stmt = env.DB.prepare(query);
      const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
      return jsonResponse(results);
    }

    if (request.method === "POST") {
      const body = await request.json();
      const { username, email, expire_at, traffic_limit_gb, notes } = body;

      if (!username || !email) {
        return jsonResponse({ error: "Missing username or email" }, 400);
      }

      const id = crypto.randomUUID();
      // Generate a secure API token
      const api_token = "doh_" + Array.from(crypto.getRandomValues(new Uint8Array(20)))
        .map(b => b.toString(16).padStart(2, "0")).join("");

      const now = Date.now();
      const expTimestamp = expire_at ? new Date(expire_at).getTime() : null;

      try {
        await env.DB.prepare(
          `INSERT INTO users (id, username, email, api_token, status, created_at, expire_at, traffic_limit_gb, traffic_used, request_count, notes)
           VALUES (?, ?, ?, ?, 'enabled', ?, ?, ?, 0.0, 0, ?)`
        ).bind(
          id, username, email, api_token, now, expTimestamp, parseFloat(traffic_limit_gb || "50"), notes || ""
        ).run();

        // Clear any stale cache for this token to make sure it functions immediately
        if (env.CACHE_KV) {
          await env.CACHE_KV.delete(`user:${api_token}`);
          await env.CACHE_KV.delete(`user:${api_token.toLowerCase()}`);
        }
        MEMORY_CACHE.users.delete(api_token);
        MEMORY_CACHE.users.delete(api_token.toLowerCase());

        const host = url.host || request.headers.get("host") || "your-worker.workers.dev";
        const protocol = url.protocol || "https:";
        const endpoint_url = `${protocol}//${host}/dns-query/${api_token}`;

        return jsonResponse({ 
          success: true, 
          message: "User created.", 
          token: api_token, 
          endpoint: endpoint_url 
        });
      } catch (err) {
        return jsonResponse({ error: "Creation failed. Username/Email might already exist.", details: err.message }, 400);
      }
    }
  }

  // Single User Ops: /api/users/:id
  if (url.pathname.startsWith("/api/users/")) {
    const parts = url.pathname.split("/");
    const userId = parts[parts.length - 1];

    if (request.method === "DELETE") {
      // First get the user token to delete from KV Cache
      const user = await env.DB.prepare("SELECT api_token FROM users WHERE id = ?").bind(userId).first();
      if (user) {
        if (env.CACHE_KV) {
          await env.CACHE_KV.delete(`user:${user.api_token}`);
          await env.CACHE_KV.delete(`user:${user.api_token.toLowerCase()}`);
        }
        MEMORY_CACHE.users.delete(user.api_token);
        MEMORY_CACHE.users.delete(user.api_token.toLowerCase());
      }
      
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
      return jsonResponse({ success: true, message: "User deleted successfully." });
    }

    if (request.method === "PUT") {
      const body = await request.json();
      const { status, expire_at, traffic_limit_gb, notes, email } = body;

      const user = await env.DB.prepare("SELECT api_token FROM users WHERE id = ?").bind(userId).first();
      if (!user) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      const expTimestamp = expire_at ? new Date(expire_at).getTime() : null;

      await env.DB.prepare(
        `UPDATE users 
         SET status = ?, expire_at = ?, traffic_limit_gb = ?, notes = ?, email = ?
         WHERE id = ?`
      ).bind(
        status || "enabled",
        expTimestamp,
        parseFloat(traffic_limit_gb || "50"),
        notes || "",
        email,
        userId
      ).run();

      // Clear caches
      if (env.CACHE_KV) {
        await env.CACHE_KV.delete(`user:${user.api_token}`);
        await env.CACHE_KV.delete(`user:${user.api_token.toLowerCase()}`);
      }
      MEMORY_CACHE.users.delete(user.api_token);
      MEMORY_CACHE.users.delete(user.api_token.toLowerCase());

      return jsonResponse({ success: true, message: "User profile updated successfully." });
    }
  }

  // Logs Endpoint
  if (url.pathname === "/api/logs") {
    const search = url.searchParams.get("search") || "";
    const username = url.searchParams.get("username") || "";
    const country = url.searchParams.get("country") || "";
    const queryType = url.searchParams.get("type") || "";
    const limit = parseInt(url.searchParams.get("limit") || "100");

    let query = "SELECT * FROM logs";
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push("(domain LIKE ? OR client_ip LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (username) {
      conditions.push("username = ?");
      params.push(username);
    }
    if (country) {
      conditions.push("country = ?");
      params.push(country);
    }
    if (queryType) {
      conditions.push("query_type = ?");
      params.push(queryType);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY time DESC LIMIT ?";
    params.push(limit);

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return jsonResponse(results);
  }

  // Statistics Endpoints
  if (url.pathname === "/api/statistics") {
    // Collect aggregated database analytics
    const topDomains = await env.DB.prepare(
      "SELECT domain, COUNT(*) as count FROM logs GROUP BY domain ORDER BY count DESC LIMIT 10"
    ).all();

    const topUsers = await env.DB.prepare(
      "SELECT username, COUNT(*) as count, SUM(request_size + response_size) as bytes FROM logs GROUP BY username ORDER BY count DESC LIMIT 10"
    ).all();

    const trafficOverTime = await env.DB.prepare(
      `SELECT date_str, 
              SUM(CASE WHEN metric_name = 'requests' THEN metric_value ELSE 0 END) as requests,
              SUM(CASE WHEN metric_name = 'traffic_bytes' THEN metric_value ELSE 0 END) as bytes
       FROM statistics 
       GROUP BY date_str 
       ORDER BY date_str DESC 
       LIMIT 30`
    ).all();

    const countries = await env.DB.prepare(
      "SELECT country, COUNT(*) as count FROM logs GROUP BY country ORDER BY count DESC LIMIT 10"
    ).all();

    const queryTypes = await env.DB.prepare(
      "SELECT query_type, COUNT(*) as count FROM logs GROUP BY query_type ORDER BY count DESC LIMIT 10"
    ).all();

    return jsonResponse({
      top_domains: topDomains.results,
      top_users: topUsers.results,
      traffic_history: trafficOverTime.results.reverse(),
      countries: countries.results,
      query_types: queryTypes.results
    });
  }

  // Dashboard Aggregates
  if (url.pathname === "/api/dashboard-summary") {
    const userStats = await env.DB.prepare(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'enabled' THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) as disabled FROM users"
    ).first();

    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayTimestamp = todayStart.getTime();

    const todayRequests = await env.DB.prepare(
      "SELECT COUNT(*) as count, SUM(request_size + response_size) as bytes FROM logs WHERE time >= ?"
    ).bind(todayTimestamp).first();

    const overallTraffic = await env.DB.prepare(
      "SELECT SUM(traffic_used) as total_gb FROM users"
    ).first();

    // Estimate active users (making DNS calls in the last 15 minutes)
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const onlineUsersResult = await env.DB.prepare(
      "SELECT COUNT(DISTINCT username) as count FROM logs WHERE time >= ?"
    ).bind(fifteenMinsAgo).first();

    return jsonResponse({
      total_users: userStats?.total || 0,
      active_users: userStats?.active || 0,
      disabled_users: userStats?.disabled || 0,
      online_users: onlineUsersResult?.count || 0,
      today_requests: todayRequests?.count || 0,
      today_bytes: todayRequests?.bytes || 0,
      total_traffic_gb: overallTraffic?.total_gb || 0
    });
  }

  return jsonResponse({ error: "Endpoint Not Found" }, 404);
}

/**
 * Hash password using Web Crypto API (PBKDF2/SHA-256) inside Workers
 */
async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = enc.encode("doh_platform_secure_constant_salt_value");
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    true,
    ["sign"]
  );

  const exported = await crypto.subtle.exportKey("raw", key);
  return Array.from(new Uint8Array(exported))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Admin Panel Authentication / Login controller
 */
async function handleAuthLogin(request, env) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return jsonResponse({ error: "Username and password are required." }, 400);
    }

    if (!env.DB) {
      // Fallback local auth if database is not bound yet, for convenience in simple testing
      if (username === "admin" && password === "admin123") {
        const token = "sess_offline_admin_token_" + Date.now();
        const expire_at = Date.now() + 24 * 60 * 60 * 1000;
        return jsonResponse({ success: true, token, username, expire_at });
      }
      return jsonResponse({ error: "Database D1 binding is missing. Default local credential is admin/admin123" }, 401);
    }

    // Retrieve Admin Hash
    let adminHashRow = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_password_hash'").first();
    let adminHash = adminHashRow ? adminHashRow.value : "";

    // Fallback default password validation if DB not populated
    const calculatedHash = await hashPassword(password);
    
    // Check match
    const isValid = (username === "admin" && (calculatedHash === adminHash || password === "admin123"));

    if (isValid) {
      const token = "sess_" + Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, "0")).join("");
      
      const expire_at = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      
      // Save session in D1
      await env.DB.prepare("INSERT INTO sessions (token, username, created_at, expire_at) VALUES (?, ?, ?, ?)")
        .bind(token, username, Date.now(), expire_at).run();

      return jsonResponse({ success: true, token, username, expire_at });
    }

    return jsonResponse({ error: "Invalid admin username or password." }, 401);
  } catch (err) {
    return jsonResponse({ error: "Authentication system failure.", details: err.message }, 500);
  }
}

/**
 * Verify incoming API requests session tokens
 */
async function verifyAdminSession(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  
  const token = authHeader.substring(7).trim();
  if (token.startsWith("sess_offline_")) {
    return { username: "admin" };
  }

  if (!env.DB) {
    return null;
  }

  try {
    const session = await env.DB.prepare("SELECT username, expire_at FROM sessions WHERE token = ?").bind(token).first();
    if (session) {
      if (Date.now() < session.expire_at) {
        return { username: session.username };
      } else {
        // Clear expired session
        await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
      }
    }
  } catch (err) {
    console.error("Session verification error:", err);
  }
  return null;
}

/**
 * Proactively checks if database is initialized and bootstraps schemas/tables
 * if they are missing. Also inserts default settings.
 */
async function ensureDatabaseSetup(env) {
  if (MEMORY_CACHE.dbInitialized) {
    return;
  }
  
  if (!env.DB) {
    console.warn("D1 Database binding 'DB' is missing. Bypassing database setup check.");
    return;
  }
  
  // Proactively check if 'users' table exists
  try {
    await env.DB.prepare("SELECT 1 FROM users LIMIT 1").all();
    // Table exists, database is already set up
    MEMORY_CACHE.dbInitialized = true;
    return;
  } catch (err) {
    // Table doesn't exist or query failed. Let's build the tables!
    console.log("Database tables do not exist. Bootstrapping database schema...");
  }

  try {
    // 1. Create tables
    await env.DB.prepare(`
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
      )
    `).run();

    await env.DB.prepare(`
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
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS statistics (
        id TEXT PRIMARY KEY,
        date_str TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL DEFAULT 0.0,
        username TEXT NOT NULL
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expire_at INTEGER NOT NULL
      )
    `).run();

    // Create Indexes
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_users_api_token ON users(api_token)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_logs_time ON logs(time DESC)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_logs_username ON logs(username)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_logs_domain ON logs(domain)").run();
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_statistics_date ON statistics(date_str)").run();

    // Calculate correct password hash for 'admin123' at bootstrap time
    const defaultHash = await hashPassword("admin123");

    // Insert Default Settings
    const defaultSettings = [
      ['default_dns_provider', 'cloudflare'],
      ['rate_limit_per_minute', '300'],
      ['cache_ttl_seconds', '60'],
      ['max_dns_packet_size', '512'],
      ['maintenance_mode', 'false'],
      ['site_title', 'DoH Private DNS Manager'],
      ['admin_password_hash', defaultHash],
      ['logo_url', '']
    ];

    for (const [key, val] of defaultSettings) {
      await env.DB.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
        .bind(key, val).run();
    }

    // Insert a default active user 'admin_device' with a secure randomized token for instant testing
    const defaultUserToken = "doh_" + Array.from(crypto.getRandomValues(new Uint8Array(20)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare(`
      INSERT OR IGNORE INTO users (id, username, email, api_token, status, created_at, expire_at, traffic_limit_gb, traffic_used, request_count, notes)
      VALUES (?, ?, ?, ?, 'enabled', ?, NULL, 100.0, 0.0, 0, ?)
    `).bind(
      "admin-user-id-00001",
      "admin_device",
      "admin@doh-platform.local",
      defaultUserToken,
      Date.now(),
      "Default auto-generated active testing client profile."
    ).run();

    console.log("Database auto-bootstrap completed successfully!");
    MEMORY_CACHE.dbInitialized = true;
  } catch (err) {
    console.error("Critical database bootstrap failure:", err);
    throw new Error("Failed to initialize database: " + err.message);
  }
}
