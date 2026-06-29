import React, { useState } from "react";
import { Play, Calendar, Zap, AlertTriangle, ShieldCheck, CheckCircle2, History, Filter, ChevronDown, ListFilter, HelpCircle, Trophy, RefreshCw } from "lucide-react";
import { BenchmarkHistory, DnsProvider } from "../types";

interface BenchmarkTabProps {
  history: BenchmarkHistory[];
  providers: DnsProvider[];
  onRunBenchmark: () => Promise<void>;
  isLoading: boolean;
}

export default function BenchmarkTab({
  history,
  providers,
  onRunBenchmark,
  isLoading
}: BenchmarkTabProps) {
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");
  const [groupByCountry, setGroupByCountry] = useState<boolean>(false);

  // Default to first run in history if not selected
  const activeRun = history.find(h => h.id === selectedRunId) || history[0];

  const handleRunTest = async () => {
    await onRunBenchmark();
    if (history.length > 0) {
      setSelectedRunId(history[0].id);
    }
  };

  // Filter & Process results
  let processedResults = activeRun ? [...activeRun.results] : [];

  if (providerFilter) {
    processedResults = processedResults.filter(r => r.providerId === providerFilter);
  }

  // Latency rating color mapper
  const getLatencyColor = (lat: number) => {
    if (lat <= 40) return "text-emerald-400 border-emerald-950 bg-emerald-950/20";
    if (lat <= 120) return "text-amber-400 border-amber-950 bg-amber-950/20";
    return "text-rose-400 border-rose-950 bg-rose-950/20";
  };

  // Packet loss color mapper
  const getLossColor = (loss: number) => {
    if (loss === 0) return "text-emerald-400 bg-emerald-950/20 border-emerald-900/30";
    if (loss <= 33) return "text-amber-400 bg-amber-950/20 border-amber-900/30";
    return "text-rose-400 bg-rose-950/20 border-rose-900/30";
  };

  // Grouped by country helper
  const groupedByCountryObj: Record<string, typeof processedResults> = {};
  if (groupByCountry) {
    processedResults.forEach(r => {
      const prov = providers.find(p => p.id === r.providerId);
      const c = prov ? prov.country : "US";
      if (!groupedByCountryObj[c]) {
        groupedByCountryObj[c] = [];
      }
      groupedByCountryObj[c].push(r);
    });
  }

  // Country Flag Helper
  const getFlagEmoji = (countryCode: string) => {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map(char => 127397 + char.charCodeAt(0));
    try {
      return String.fromCodePoint(...codePoints);
    } catch {
      return countryCode;
    }
  };

  return (
    <div className="space-y-6" id="benchmark-tab">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xl font-extrabold text-white">DNS Upstream Benchmark</h4>
          <p className="text-xs text-slate-400 font-medium">Verify real-time availability, latency and package loss rates of enabled resolvers with real DNS checks.</p>
        </div>
        <button
          onClick={handleRunTest}
          disabled={isLoading}
          className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg self-start sm:self-center"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Benchmarking...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>Execute DNS Benchmark</span>
            </>
          )}
        </button>
      </div>

      {/* Grid of details */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar history log */}
        <div className="lg:col-span-1 bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-3xl shadow-xl flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-sm uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <History className="w-4 h-4 text-slate-400" />
              <span>Previous Runs</span>
            </h5>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-slate-300 font-mono font-bold">
              {history.length} runs
            </span>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[350px] lg:max-h-[550px] pr-1.5 scrollbar-thin">
            {history.map((run, index) => {
              const isSelected = activeRun?.id === run.id;
              const date = new Date(run.time);
              // Find fastest in this run
              const fastest = run.results.find(r => r.is_fastest);

              return (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition duration-200 flex flex-col space-y-2 group ${
                    isSelected 
                      ? "bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-950/20" 
                      : "bg-white/2 border-white/5 hover:border-white/15 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className={isSelected ? "text-indigo-400" : "text-slate-300"}>
                      Run #{history.length - index}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {date.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {date.toLocaleDateString()}
                  </div>
                  {fastest && (
                    <div className="flex items-center space-x-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-lg w-max shrink-0">
                      <Trophy className="w-2.5 h-2.5 fill-emerald-400" />
                      <span className="truncate max-w-[120px]">{fastest.name}</span>
                    </div>
                  )}
                </button>
              );
            })}
            {history.length === 0 && (
              <div className="text-center py-12 text-xs text-slate-500">
                No benchmarks run yet.
              </div>
            )}
          </div>
        </div>

        {/* Core Benchmark results display */}
        <div className="lg:col-span-3 space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-3xl shadow-xl">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <Filter className="w-4 h-4 text-slate-500" />
              <span>Filter Result:</span>
            </div>
            
            <div className="flex flex-wrap gap-4 w-full sm:w-auto">
              {/* Filter Upstream Resolver */}
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="">All Resolvers</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              {/* Group by Country Toggle */}
              <button
                onClick={() => setGroupByCountry(!groupByCountry)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                  groupByCountry 
                    ? "bg-indigo-600 border-indigo-500 text-white" 
                    : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                }`}
              >
                Group By Country
              </button>
            </div>
          </div>

          {/* Results Table */}
          {activeRun ? (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-xl">
              {groupByCountry ? (
                // Country Groupings
                <div className="p-6 space-y-6 divide-y divide-white/10">
                  {Object.entries(groupedByCountryObj).map(([cCode, results]) => (
                    <div key={cCode} className="pt-4 first:pt-0 space-y-3">
                      <h6 className="font-extrabold text-sm text-slate-200 flex items-center space-x-2">
                        <span>{getFlagEmoji(cCode)}</span>
                        <span>{cCode} Upstreams</span>
                        <span className="text-xs text-slate-500">({results.length} resolvers)</span>
                      </h6>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.map((r) => (
                          <div 
                            key={r.providerId} 
                            className={`p-4 rounded-2xl border flex items-center justify-between transition hover:bg-white/5 ${
                              r.is_fastest ? "border-emerald-500/30 bg-emerald-950/10" : "border-white/5"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="font-bold text-white flex items-center space-x-1.5 text-sm">
                                <span>{r.name}</span>
                                {r.is_fastest && (
                                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-md flex items-center space-x-0.5 font-bold uppercase tracking-wider">
                                    <Trophy className="w-2.5 h-2.5 fill-emerald-400" />
                                    <span>Fastest</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 block">Avg latency: {r.latency_avg}ms</span>
                            </div>
                            
                            <div className="flex items-center space-x-3 text-right">
                              <span className={`px-2.5 py-1 border text-xs font-mono font-bold rounded-xl ${getLatencyColor(r.latency_avg)}`}>
                                {r.latency_avg} ms
                              </span>
                              <div className="text-[10px]">
                                <span className="block text-slate-500">Loss</span>
                                <span className={r.packet_loss > 0 ? "text-rose-400 font-bold" : "text-emerald-400 font-semibold"}>
                                  {r.packet_loss}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Simple Plain Table list
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-4 px-6">Upstream Resolver</th>
                        <th className="py-4 px-6 text-center">Avg Latency</th>
                        <th className="py-4 px-6 text-center">Min/Max Latency</th>
                        <th className="py-4 px-6 text-center">Packet Loss</th>
                        <th className="py-4 px-6 text-center">Availability</th>
                        <th className="py-4 px-6 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 text-sm font-medium">
                      {processedResults.map((r) => {
                        const lossColor = getLossColor(r.packet_loss);
                        const isHealthy = r.success_rate >= 66;

                        return (
                          <tr key={r.providerId} className={`hover:bg-white/5 transition duration-150 ${r.is_fastest ? "bg-emerald-950/5" : ""}`}>
                            {/* Provider info */}
                            <td className="py-4 px-6">
                              <div className="flex items-center space-x-3">
                                <div>
                                  <div className="font-bold text-slate-100 flex items-center space-x-2">
                                    <span>{r.name}</span>
                                    {r.is_fastest && (
                                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg flex items-center space-x-1 font-bold uppercase tracking-wider">
                                        <Trophy className="w-2.5 h-2.5 fill-emerald-400" />
                                        <span>Fastest</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Latency Avg */}
                            <td className="py-4 px-6 text-center">
                              <span className={`px-2.5 py-1 border text-xs font-mono font-bold rounded-xl ${getLatencyColor(r.latency_avg)}`}>
                                {r.latency_avg} ms
                              </span>
                            </td>

                            {/* Min/Max Range */}
                            <td className="py-4 px-6 text-center font-mono text-xs text-slate-400">
                              {r.latency_min}ms / {r.latency_max}ms
                            </td>

                            {/* Packet Loss */}
                            <td className="py-4 px-6 text-center">
                              <span className={`px-2 py-0.5 border text-xs font-mono rounded-lg ${lossColor}`}>
                                {r.packet_loss}%
                              </span>
                            </td>

                            {/* Success Rate Availability */}
                            <td className="py-4 px-6 text-center font-mono text-xs text-slate-300">
                              {r.availability}% ({r.success_rate}% success)
                            </td>

                            {/* Final badge status */}
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                isHealthy 
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60" 
                                  : "bg-rose-950/40 text-rose-400 border-rose-900/60"
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full mr-1 ${isHealthy ? "bg-emerald-400" : "bg-rose-400"}`} />
                                <span>{isHealthy ? "Excellent" : "Unstable"}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {processedResults.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500">
                            No resolvers matched filter
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 bg-white/5 border border-white/10 rounded-3xl text-center space-y-3">
              <Zap className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
              <p className="text-slate-400 font-semibold">No benchmark data available</p>
              <p className="text-slate-500 text-xs">Run a manual query latency benchmark using the button above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
