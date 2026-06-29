import React, { useState } from "react";
import { Shield, Key, CheckCircle, XCircle, Trash2, Edit2, Plus, Calendar, AlertTriangle, FileText, Mail, Info, Copy, Check, Globe, HelpCircle } from "lucide-react";
import { User, DnsProvider } from "../types";

interface UsersTabProps {
  users: User[];
  providers: DnsProvider[];
  onCreateUser: (data: any) => Promise<void>;
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

export default function UsersTab({
  users,
  providers,
  onCreateUser,
  onUpdateUser,
  onDeleteUser
}: UsersTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form Fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [trafficLimit, setTrafficLimit] = useState(50);
  const [expireAt, setExpireAt] = useState("");
  const [notes, setNotes] = useState("");
  const [requestLimit, setRequestLimit] = useState(0);
  const [personalDnsProvider, setPersonalDnsProvider] = useState("");
  const [ipv6Preference, setIpv6Preference] = useState("default");

  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedDoH, setCopiedDoH] = useState<string | null>(null);

  // Filtered list
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.notes && u.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "" || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCopyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleCopyDoHUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedDoH(url);
    setTimeout(() => setCopiedDoH(null), 2000);
  };

  const handleOpenAddModal = () => {
    setUsername("");
    setEmail("");
    setTrafficLimit(50);
    setExpireAt("");
    setNotes("");
    setRequestLimit(0);
    setPersonalDnsProvider("");
    setIpv6Preference("default");
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email) return;
    await onCreateUser({
      username,
      email,
      traffic_limit_gb: trafficLimit,
      expire_at: expireAt || null,
      notes,
      request_limit: requestLimit,
      personal_dns_provider: personalDnsProvider,
      ipv6_preference: ipv6Preference
    });
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (user: User) => {
    setSelectedUser(user);
    setEmail(user.email);
    setTrafficLimit(user.traffic_limit_gb);
    setExpireAt(user.expire_at ? new Date(user.expire_at).toISOString().split("T")[0] : "");
    setNotes(user.notes || "");
    setRequestLimit(user.request_limit || 0);
    setPersonalDnsProvider(user.personal_dns_provider || "");
    setIpv6Preference(user.ipv6_preference || "default");
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    await onUpdateUser(selectedUser.id, {
      email,
      traffic_limit_gb: trafficLimit,
      expire_at: expireAt ? new Date(expireAt).getTime() : null,
      notes,
      request_limit: requestLimit,
      personal_dns_provider: personalDnsProvider,
      ipv6_preference: ipv6Preference
    });
    setIsEditModalOpen(false);
  };

  const toggleUserStatus = async (user: User) => {
    const newStatus = user.status === "enabled" ? "disabled" : "enabled";
    await onUpdateUser(user.id, { status: newStatus });
  };

  return (
    <div className="space-y-6" id="users-tab">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xl font-extrabold text-white">Client User Accounts</h4>
          <p className="text-xs text-slate-400">Add secure profiles to assign custom DNS queries, rules and traffic meters.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 transition duration-300 shadow-md self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Create User</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-3xl shadow-xl">
        <div className="flex-grow">
          <input
            type="text"
            placeholder="Search users by name, email, token or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
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
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-slate-300 text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-6">User Profile</th>
                <th className="py-4 px-6">Connection & Token</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Traffic & Requests</th>
                <th className="py-4 px-6">Expiration</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-sm">
              {filteredUsers.map((user) => {
                const isExpired = user.expire_at ? Date.now() > user.expire_at : false;
                const trafficPercentage = Math.min((user.traffic_used / user.traffic_limit_gb) * 100, 100);
                const isLimitExceeded = user.traffic_used >= user.traffic_limit_gb;
                const isRequestExceeded = user.request_limit && user.request_limit > 0 && user.request_count >= user.request_limit;

                // Find custom DNS provider display name
                const customProvider = providers.find(p => p.id === user.personal_dns_provider);

                return (
                  <tr key={user.id} className="hover:bg-white/5 transition duration-150">
                    {/* User profile info */}
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-bold text-slate-100 flex items-center space-x-2">
                          <span>{user.username}</span>
                          {user.notes && (
                            <div className="group relative">
                              <Info className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-slate-950 text-slate-300 text-[10px] p-2 rounded-lg border border-slate-800 shadow-xl z-30 font-normal">
                                {user.notes}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono flex items-center mt-0.5 space-x-1">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{user.email}</span>
                        </div>
                        {/* Custom indicators */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {user.personal_dns_provider ? (
                            <span className="text-[9px] bg-indigo-950/60 text-indigo-400 border border-indigo-900/40 px-1.5 py-0.5 rounded-md font-semibold flex items-center space-x-1">
                              <Globe className="w-2.5 h-2.5" />
                              <span>DNS: {customProvider ? customProvider.name : user.personal_dns_provider}</span>
                            </span>
                          ) : (
                            <span className="text-[9px] bg-white/5 text-slate-500 border border-white/5 px-1.5 py-0.5 rounded-md font-semibold">
                              DNS: Default Upstream
                            </span>
                          )}
                          {user.ipv6_preference && user.ipv6_preference !== "default" && (
                            <span className="text-[9px] bg-purple-950/60 text-purple-400 border border-purple-900/40 px-1.5 py-0.5 rounded-md font-semibold">
                              IPv6: {user.ipv6_preference.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Token & Connection URLs */}
                    <td className="py-4 px-6 font-mono">
                      <div className="space-y-2 max-w-xs">
                        {/* Token Row */}
                        <div className="flex items-center justify-between bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 text-xs">
                          <span className="text-slate-400 font-semibold select-none">Token:</span>
                          <span className="text-slate-200 truncate mx-2 max-w-[100px]">
                            {user.api_token.substring(0, 8)}••••••••
                          </span>
                          <button
                            onClick={() => handleCopyToken(user.api_token)}
                            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition flex items-center space-x-1"
                            title="Copy API Token"
                          >
                            {copiedToken === user.api_token ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Key className="w-3.5 h-3.5 text-indigo-400" />
                            )}
                          </button>
                        </div>

                        {/* DoH Endpoint Row */}
                        <div className="flex items-center justify-between bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10 text-xs">
                          <span className="text-slate-400 font-semibold select-none mr-2">DoH:</span>
                          <span className="text-slate-300 truncate select-all text-[11px]" title={`${window.location.origin}/dns-query/${user.api_token}`}>
                            {window.location.origin.replace(/^https?:\/\//, "")}/dns-query/{user.api_token.substring(0, 6)}...
                          </span>
                          <button
                            onClick={() => handleCopyDoHUrl(`${window.location.origin}/dns-query/${user.api_token}`)}
                            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition flex items-center space-x-1 ml-2"
                            title="Copy DoH Connection URL"
                          >
                            {copiedDoH === `${window.location.origin}/dns-query/${user.api_token}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-indigo-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6">
                      <button
                        onClick={() => toggleUserStatus(user)}
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border transition duration-300 ${
                          user.status === "enabled"
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-900 hover:bg-emerald-950/85"
                            : "bg-rose-950/40 text-rose-400 border-rose-900 hover:bg-rose-950/85"
                        }`}
                        title="Click to toggle"
                      >
                        {user.status === "enabled" ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Enabled</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Disabled</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Traffic & Requests used progress */}
                    <td className="py-4 px-6">
                      <div className="w-full max-w-[170px] space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className={`${isLimitExceeded ? "text-rose-400 font-semibold" : "text-slate-300"}`}>
                            {user.traffic_used.toFixed(2)}
                          </span>
                          <span className="text-slate-500">/ {user.traffic_limit_gb} GB</span>
                        </div>
                        <div className="w-full bg-white/5 h-2 rounded-full border border-white/10 overflow-hidden relative">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isLimitExceeded
                                ? "bg-rose-500"
                                : trafficPercentage > 90
                                ? "bg-amber-500"
                                : "bg-indigo-500"
                            }`}
                            style={{ width: `${trafficPercentage}%` }}
                          />
                        </div>

                        {/* Request Counts & Limits */}
                        <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between mt-1">
                          <span>Reqs: {user.request_count}</span>
                          {user.request_limit && user.request_limit > 0 ? (
                            <span className={isRequestExceeded ? "text-rose-400 font-bold" : "text-slate-500"}>
                              / {user.request_limit}
                            </span>
                          ) : (
                            <span className="text-slate-600">/ ∞</span>
                          )}
                        </div>

                        {isLimitExceeded && (
                          <div className="flex items-center text-[10px] text-rose-400 font-semibold mt-0.5 space-x-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Limit Exceeded</span>
                          </div>
                        )}
                        {isRequestExceeded && (
                          <div className="flex items-center text-[10px] text-rose-400 font-semibold mt-0.5 space-x-1 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Rate Limit Reached</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Expiration date */}
                    <td className="py-4 px-6 font-mono text-xs">
                      {user.expire_at ? (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span className={isExpired ? "text-rose-400 font-semibold line-through" : "text-slate-300"}>
                            {new Date(user.expire_at).toLocaleDateString()}
                          </span>
                          {isExpired && (
                            <span className="text-[10px] bg-rose-950 text-rose-400 px-1 py-0.5 rounded border border-rose-900 shrink-0 font-semibold">
                              EXPIRED
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Never expires</span>
                      )}
                    </td>

                    {/* Action buttons */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete user "${user.username}"? This will invalidate their token immediately.`)) {
                              onDeleteUser(user.id);
                            }
                          }}
                          className="p-1.5 hover:bg-slate-800 text-rose-400 hover:text-rose-300 rounded-lg transition"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No matching users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE USER DIALOG */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#030712]/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h5 className="text-lg font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                <span>Create DNS Client</span>
              </h5>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Client Identifier / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. janes_laptop"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Only letters, numbers, hyphens, and underscores.</span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Contact Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. jane@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Traffic Limit (GB)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={trafficLimit}
                    onChange={(e) => setTrafficLimit(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Query Limit Count</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={requestLimit}
                    onChange={(e) => setRequestLimit(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">0 = Unlimited queries</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Personal DNS Upstream</label>
                  <select
                    value={personalDnsProvider}
                    onChange={(e) => setPersonalDnsProvider(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Global Default Upstream</option>
                    {providers.filter(p => p.enabled).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-sans">IPv6 Route Rule</label>
                  <select
                    value={ipv6Preference}
                    onChange={(e) => setIpv6Preference(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="default">System Default</option>
                    <option value="prefer_ipv4">Prefer IPv4 Upstreams</option>
                    <option value="prefer_ipv6">Prefer IPv6 Upstreams</option>
                    <option value="ipv4_only">Block IPv6 / IPv4 Only</option>
                    <option value="ipv6_only">Block IPv4 / IPv6 Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Expire Date (Optional)</label>
                  <input
                    type="date"
                    value={expireAt}
                    onChange={(e) => setExpireAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Administrator Notes / Description</label>
                <textarea
                  placeholder="Details about device deployment location, rules configurations..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-semibold hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT USER DIALOG */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#030712]/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in duration-200">
            <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h5 className="text-lg font-bold text-white flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                <span>Edit User Profile</span>
              </h5>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Client ID (Read-only)</label>
                  <input
                    type="text"
                    disabled
                    value={selectedUser.username}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-500 focus:outline-none cursor-not-allowed font-mono"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Traffic Limit (GB)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={trafficLimit}
                    onChange={(e) => setTrafficLimit(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Query Limit Count</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={requestLimit}
                    onChange={(e) => setRequestLimit(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">0 = Unlimited queries</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Personal DNS Upstream</label>
                  <select
                    value={personalDnsProvider}
                    onChange={(e) => setPersonalDnsProvider(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Global Default Upstream</option>
                    {providers.filter(p => p.enabled).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">IPv6 Route Rule</label>
                  <select
                    value={ipv6Preference}
                    onChange={(e) => setIpv6Preference(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="default">System Default</option>
                    <option value="prefer_ipv4">Prefer IPv4 Upstreams</option>
                    <option value="prefer_ipv6">Prefer IPv6 Upstreams</option>
                    <option value="ipv4_only">Block IPv6 / IPv4 Only</option>
                    <option value="ipv6_only">Block IPv4 / IPv6 Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Expire Date</label>
                  <input
                    type="date"
                    value={expireAt}
                    onChange={(e) => setExpireAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Administrator Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
