import React, { useState } from "react";
import { Terminal, Copy, Check, FileCode, Server, Database, Info, HelpCircle } from "lucide-react";

interface DeployTabProps {
  workerCode: string;
  wranglerCode: string;
  schemaCode: string;
  readmeCode: string;
}

export default function DeployTab({
  workerCode,
  wranglerCode,
  schemaCode,
  readmeCode
}: DeployTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"worker" | "wrangler" | "schema" | "readme">("worker");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const getCodeString = () => {
    switch (activeSubTab) {
      case "worker": return workerCode;
      case "wrangler": return wranglerCode;
      case "schema": return schemaCode;
      case "readme": return readmeCode;
    }
  };

  const getFileName = () => {
    switch (activeSubTab) {
      case "worker": return "worker.js";
      case "wrangler": return "wrangler.toml";
      case "schema": return "schema.sql";
      case "readme": return "README.md";
    }
  };

  const handleCopy = () => {
    const text = getCodeString();
    navigator.clipboard.writeText(text);
    setCopiedText(activeSubTab);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="space-y-6" id="deploy-tab">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-xl font-extrabold text-white flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            <span>Deploy to Cloudflare Workers</span>
          </h4>
          <p className="text-xs text-slate-400">Export and copy the complete, verified edge server deployment files directly to your Cloudflare Account.</p>
        </div>
      </div>

      {/* Deployment Tutorial Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/5 border border-white/10 rounded-3xl p-5 text-xs">
        <div className="flex items-start space-x-3">
          <span className="flex items-center justify-center bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 w-6 h-6 rounded-full font-bold font-mono">1</span>
          <div>
            <h6 className="font-bold text-slate-200 mb-0.5">Provision Databases</h6>
            <p className="text-slate-400 leading-relaxed">Run the wrangler commands to instantiate a new Cloudflare D1 database and CACHE_KV namespace in your dashboard.</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
          <span className="flex items-center justify-center bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 w-6 h-6 rounded-full font-bold font-mono">2</span>
          <div>
            <h6 className="font-bold text-slate-200 mb-0.5">Initialize SQL Schemas</h6>
            <p className="text-slate-400 leading-relaxed">Apply the complete schema.sql file directly to your live D1 database to instantiate users, logs, and stats tables.</p>
          </div>
        </div>
        <div className="flex items-start space-x-3 border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-4">
          <span className="flex items-center justify-center bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 w-6 h-6 rounded-full font-bold font-mono">3</span>
          <div>
            <h6 className="font-bold text-slate-200 mb-0.5">Deploy Edge Worker</h6>
            <p className="text-slate-400 leading-relaxed">Run wrangler deploy to push the worker.js script globally, routing DNS-over-HTTPS queries to upstreams at ultra low latencies!</p>
          </div>
        </div>
      </div>

      {/* Tabs and Code Block */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl overflow-hidden flex flex-col h-[520px]">
        {/* Subtabs and Actions bar */}
        <div className="bg-white/5 px-6 py-3 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            {[
              { id: "worker", label: "worker.js", icon: FileCode },
              { id: "wrangler", label: "wrangler.toml", icon: Server },
              { id: "schema", label: "schema.sql", icon: Database },
              { id: "readme", label: "README.md", icon: Info }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border transition duration-200 ${
                    activeSubTab === tab.id
                      ? "bg-white/10 text-white border-white/10 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">{getFileName()}</span>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow transition"
            >
              {copiedText === activeSubTab ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy File</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Text Area Container */}
        <div className="flex-grow overflow-auto bg-slate-950/30 p-6 relative font-mono text-xs text-slate-300 leading-relaxed selection:bg-indigo-500/30">
          <pre className="whitespace-pre">{getCodeString()}</pre>
        </div>
      </div>
    </div>
  );
}
