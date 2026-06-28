# Cloudflare Workers DNS over HTTPS (DoH) Platform

A production-ready, ultra-high-performance Private DNS over HTTPS server (similar to NextDNS) running entirely inside Cloudflare Workers, utilizing Cloudflare D1 Database and KV Namespace for storage, rate limiting, and config caching.

## Features

1. **RFC 8484 DNS over HTTPS Server**: Full compliance with GET/POST binary query format (`application/dns-message`) and standard JSON query APIs (`application/dns-json`).
2. **Multi-Upstream DNS Routing**: Supports on-the-fly proxying to Cloudflare, Google, Quad9, AdGuard DNS, and NextDNS.
3. **Advanced User Management**: Admin panel to Create, Delete, Disable, Enable, Edit, and Search users.
4. **Traffic Accounting**: Computes precise upload and download payload sizes. Suspends users (HTTP 403) once they exceed their assigned traffic limits.
5. **Real-time DNS Logging**: Logs client IP, ASN, country, latency, request/response size, query types, status codes, and domains.
6. **Robust Dashboard Panel**: A beautiful, single-page, responsive dashboard with traffic graphs, user statistics, logs filter search, and system settings.
7. **Rate Limiting & Security**: Protects against high-frequency queries using token bucket limits mapped in KV caches.

---

## Deployment Instructions

### Prerequisites

1. Install the Cloudflare Wrangler CLI:
   ```bash
   npm install -g wrangler
   ```
2. Log in to your Cloudflare Account:
   ```bash
   wrangler login
   ```

### Step 1: Create the Cloudflare D1 Database

Run the following command to provision a new relational D1 database:
```bash
wrangler d1 create doh-dns-db
```

This will output the configuration details containing a `database_name` and a `database_id` (UUID), for example:
```toml
[[d1_databases]]
binding = "DB"
database_name = "doh-dns-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy this block and replace the placeholder inside `wrangler.toml`.

### Step 2: Initialize Database Schema

Apply the database migrations to your D1 instance:
```bash
wrangler d1 execute doh-dns-db --file=./schema.sql --remote
```

This sets up the `users`, `logs`, `statistics`, `settings`, and `sessions` tables and inserts the default administrator configuration.

### Step 3: Create the KV Cache Namespace

Run the following command to provision a KV Namespace for caching:
```bash
wrangler kv:namespace create CACHE_KV
```

Copy the generated ID and replace the `id` field inside the `[[kv_namespaces]]` block in `wrangler.toml`.

### Step 4: Configure Admin Password

The default password is `admin123`. You can change it once logged into the preview dashboard, or by updating the SHA-256 hash in the `settings` table of D1:
```bash
# To generate a custom password hash, the dashboard settings page will do it automatically, 
# or you can write your own string using standard Web Crypto SHA-256 routines.
```

### Step 5: Deploy the Worker

Deploy your project globally to Cloudflare's edge network:
```bash
wrangler deploy
```

---

## DNS Client Configuration

Once deployed, your secure DoH URL will be:
`https://your-worker.your-subdomain.workers.dev/dns-query/your_user_api_token`

### 1. In Browsers (Chrome / Brave / Edge)
Go to **Settings** -> **Privacy and security** -> **Use secure DNS** -> **With: Custom** -> Enter your secure URL:
`https://your-worker.your-subdomain.workers.dev/dns-query/your_user_api_token`

### 2. DNS-over-HTTPS via standard Curl / Dig
```bash
# JSON DNS Query
curl -H "Accept: application/dns-json" "https://your-worker.your-subdomain.workers.dev/dns-query?token=your_user_api_token&name=google.com&type=AAAA"

# RFC8484 Binary Query (Using DoH client or dig)
dig @1.1.1.1 +https +https-path=/dns-query/your_user_api_token google.com
```

### 3. In Android (Private DNS)
Using a DoH-to-DoT resolver or configuring secure DNS inside mobile browsers.

---

## REST API Specification

All endpoints require the HTTP Header `Authorization: Bearer <admin_session_token>`.

### Users CRUD
- `GET /api/users` - List/search users. Optional query params: `search`, `status`.
- `POST /api/users` - Create a user. Body: `{"username": "john", "email": "john@email.com", "traffic_limit_gb": 100, "expire_at": "2027-12-31"}`.
- `PUT /api/users/:id` - Update user properties. Body: `{"status": "disabled", "traffic_limit_gb": 200, "notes": "renewed account"}`.
- `DELETE /api/users/:id` - Permanently remove user and invalidate cache.

### Logs & Metrics
- `GET /api/logs` - Fetch request logs with filter options: `search`, `username`, `country`, `type`, `limit`.
- `GET /api/statistics` - Aggregate statistics for domains, users, countries, query types, and traffic trends.
- `GET /api/dashboard-summary` - Summary widgets (Online, disabled, total requests, traffic count).

### Settings Configuration
- `GET /api/settings` - Retrieve platform configuration keys (title, upstreams, rate limit values).
- `POST /api/settings` - Set config values. Body: `{"default_dns_provider": "google", "rate_limit_per_minute": 500, "admin_password": "new_secure_password"}`.
