import React from "react";
import { Users, Activity, ArrowLeftRight, Database, ShieldAlert, Cpu, HardDrive, RefreshCw } from "lucide-react";
import { DashboardSummary, StatisticsData, Log } from "../types";

interface DashboardTabProps {
  summary: DashboardSummary;
  stats: StatisticsData;
  recentLogs: Log[];
  onRefresh: () => void;
  isLoading: boolean;
}

export default function DashboardTab({
  summary,
  stats,
  recentLogs,
  onRefresh,
  isLoading
}: DashboardTabProps) {
  // Convert bytes to readable traffic size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Helper for computing maximums in SVG scale
  const maxRequests = stats.traffic_history.length > 0
    ? Math.max(...stats.traffic_history.map(d => d.requests), 10)
    : 10;
    
  const maxBytes = stats.traffic_history.length > 0
    ? Math.max(...stats.traffic_history.map(d => d.bytes), 1024 * 1024)
    : 1024 * 1024;

  return (
    <div className="space-y-6" id="dashboard-tab">
      {/* Upper Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Users */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:bg-white/10 transition duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Client Users</p>
              <h3 className="text-3xl font-bold text-white mt-1">{summary.total_users}</h3>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-white transition duration-300">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center space-x-2 text-xs">
            <span className="text-emerald-400 font-semibold">{summary.active_users} active</span>
            <span className="text-slate-500">•</span>
            <span className="text-rose-400 font-semibold">{summary.disabled_users} disabled</span>
          </div>
        </div>

        {/* Card 2: Online clients */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:bg-white/10 transition duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Online Clients (15m)</p>
              <h3 className="text-3xl font-bold text-white mt-1 flex items-center space-x-2">
                <span>{summary.online_users}</span>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </h3>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-white transition duration-300">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400">
            Clients currently querying the server
          </div>
        </div>

        {/* Card 3: Today's Queries */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:bg-white/10 transition duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Today's DNS Queries</p>
              <h3 className="text-3xl font-bold text-white mt-1">{summary.today_requests.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-sky-400 group-hover:bg-sky-500/20 group-hover:text-white transition duration-300">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400 flex items-center space-x-1">
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span>Average latency: ~12ms</span>
          </div>
        </div>

        {/* Card 4: Accumulated Traffic */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden group hover:bg-white/10 transition duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Assigned Traffic</p>
              <h3 className="text-3xl font-bold text-white mt-1">{summary.total_traffic_gb.toFixed(2)} <span className="text-sm font-medium text-slate-400">GB</span></h3>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-amber-400 group-hover:bg-amber-500/20 group-hover:text-white transition duration-300">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-400 flex items-center space-x-1">
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>Today's payload: {formatBytes(summary.today_bytes)}</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SVG Requests Line Chart */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-md font-bold text-white">DNS Queries Trend</h4>
              <p className="text-xs text-slate-400">Total requests logged over the last 7 days</p>
            </div>
            <button 
              onClick={onRefresh}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="relative h-64 w-full bg-white/5 rounded-2xl border border-white/5 p-4">
            {stats.traffic_history.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="reqGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Horizontal Guide Lines */}
                <line x1="0" y1="50" x2="500" y2="50" stroke="#1e293b" strokeDasharray="3,3" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#1e293b" strokeDasharray="3,3" />
                <line x1="0" y1="150" x2="500" y2="150" stroke="#1e293b" strokeDasharray="3,3" />

                {/* Draw Area */}
                <path
                  d={`M 0 200 ${stats.traffic_history.map((day, idx) => {
                    const x = (idx / (stats.traffic_history.length - 1)) * 500;
                    const y = 200 - (day.requests / maxRequests) * 160;
                    return `L ${x} ${y}`;
                  }).join(" ")} L 500 200 Z`}
                  fill="url(#reqGradient)"
                />

                {/* Draw Line */}
                <path
                  d={stats.traffic_history.map((day, idx) => {
                    const x = (idx / (stats.traffic_history.length - 1)) * 500;
                    const y = 200 - (day.requests / maxRequests) * 160;
                    return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                  }).join(" ")}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data Points */}
                {stats.traffic_history.map((day, idx) => {
                  const x = (idx / (stats.traffic_history.length - 1)) * 500;
                  const y = 200 - (day.requests / maxRequests) * 160;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-indigo-400 stroke-slate-950 stroke-2 cursor-pointer hover:r-6 hover:fill-white transition-all"
                    />
                  );
                })}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                No history statistics available
              </div>
            )}
            
            {/* Legend / Axes */}
            <div className="flex justify-between mt-3 text-[10px] text-slate-400 font-mono">
              {stats.traffic_history.map((day, idx) => (
                <div key={idx}>{day.date_str.substring(5)}</div>
              ))}
            </div>
          </div>
        </div>

        {/* SVG Traffic Bar Chart */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-md font-bold text-white">Data Traffic Trend</h4>
              <p className="text-xs text-slate-400">Total bandwidth proxied (upload + download) in last 7 days</p>
            </div>
          </div>

          <div className="relative h-64 w-full bg-white/5 rounded-2xl border border-white/5 p-4">
            {stats.traffic_history.length > 0 ? (
              <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                {/* Horizontal Guide Lines */}
                <line x1="0" y1="50" x2="500" y2="50" stroke="#1e293b" strokeDasharray="3,3" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#1e293b" strokeDasharray="3,3" />
                <line x1="0" y1="150" x2="500" y2="150" stroke="#1e293b" strokeDasharray="3,3" />

                {/* Bars */}
                {stats.traffic_history.map((day, idx) => {
                  const width = 25;
                  const totalBars = stats.traffic_history.length;
                  const spacing = (500 - (totalBars * width)) / (totalBars - 1 || 1);
                  const x = idx * (width + spacing);
                  const height = (day.bytes / maxBytes) * 160;
                  const y = 200 - height;

                  return (
                    <g key={idx}>
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={Math.max(height, 4)}
                        rx="4"
                        className="fill-indigo-500/80 hover:fill-indigo-400 hover:opacity-100 transition-all cursor-pointer"
                      />
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                No history statistics available
              </div>
            )}
            
            {/* Legend / Axes */}
            <div className="flex justify-between mt-3 text-[10px] text-slate-400 font-mono">
              {stats.traffic_history.map((day, idx) => (
                <div key={idx}>{day.date_str.substring(5)}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lower Row: Top Users & Live Logs Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Users Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl lg:col-span-1">
          <h4 className="text-md font-bold text-white mb-4 flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Top Client Devices</span>
          </h4>
          <div className="space-y-4">
            {stats.top_users.slice(0, 5).map((u, i) => {
              const maxUserBytes = Math.max(...stats.top_users.map(u => u.bytes), 1);
              const percentage = (u.bytes / maxUserBytes) * 100;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-200">{u.username}</span>
                    <span className="text-slate-400">{u.count.toLocaleString()} q | {formatBytes(u.bytes)}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1.5 border border-white/5">
                    <div 
                      className="bg-indigo-500 h-1.5 rounded-full" 
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {stats.top_users.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">No user traffic records</p>
            )}
          </div>
        </div>

        {/* Live Logs Stream Widget */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-md font-bold text-white flex items-center space-x-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Recent Queries Stream</span>
            </h4>
            <span className="text-xs text-slate-400 font-mono">Auto-updates from server</span>
          </div>

          <div className="divide-y divide-white/10 max-h-[220px] overflow-y-auto pr-1">
            {recentLogs.slice(0, 6).map((log, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-xs hover:bg-white/5 px-2 rounded-lg transition">
                <div className="flex items-center space-x-3 truncate">
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                    log.query_type === "A" ? "bg-emerald-950 text-emerald-400 border border-emerald-900" :
                    log.query_type === "AAAA" ? "bg-sky-950 text-sky-400 border border-sky-900" :
                    "bg-slate-800 text-slate-300 border border-slate-700"
                  }`}>
                    {log.query_type}
                  </span>
                  <div className="truncate">
                    <p className="font-mono text-slate-200 truncate">{log.domain}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {log.username} • {log.client_ip}
                    </p>
                  </div>
                </div>
                
                <div className="text-right flex items-center space-x-3 ml-2 shrink-0">
                  <div className="font-mono">
                    <span className="text-slate-400">{log.latency}ms</span>
                    <span className="text-slate-500 mx-1">|</span>
                    <span className={`font-semibold ${log.response_code === "200" ? "text-emerald-400" : "text-amber-400"}`}>
                      {log.response_code === "200" ? "OK" : log.response_code}
                    </span>
                  </div>
                  <span className="bg-white/5 text-slate-400 px-1.5 py-0.5 rounded font-mono text-[10px] border border-white/5">
                    {log.country}
                  </span>
                </div>
              </div>
            ))}
            {recentLogs.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-10">No recent DNS query logs received</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
