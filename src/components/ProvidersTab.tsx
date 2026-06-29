import React, { useState } from "react";
import { Globe, Plus, Edit2, Trash2, CheckCircle, XCircle, Sparkles, RefreshCw, Search, ShieldAlert, Check, Star } from "lucide-react";
import { DnsProvider } from "../types";

interface ProvidersTabProps {
  providers: DnsProvider[];
  defaultProviderId: string;
  onAddProvider: (provider: Partial<DnsProvider>) => Promise<void>;
  onUpdateProvider: (id: string, provider: Partial<DnsProvider>) => Promise<void>;
  onDeleteProvider: (id: string) => Promise<void>;
  onSetDefaultProvider: (id: string) => Promise<void>;
  onResetToDefault: () => Promise<void>;
}

export default function ProvidersTab({
  providers,
  defaultProviderId,
  onAddProvider,
  onUpdateProvider,
  onDeleteProvider,
  onSetDefaultProvider,
  onResetToDefault
}: ProvidersTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selected, setSelected] = useState<DnsProvider | null>(null);

  // Toast Notification State
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Forms
  const [name, setName] = useState("");
  const [dohUrl, setDohUrl] = useState("");
  const [ipv4, setIpv4] = useState("");
  const [ipv6, setIpv6] = useState("");
  const [country, setCountry] = useState("US");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [priority, setPriority] = useState(10);
  const [notes, setNotes] = useState("");
  const [icon, setIcon] = useState("");

  const countries = Array.from(new Set(providers.map(p => p.country))).filter(Boolean);

  const filtered = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.doh_url.toLowerCase().includes(search.toLowerCase()) ||
                          (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
                          (p.notes && p.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "" || (statusFilter === "enabled" ? p.enabled : !p.enabled);
    const matchesCountry = countryFilter === "" || p.country === countryFilter;
    return matchesSearch && matchesStatus && matchesCountry;
  });

  const handleOpenAdd = () => {
    setName("");
    setDohUrl("");
    setIpv4("");
    setIpv6("");
    setCountry("US");
    setDescription("");
    setEnabled(true);
    setPriority(10);
    setNotes("");
    setIcon("");
    setIsAddOpen(true);
  };

  const handleOpenEdit = (p: DnsProvider) => {
    setSelected(p);
    setName(p.name);
    setDohUrl(p.doh_url);
    setIpv4(p.ipv4);
    setIpv6(p.ipv6);
    setCountry(p.country);
    setDescription(p.description);
    setEnabled(p.enabled);
    setPriority(p.priority);
    setNotes(p.notes || "");
    setIcon(p.icon || "");
    setIsEditOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dohUrl) return;
    try {
      await onAddProvider({
        name,
        doh_url: dohUrl,
        ipv4,
        ipv6,
        country,
        description,
        enabled,
        priority,
        notes,
        icon
      });
      showToast("success", `DNS Upstream "${name}" added successfully.`);
      setIsAddOpen(false);
    } catch (err: any) {
      showToast("error", err.message || "Failed to add DNS Upstream.");
      console.error("handleAddSubmit failed:", err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await onUpdateProvider(selected.id, {
        name,
        doh_url: dohUrl,
        ipv4,
        ipv6,
        country,
        description,
        enabled,
        priority,
        notes,
        icon
      });
      showToast("success", `DNS Upstream "${name}" updated successfully.`);
      setIsEditOpen(false);
    } catch (err: any) {
      showToast("error", err.message || "Failed to update DNS Upstream.");
      console.error("handleEditSubmit failed:", err);
    }
  };

  const toggleEnabled = async (p: DnsProvider) => {
    try {
      const nextState = !p.enabled;
      await onUpdateProvider(p.id, { enabled: nextState });
      showToast("success", `DNS Upstream "${p.name}" ${nextState ? "enabled" : "disabled"}.`);
    } catch (err: any) {
      showToast("error", err.message || "Failed to toggle upstream status.");
      console.error("toggleEnabled failed:", err);
    }
  };

  // Helper flag mapper
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
    <div className="space-y-6" id="providers-tab">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-2xl border shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300 ${
          toast.type === "success" 
            ? "bg-emerald-950/95 border-emerald-500/30 text-emerald-300" 
            : "bg-rose-950/95 border-rose-500/30 text-rose-300"
        }`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-rose-400" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xl font-extrabold text-white">DNS Upstream Providers</h4>
          <p className="text-xs text-slate-400">Manage multiple global DNS-over-HTTPS (DoH) upstream resolvers with auto-failover backup routing.</p>
        </div>
        <div className="flex items-center space-x-3 self-start sm:self-center">
          <button
            onClick={async () => {
              if (confirm("Reset providers back to default list? Custom resolvers will be removed.")) {
                try {
                  await onResetToDefault();
                  showToast("success", "DNS Upstream providers reset to defaults successfully.");
                } catch (err: any) {
                  showToast("error", err.message || "Failed to reset providers.");
                }
              }
            }}
            className="flex items-center space-x-2 px-3 py-2 bg-white/5 text-slate-300 rounded-lg text-xs font-semibold hover:bg-white/10 transition border border-white/10"
            title="Reset Defaults"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 transition duration-300 shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Provider</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-3xl shadow-xl">
        <div className="flex-grow flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-slate-200">
          <Search className="w-4 h-4 text-slate-500 mr-2" />
          <input
            type="text"
            placeholder="Search upstreams by name, url, or descriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none outline-none focus:ring-0 placeholder-slate-500 text-slate-200 text-sm"
          />
        </div>
        <div className="flex gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="">All Countries</option>
            {countries.map(c => (
              <option key={c} value={c}>{getFlagEmoji(c)} {c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((p) => {
          const isDefault = p.id === defaultProviderId;

          return (
            <div 
              key={p.id} 
              className={`bg-white/5 backdrop-blur-md border rounded-3xl p-6 transition duration-300 flex flex-col justify-between shadow-lg relative overflow-hidden group hover:-translate-y-1 ${
                isDefault ? "border-indigo-500/40 shadow-indigo-950/20" : "border-white/10"
              }`}
            >
              {/* Star corner indicator for Default */}
              {isDefault && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 rounded-bl-xl text-[10px] font-bold flex items-center space-x-1 uppercase tracking-wider shadow-md select-none">
                  <Star className="w-3 h-3 fill-white" />
                  <span>Default</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg select-none">
                    {p.icon ? (
                      <img src={p.icon} alt="" className="w-6 h-6 object-contain rounded" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                    ) : (
                      <Globe className="w-5 h-5 text-indigo-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-white text-base truncate flex items-center space-x-2">
                      <span>{p.name}</span>
                      <span className="text-sm" title={p.country}>{getFlagEmoji(p.country)}</span>
                    </h5>
                    <p className="text-xs text-slate-400 font-mono truncate mt-0.5" title={p.doh_url}>{p.doh_url}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-300 line-clamp-2 h-8 leading-relaxed">
                  {p.description || "No description provided."}
                </p>

                {/* Tech Details */}
                <div className="grid grid-cols-2 gap-2 bg-white/2 rounded-2xl p-2.5 border border-white/5 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 block">Priority:</span>
                    <span className="text-slate-300 font-semibold">{p.priority} (Lower=higher)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Country:</span>
                    <span className="text-slate-300 font-semibold">{p.country}</span>
                  </div>
                  <div className="col-span-2 border-t border-white/5 pt-1.5 mt-1.5">
                    <span className="text-slate-500 block">IPv4 Address:</span>
                    <span className="text-slate-300 font-semibold truncate block" title={p.ipv4}>{p.ipv4 || "None"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">IPv6 Address:</span>
                    <span className="text-slate-300 font-semibold truncate block" title={p.ipv6}>{p.ipv6 || "None"}</span>
                  </div>
                </div>

                {/* Administrator notes */}
                {p.notes && (
                  <div className="bg-amber-950/20 border border-amber-900/30 rounded-2xl p-2.5 text-[11px] text-amber-300/80">
                    <span className="font-bold block text-amber-400 text-[10px] uppercase tracking-wider mb-0.5">Admin Note:</span>
                    <span className="line-clamp-2 leading-relaxed">{p.notes}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                {/* Status Toggle */}
                <button
                  onClick={() => toggleEnabled(p)}
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition duration-300 ${
                    p.enabled
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/60 hover:bg-emerald-950/80"
                      : "bg-rose-950/40 text-rose-400 border-rose-900/60 hover:bg-rose-950/80"
                  }`}
                >
                  {p.enabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  <span>{p.enabled ? "Active" : "Disabled"}</span>
                </button>

                {/* Controls */}
                <div className="flex items-center space-x-2">
                  {!isDefault && p.enabled && (
                    <button
                      onClick={async () => {
                        try {
                          await onSetDefaultProvider(p.id);
                          showToast("success", `Set "${p.name}" as default DNS resolver.`);
                        } catch (err: any) {
                          showToast("error", err.message || "Failed to set default provider.");
                        }
                      }}
                      className="px-2.5 py-1 bg-white/5 text-slate-300 hover:text-white hover:bg-indigo-600 rounded-lg text-xs font-semibold transition border border-white/10"
                      title="Set as Default System Upstream"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition border border-white/10"
                    title="Edit Upstream"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete ${p.name}? This cannot be undone.`)) {
                        try {
                          await onDeleteProvider(p.id);
                          showToast("success", `DNS Upstream "${p.name}" deleted successfully.`);
                        } catch (err: any) {
                          showToast("error", err.message || "Failed to delete upstream.");
                        }
                      }
                    }}
                    className="p-1.5 bg-white/5 hover:bg-rose-950 text-rose-400 hover:text-rose-300 rounded-lg transition border border-white/10"
                    title="Delete Upstream"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 bg-white/5 border border-white/10 rounded-3xl text-center space-y-2">
            <Globe className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-slate-400 font-semibold">No Upstream DNS providers found</p>
            <p className="text-slate-500 text-xs">Try adjusting your filters or click "Reset Defaults" to restore.</p>
          </div>
        )}
      </div>

      {/* ADD DIALOG MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#030712]/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h5 className="text-lg font-bold text-white flex items-center space-x-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                <span>Add DNS Upstream</span>
              </h5>
              <button onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Provider Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Quad9 Unfiltered"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Country ISO Code</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    placeholder="e.g. US, CH, CA"
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">DoH Endpoint URL</label>
                <input
                  type="url"
                  required
                  placeholder="e.g. https://dns.quad9.net/dns-query"
                  value={dohUrl}
                  onChange={(e) => setDohUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">IPv4 Address (Primary)</label>
                  <input
                    type="text"
                    placeholder="e.g. 9.9.9.9"
                    value={ipv4}
                    onChange={(e) => setIpv4(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">IPv6 Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 2620:fe::fe"
                    value={ipv6}
                    onChange={(e) => setIpv6(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Failover Priority Order</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 10)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Lower numbers tried first.</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Provider Icon URL</label>
                  <input
                    type="url"
                    placeholder="Logo URL (optional)"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Upstream Description</label>
                <input
                  type="text"
                  placeholder="Security filtered DNS resolver"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Internal Admin Notes</label>
                <textarea
                  placeholder="Internal notes (limitations, custom routing behaviors)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-semibold hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500"
                >
                  Create Upstream
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DIALOG MODAL */}
      {isEditOpen && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#030712]/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h5 className="text-lg font-bold text-white flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                <span>Edit Upstream Resolver</span>
              </h5>
              <button onClick={() => setIsEditOpen(false)} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Provider Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Country ISO Code</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">DoH Endpoint URL</label>
                <input
                  type="url"
                  required
                  value={dohUrl}
                  onChange={(e) => setDohUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">IPv4 Address</label>
                  <input
                    type="text"
                    value={ipv4}
                    onChange={(e) => setIpv4(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">IPv6 Address</label>
                  <input
                    type="text"
                    value={ipv6}
                    onChange={(e) => setIpv6(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Priority</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 10)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Provider Icon URL</label>
                  <input
                    type="url"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Admin Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-semibold hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
