import React, { useState, useEffect } from "react";
import { Log } from "../types";
import { Search, RefreshCw, AlertCircle, Database, Check, Play, Pause } from "lucide-react";

interface LogsTabProps {
  logs: Log[];
  usernames: string[];
  countries: string[];
  queryTypes: string[];
  onRefresh: () => void;
  isLoading: boolean;
  liveStreamActive: boolean;
  onToggleLiveStream: () => void;
  onFilterChange: (filters: { search: string; username: string; country: string; type: string }) => void;
}

export default function LogsTab({
  logs,
  usernames,
  countries,
  queryTypes,
  onRefresh,
  isLoading,
  liveStreamActive,
  onToggleLiveStream,
  onFilterChange
}: LogsTabProps) {
  const [search, setSearch] = useState("");
  const [username, setUsername] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState("");

  // Apply filters instantly
  useEffect(() => {
    onFilterChange({ search, username, country, type });
  }, [search, username, country, type]);

  // Convert bytes to readable traffic size
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-6" id="logs-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xl font-extrabold text-white flex items-center space-x-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${liveStreamActive ? "" : "hidden"}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${liveStreamActive ? "bg-emerald-500" : "bg-slate-500"}`}></span>
            </span>
            <span>Real-time DNS Logs Ticker</span>
          </h4>
          <p className="text-xs text-slate-400">View and inspect live client requests routed through this secure DNS gateway.</p>
        </div>

        {/* Live Stream Toggles */}
        <div className="flex items-center space-x-3 self-start sm:self-center">
          <button
            onClick={onToggleLiveStream}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition duration-300 ${
              liveStreamActive
                ? "bg-emerald-950/50 text-emerald-400 border-emerald-800"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            {liveStreamActive ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-emerald-400" />
                <span>Live Streaming</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-slate-300" />
                <span>Stream Live</span>
              </>
            )}
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 text-slate-300 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/10 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-3xl shadow-xl">
        {/* Search Input */}
        <div className="md:col-span-1 relative">
          <input
            type="text"
            placeholder="Search domain or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
        </div>

        {/* User filter */}
        <div>
          <select
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Devices/Clients</option>
            {usernames.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* Country filter */}
        <div>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Query Type filter */}
        <div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All DNS Types</option>
            {queryTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-5">Timestamp</th>
                <th className="py-3 px-5">Client Profile</th>
                <th className="py-3 px-5">Query Domain</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5">Response</th>
                <th className="py-3 px-5">Latency</th>
                <th className="py-3 px-5">Bandwidth</th>
                <th className="py-3 px-5">Geographic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-xs font-mono">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition duration-155">
                  <td className="py-3.5 px-5 text-slate-400">
                    {new Date(log.time).toLocaleTimeString()}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className="font-semibold text-slate-200 block">{log.username}</span>
                    <span className="text-[10px] text-slate-500">{log.client_ip}</span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-100 max-w-[200px] truncate" title={log.domain}>
                    {log.domain}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      log.query_type === "A" ? "bg-emerald-950 text-emerald-400 border border-emerald-900" :
                      log.query_type === "AAAA" ? "bg-sky-950 text-sky-400 border border-sky-900" :
                      "bg-slate-800 text-slate-300 border border-slate-700"
                    }`}>
                      {log.query_type}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`inline-flex items-center space-x-1 ${log.response_code === "200" ? "text-emerald-400 font-semibold" : "text-amber-400"}`}>
                      {log.response_code === "200" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>OK (200)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Code {log.response_code}</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-300">
                    {log.latency} ms
                  </td>
                  <td className="py-3.5 px-5 text-slate-400 text-[10px]">
                    <div className="flex flex-col">
                      <span>↑ {log.request_size} B</span>
                      <span>↓ {log.response_size} B</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="flex flex-col">
                      <span className="text-slate-300 font-bold">{log.country}</span>
                      <span className="text-[9px] text-slate-500 truncate max-w-[90px]" title={log.asn}>{log.asn}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                    No DNS logs found matching current filter query criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
