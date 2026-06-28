import React from "react";
import { StatisticsData } from "../types";
import { BarChart3, Globe, PieChart, RefreshCw, Smartphone } from "lucide-react";

interface StatsTabProps {
  stats: StatisticsData;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function StatsTab({
  stats,
  onRefresh,
  isLoading
}: StatsTabProps) {
  // Convert bytes to readable traffic size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const totalQueries = stats.top_domains.reduce((sum, d) => sum + d.count, 0) || 100;
  const maxDomainQueries = stats.top_domains.length > 0 ? stats.top_domains[0].count : 1;
  const maxUserQueries = stats.top_users.length > 0 ? stats.top_users[0].count : 1;
  const totalCountryQueries = stats.countries.reduce((sum, c) => sum + c.count, 0) || 1;

  return (
    <div className="space-y-6" id="stats-tab">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-xl font-extrabold text-white">Advanced Query Analytics</h4>
          <p className="text-xs text-slate-400">Deep structural statistics of request domains, users, countries and query formats.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/10 hover:text-white transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Sync Analytics</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Top Domains */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
          <h5 className="text-sm font-bold text-white mb-6 flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <span>Most Queried Domains</span>
          </h5>

          <div className="space-y-4">
            {stats.top_domains.slice(0, 8).map((dom, i) => {
              const pctOfMax = (dom.count / maxDomainQueries) * 100;
              const isTracker = dom.domain.includes("analytics") || dom.domain.includes("doubleclick") || dom.domain.includes("telemetry");
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-200 flex items-center space-x-2">
                      <span className="text-slate-500 font-semibold">{i + 1}.</span>
                      <span className="truncate max-w-[200px]">{dom.domain}</span>
                      {isTracker && (
                        <span className="text-[9px] bg-rose-950/50 text-rose-400 border border-rose-900/40 px-1 py-0.5 rounded font-bold font-sans">
                          Tracker
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-semibold text-slate-300">
                      {dom.count.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">queries</span>
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full border border-white/10 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${isTracker ? "bg-rose-500" : "bg-indigo-500"}`}
                      style={{ width: `${pctOfMax}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.top_domains.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-12">No query records available yet</p>
            )}
          </div>
        </div>

        {/* Card 2: Top Requesting Users */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
          <h5 className="text-sm font-bold text-white mb-6 flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Top Querying Clients</span>
          </h5>

          <div className="space-y-4">
            {stats.top_users.slice(0, 8).map((user, i) => {
              const pctOfMax = (user.count / maxUserQueries) * 100;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200 flex items-center space-x-2">
                      <span className="text-slate-500 font-mono">{i + 1}.</span>
                      <span>{user.username}</span>
                    </span>
                    <span className="font-mono text-slate-400">
                      <span className="font-semibold text-slate-300">{user.count.toLocaleString()} queries</span>
                      <span className="mx-1.5">|</span>
                      <span>{formatBytes(user.bytes)}</span>
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full border border-white/10 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pctOfMax}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {stats.top_users.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-12">No client queries logged</p>
            )}
          </div>
        </div>

        {/* Card 3: Geo Distribution */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
          <h5 className="text-sm font-bold text-white mb-6 flex items-center space-x-2">
            <Globe className="w-4 h-4 text-sky-400" />
            <span>Geographical Query Origins</span>
          </h5>

          <div className="space-y-4">
            {stats.countries.slice(0, 6).map((c, i) => {
              const pct = ((c.count / totalCountryQueries) * 100).toFixed(1);
              return (
                <div key={i} className="flex items-center justify-between text-xs border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-slate-500 font-mono w-4">{i + 1}.</span>
                    <span className="bg-white/5 text-sky-400 border border-white/10 px-2 py-0.5 rounded font-mono font-bold">
                      {c.country}
                    </span>
                    <span className="text-slate-300 font-medium font-sans">
                      {c.country === "US" ? "United States" :
                       c.country === "DE" ? "Germany" :
                       c.country === "JP" ? "Japan" :
                       c.country === "BR" ? "Brazil" :
                       c.country === "CA" ? "Canada" :
                       c.country === "GB" ? "United Kingdom" :
                       c.country === "NL" ? "Netherlands" :
                       c.country === "SG" ? "Singapore" :
                       "Other Region"}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-semibold text-slate-200">{c.count.toLocaleString()}</span>
                    <span className="text-slate-500 ml-1.5">({pct}%)</span>
                  </div>
                </div>
              );
            })}
            {stats.countries.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-12">No countries detected in logs</p>
            )}
          </div>
        </div>

        {/* Card 4: DNS Query Types */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
          <h5 className="text-sm font-bold text-white mb-6 flex items-center space-x-2">
            <PieChart className="w-4 h-4 text-amber-400" />
            <span>DNS Request Type Distribution</span>
          </h5>

          <div className="space-y-4">
            {stats.query_types.slice(0, 6).map((t, i) => {
              const pct = ((t.count / totalCountryQueries) * 100).toFixed(1);
              return (
                <div key={i} className="flex items-center justify-between text-xs border-b border-white/5 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-slate-500 font-mono w-4">{i + 1}.</span>
                    <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-[10px] border ${
                      t.query_type === "A" ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40" :
                      t.query_type === "AAAA" ? "bg-sky-950/40 text-sky-400 border-sky-900/40" :
                      "bg-white/5 text-slate-300 border-white/10"
                    }`}>
                      {t.query_type}
                    </span>
                    <span className="text-slate-400">
                      {t.query_type === "A" ? "IPv4 Address queries" :
                       t.query_type === "AAAA" ? "IPv6 Address queries" :
                       t.query_type === "CNAME" ? "Canonical record lookups" :
                       t.query_type === "TXT" ? "Text metadata queries" :
                       t.query_type === "MX" ? "Mail Exchange queries" :
                       "Extended protocol records"}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-semibold text-slate-200">{t.count.toLocaleString()}</span>
                    <span className="text-slate-500 ml-1.5">({pct}%)</span>
                  </div>
                </div>
              );
            })}
            {stats.query_types.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-12">No records logged</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
