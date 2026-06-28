import React, { useState } from "react";
import { PlatformSettings } from "../types";
import { Save, ShieldAlert, Sliders, Database, Key, LayoutGrid } from "lucide-react";

interface SettingsTabProps {
  settings: PlatformSettings;
  onSaveSettings: (data: Partial<PlatformSettings> & { admin_password?: string }) => Promise<void>;
}

export default function SettingsTab({
  settings,
  onSaveSettings
}: SettingsTabProps) {
  const [defaultDns, setDefaultDns] = useState(settings.default_dns_provider || "cloudflare");
  const [rateLimit, setRateLimit] = useState(settings.rate_limit_per_minute || "300");
  const [cacheTtl, setCacheTtl] = useState(settings.cache_ttl_seconds || "60");
  const [maxPacketSize, setMaxPacketSize] = useState(settings.max_dns_packet_size || "512");
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenance_mode === "true");
  const [siteTitle, setSiteTitle] = useState(settings.site_title || "DoH Private DNS Manager");
  
  // Password Change fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setSuccessMsg("");
    setIsSaving(true);

    const data: Partial<PlatformSettings> & { admin_password?: string } = {
      default_dns_provider: defaultDns,
      rate_limit_per_minute: rateLimit,
      cache_ttl_seconds: cacheTtl,
      max_dns_packet_size: maxPacketSize,
      maintenance_mode: maintenanceMode ? "true" : "false",
      site_title: siteTitle
    };

    if (newPassword) {
      if (newPassword !== confirmPassword) {
        setPasswordError("Passwords do not match");
        setIsSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        setPasswordError("Password must be at least 6 characters long");
        setIsSaving(false);
        return;
      }
      data.admin_password = newPassword;
    }

    try {
      await onSaveSettings(data);
      setSuccessMsg("System configuration updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setPasswordError("Failed to update system settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" id="settings-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xl font-extrabold text-white">System Settings Controller</h4>
          <p className="text-xs text-slate-400">Configure core DNS proxy resolvers, packet caches, rate limiting, and interface titles.</p>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition shadow-md self-start sm:self-center"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Saving Config..." : "Save Settings"}</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-950 border border-emerald-900 text-emerald-400 px-4 py-3 rounded-lg text-xs font-semibold animate-in fade-in duration-200">
          {successMsg}
        </div>
      )}

      {passwordError && (
        <div className="bg-rose-950 border border-rose-900 text-rose-400 px-4 py-3 rounded-lg text-xs font-semibold animate-in fade-in duration-200">
          {passwordError}
        </div>
      )}

      {/* Grid Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: DNS & Rate Limits */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Default Upstream DNS */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <h5 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-white/5 pb-3">
              <Database className="w-4 h-4 text-indigo-400" />
              <span>Default Upstream DNS Provider</span>
            </h5>
            
            <p className="text-xs text-slate-400">Select the primary resolver to route standard and recursive client queries.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { id: "cloudflare", name: "Cloudflare DNS", url: "https://cloudflare-dns.com", desc: "Highest privacy and low latency, supports security blocking" },
                { id: "google", name: "Google Public DNS", url: "https://dns.google", desc: "Reliable and robust globally, handles high query throughput" },
                { id: "quad9", name: "Quad9 DNS", url: "https://dns.quad9.net", desc: "Provides dynamic threat intelligence blocking and security shields" },
                { id: "adguard", name: "AdGuard DNS", url: "https://dns.adguard-dns.com", desc: "Blocks advertisements, marketing trackers, and spam payloads" },
                { id: "nextdns", name: "NextDNS Engine", url: "https://dns.nextdns.io", desc: "A customizable fully custom DNS endpoint router" },
              ].map(provider => (
                <label 
                  key={provider.id}
                  className={`flex flex-col p-4 rounded-xl border cursor-pointer transition ${
                    defaultDns === provider.id 
                      ? "bg-indigo-500/10 border-indigo-500 text-white" 
                      : "bg-white/2 border-white/10 hover:bg-white/5 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{provider.name}</span>
                    <input
                      type="radio"
                      name="dns_provider"
                      value={provider.id}
                      checked={defaultDns === provider.id}
                      onChange={() => setDefaultDns(provider.id)}
                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4 bg-white/5 border-white/10"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono mb-2">{provider.url}</span>
                  <span className="text-xs text-slate-400 font-sans leading-relaxed">{provider.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Card 2: DNS Engine Limits */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <h5 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-white/5 pb-3">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span>DNS Proxy Tuning Limits</span>
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Rate Limit (req/min)</label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Maximum allowed DNS queries per client per minute.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Cache TTL (seconds)</label>
                <input
                  type="number"
                  min="0"
                  max="86400"
                  value={cacheTtl}
                  onChange={(e) => setCacheTtl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Time browser caches responses locally before query retry.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Max Packet Size (bytes)</label>
                <input
                  type="number"
                  min="128"
                  max="65535"
                  value={maxPacketSize}
                  onChange={(e) => setMaxPacketSize(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <span className="text-[9px] text-slate-500 mt-1 block">Strict reject of binary DNS queries larger than this.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Platform Configuration & Maintenance */}
        <div className="space-y-6">
          
          {/* Card 3: Brand Identity */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <h5 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-white/5 pb-3">
              <LayoutGrid className="w-4 h-4 text-sky-400" />
              <span>Admin Panel Branding</span>
            </h5>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Site Header Title</label>
              <input
                type="text"
                required
                value={siteTitle}
                onChange={(e) => setSiteTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Card 4: Change Credentials */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
            <h5 className="text-sm font-bold text-white flex items-center space-x-2 border-b border-white/5 pb-3">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Change Admin Password</span>
            </h5>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">New Password</label>
              <input
                type="password"
                placeholder="••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                placeholder="••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Card 5: Danger Zone / Maintenance */}
          <div className="bg-white/5 backdrop-blur-md border border-rose-900/40 rounded-3xl p-6 shadow-xl space-y-4">
            <h5 className="text-sm font-bold text-rose-400 flex items-center space-x-2 border-b border-rose-950 pb-3">
              <ShieldAlert className="w-4 h-4" />
              <span>Security & Maintenance</span>
            </h5>

            <div className="flex items-start space-x-3 bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl">
              <input
                type="checkbox"
                id="m_mode"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="text-rose-600 focus:ring-rose-500 h-4 w-4 bg-white/5 border-white/10 rounded mt-0.5 cursor-pointer"
              />
              <label htmlFor="m_mode" className="text-xs text-rose-300 leading-normal cursor-pointer select-none">
                <span className="font-bold block text-rose-400 mb-0.5">Toggle Maintenance Mode</span>
                Activate scheduled maintenance. If checked, DoH query logging is active but all admin dashboard APIs will block requests.
              </label>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
