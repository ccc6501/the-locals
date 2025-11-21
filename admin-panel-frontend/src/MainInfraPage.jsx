import React, { useState } from "react";
import { Palette, PanelsTopLeft } from "lucide-react";
import ChatOpsNeonShell from "./ChatOpsNeonShell";

const KITS = [
  {
    id: "infra",
    name: "Infra Control Glass",
    category: "Infrastructure",
    description:
      "Dark glass cockpit for monitoring nodes, AI usage, and system health.",
    accent: "#38bdf8",
    gradient: "from-sky-500/80 via-cyan-400/80 to-emerald-400/80",
    notes: "Use for serious ops views and dashboards."
  },
  {
    id: "chatops",
    name: "ChatOps Neon",
    category: "Chat & Agents",
    description:
      "Vibrant neon layout for chat, assistants, and human-in-the-loop workflows.",
    accent: "#a855f7",
    gradient: "from-purple-500/80 via-fuchsia-400/80 to-pink-500/80",
    notes: "Best for conversational surfaces and multi-agent tools."
  },
  {
    id: "secret",
    name: "Secret Vault Slate",
    category: "Security",
    description:
      "Dense grid layout tuned for secrets, credentials, and audit trails.",
    accent: "#22c55e",
    gradient: "from-emerald-500/80 via-lime-400/80 to-teal-500/80",
    notes: "Use for secret manager, keys, and permissions."
  },
  {
    id: "play",
    name: "Playground Aurora",
    category: "Experimental",
    description:
      "Loose, playful gradient shell for experiments, prototypes, and test rigs.",
    accent: "#f97316",
    gradient: "from-orange-500/80 via-amber-400/80 to-rose-400/80",
    notes: "Great for labs, sandboxes, and throwaway tools."
  }
];

export default function MainInfraPage() {
  const [selectedId, setSelectedId] = useState("infra");
  const selected = KITS.find((k) => k.id === selectedId) ?? KITS[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-800/70 backdrop-blur-sm bg-slate-950/70">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs tracking-[0.3em] text-slate-400 uppercase">
              Design Lab Sandbox
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold mt-1 bg-gradient-to-r from-sky-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">
              Ops Chat Console
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Infrastructure Control Center preview — the Local’s control hub language.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-400">
            <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
              System Status
            </span>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 border border-emerald-500/40 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                server online
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                api stable
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                cloud syncing
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left: Kit list */}
        <section className="w-full lg:w-64 flex-shrink-0 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <Palette className="w-4 h-4 text-sky-400" />
            Design Kits
          </div>
          <div className="space-y-2">
            {KITS.map((kit) => {
              const active = kit.id === selected.id;
              return (
                <button
                  key={kit.id}
                  onClick={() => setSelectedId(kit.id)}
                  className={[
                    "w-full text-left p-3 rounded-xl border transition-all cursor-pointer",
                    active
                      ? "border-sky-400/60 bg-slate-900/80 shadow-[0_0_25px_rgba(56,189,248,0.25)]"
                      : "border-slate-800/80 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/70"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-50">
                      {kit.name}
                    </div>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: kit.accent }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                    {kit.category}
                  </div>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                    {kit.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Center: Chat shell preview */}
        <section className="flex-1 flex items-center justify-center">
          <ChatOpsNeonShell />
        </section>

        {/* Right: details */}
        <section className="w-full lg:w-72 flex-shrink-0 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
            <PanelsTopLeft className="w-4 h-4 text-sky-400" />
            Kit Details
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 flex flex-col gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-50">
                {selected.name}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">
                {selected.category}
              </div>
            </div>

            <p className="text-xs text-slate-300">{selected.description}</p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Accent Color</span>
                <span className="inline-flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border border-slate-600"
                    style={{ backgroundColor: selected.accent }}
                  />
                  <span className="text-[11px] text-slate-300 font-mono">
                    {selected.accent}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Use Case</span>
                <span className="text-[11px] text-slate-300">
                  {selected.notes}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
              This sandbox will later feed into:
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Tailscale hub UI</li>
                <li>Secret manager surface</li>
                <li>AI control & metrics</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
