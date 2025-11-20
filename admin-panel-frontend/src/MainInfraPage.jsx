import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  Palette,
  Zap,
  Wifi,
  Key,
  Users
} from 'lucide-react';
import { DESIGN_KITS } from './designKits';

// ---- ROOT PAGE -------------------------------------------------------------

const MainInfraPage = () => {
  const [activeKitId, setActiveKitId] = useState('locl-ui-kit-v1');
  const [activeScene, setActiveScene] = useState('secrets-modal'); // 'chat-snippet' | 'admin-card'

  const activeKit =
    DESIGN_KITS.find((k) => k.id === activeKitId) || DESIGN_KITS[0];

  const handleExport = () => {
    // hook into your real export logic later
    alert('Export data would run here');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* HEADER */}
        <header className="rounded-2xl bg-slate-900/70 border border-slate-800/70 backdrop-blur-xl px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">
              Secrets & Infrastructure Manager
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-1 bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
              Infrastructure Control Center
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Manage secrets, Tailscale, AI assistants, subscriptions & design
              kits in one place.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700/80 hover:border-slate-500/70 transition-all active:scale-95 text-xs md:text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Export Data
            </button>
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
              <Palette className="w-3 h-3" />
              Active kit:
              <span className="text-slate-200 ml-1">{activeKit.name}</span>
            </div>
          </div>
        </header>

        {/* DESIGN STAGE ROW */}
        <section className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)] gap-4 md:gap-6 items-start">
          {/* LEFT: KIT LIST */}
          <DesignKitList
            activeKitId={activeKitId}
            onChangeKit={setActiveKitId}
          />

          {/* RIGHT: PHONE STAGE */}
          <DesignStage
            kit={activeKit}
            activeScene={activeScene}
            onChangeScene={setActiveScene}
          />
        </section>

        {/* DATA TABS (placeholder) */}
        <section className="mt-4">
          <InfraTabsShell />
        </section>
      </div>
    </div>
  );
};

// ---- DESIGN KIT LIST (LEFT COLUMN) -----------------------------------------

const DesignKitList = ({ activeKitId, onChangeKit }) => {
  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 backdrop-blur-xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" />
            Design Kits & Layouts
          </h2>
          <p className="text-[11px] text-slate-500">
            Pick a kit to preview on the stage.
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
        {DESIGN_KITS.map((kit) => {
          const active = kit.id === activeKitId;
          return (
            <button
              key={kit.id}
              type="button"
              onClick={() => onChangeKit(kit.id)}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition-all cursor-pointer flex items-start gap-3 ${
                active
                  ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/60 shadow-lg shadow-purple-500/25'
                  : 'bg-slate-900/60 border border-slate-800/80 hover:border-slate-600/80'
              }`}
            >
              <div
                className="mt-1 w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-[10px] font-semibold"
                style={{
                  backgroundImage: `linear-gradient(to bottom right, ${kit.accent1}, ${kit.accent2})`
                }}
              >
                UI
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">
                    {kit.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    v{kit.version}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                  {kit.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-top border-slate-800/80">
        <p className="text-[11px] text-slate-500">
          Design kits are also stored as assets in your tracker, so you can
          reuse them across new projects.
        </p>
      </div>
    </div>
  );
};

// ---- STAGE (RIGHT COLUMN) --------------------------------------------------

const SCENE_OPTIONS = [
  { id: 'secrets-modal', label: 'Secrets modal', icon: Key },
  { id: 'chat-snippet', label: 'Chat bubble', icon: Zap },
  { id: 'admin-card', label: 'Status card', icon: Wifi }
];

const DesignStage = ({ kit, activeScene, onChangeScene }) => {
  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 backdrop-blur-xl p-4 flex flex-col gap-3">
      {/* scene selector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Smartphone className="w-4 h-4 text-blue-400" />
          <span>Stage preview</span>
        </div>
        <div className="inline-flex rounded-full bg-slate-900/80 border border-slate-800/90 p-1 text-[11px]">
          {SCENE_OPTIONS.map((scene) => {
            const active = scene.id === activeScene;
            const Icon = scene.icon;
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => onChangeScene(scene.id)}
                className={
                  'flex items-center gap-1 px-2.5 py-1 rounded-full transition-all ' +
                  (active
                    ? 'bg-gradient-to-r from-purple-600/80 to-blue-600/80 text-white shadow shadow-purple-500/40'
                    : 'text-slate-400 hover:text-slate-100')
                }
              >
                <Icon className="w-3 h-3" />
                {scene.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* phone body */}
      <div className="w-full flex justify-center pt-1 pb-2">
        <div className="relative">
          {/* phone shell */}
          <div className="w-[280px] h-[520px] rounded-[32px] bg-slate-950 border border-slate-800 shadow-[0_30px_80px_rgba(0,0,0,0.75)] overflow-hidden">
            {/* fake notch / status bar */}
            <div className="h-8 flex items-center justify-center">
              <div className="w-24 h-5 bg-slate-900 rounded-full" />
            </div>

            {/* screen */}
            <div className="h-[calc(100%-2rem)] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
              <StageScreen kit={kit} scene={activeScene} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- WHAT SHOWS ON THE PHONE -----------------------------------------------

const StageScreen = ({ kit, scene }) => {
  const gradientStyle = {
    backgroundImage: `linear-gradient(135deg, ${kit.accent1}, ${kit.accent2})`
  };

  if (scene === 'secrets-modal') {
    return (
      <div className="relative w-full h-full px-4 pt-3 pb-4 text-[11px]">
        {/* background header */}
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">
            Control Center
          </div>
          <h2
            className="text-xl font-bold bg-clip-text text-transparent"
            style={gradientStyle}
          >
            Infrastructure
            <br />
            Control Center
          </h2>
          <p className="mt-1 text-[10px] text-slate-500">
            Manage secrets, networks, AI assistants & subscriptions.
          </p>
        </div>

        {/* Add Secret button */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-[11px] font-semibold text-slate-100">
            API Keys & Secrets
          </span>
          <button
            className="px-3 py-1.5 rounded-full text-[10px] font-semibold text-white shadow-md"
            style={gradientStyle}
          >
            + Add Secret
          </button>
        </div>

        {/* centered modal */}
        <div className="mt-3 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-xl shadow-black/70 px-3 py-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] font-semibold">Add Secret</div>
            <button className="text-slate-500 text-xs">✕</button>
          </div>

          {[
            'Service Name (e.g., OpenAI, Stripe)',
            'Key Name (e.g., Production API Key)',
            'Key Value',
            'API URL (optional, for verification)',
            'Notes (optional)'
          ].map((placeholder, idx) => (
            <div key={idx}>
              <input
                className="w-full px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/80 text-[10px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/60"
                placeholder={placeholder}
              />
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 py-1.5 rounded-xl font-semibold text-[11px] text-white"
              style={gradientStyle}
            >
              Add
            </button>
            <button className="flex-1 py-1.5 rounded-xl font-semibold text-[11px] text-slate-200 bg-slate-800/80 border border-slate-700/80">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (scene === 'chat-snippet') {
    return (
      <div className="w-full h-full flex flex-col justify-end gap-2 px-4 pb-4">
        <div className="self-start max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-800/90 border border-slate-700/80 px-3 py-2 text-[11px] text-slate-100">
          <div>System status please</div>
          <div className="mt-1 text-[9px] text-slate-500">12:47 PM</div>
        </div>
        <div
          className="self-end max-w-[80%] rounded-2xl rounded-tr-sm px-3 py-2 text-[11px] text-white shadow-lg"
          style={gradientStyle}
        >
          <div>All hubs online, 1 AI, 0 alerts.</div>
          <div className="mt-1 text-[9px] text-white/70 text-right">
            12:47 PM
          </div>
        </div>
      </div>
    );
  }

  // admin-card scene
  return (
    <div className="w-full h-full px-4 pt-4 pb-4 flex flex-col gap-3 text-[11px]">
      <div className="flex gap-2">
        <div className="flex-1 rounded-2xl bg-slate-900/90 border border-slate-700/80 px-3 py-2">
          <div className="text-[10px] text-slate-500 mb-1">Server</div>
          <div className="text-sm font-semibold">Home hub</div>
          <div className="text-[10px] text-emerald-400 mt-1">
            Uptime: 3d 1h 57m
          </div>
        </div>
        <div className="flex-1 rounded-2xl bg-slate-900/90 border border-slate-700/80 px-3 py-2">
          <div className="text-[10px] text-slate-500 mb-1">Network</div>
          <div className="text-sm font-semibold">Tailscale</div>
          <div className="text-[10px] text-emerald-400 mt-1">
            Connected • 1 ms
          </div>
        </div>
      </div>
      <div className="mt-auto text-[10px] text-slate-500">
        Previewing <span className="text-slate-200">{kit.name}</span> on admin
        tiles.
      </div>
    </div>
  );
};

// ---- TABS SHELL (BOTTOM) ---------------------------------------------------

const InfraTabsShell = () => {
  const [tab, setTab] = useState('secrets'); // 'secrets' | 'tailscale' | 'ai' | 'subs'

  const tabs = [
    { id: 'secrets', label: 'Secrets', icon: Key },
    { id: 'tailscale', label: 'Tailscale', icon: Wifi },
    { id: 'ai', label: 'AI Assistants', icon: Zap },
    { id: 'subs', label: 'Subscriptions', icon: Users }
  ];

  return (
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 backdrop-blur-xl p-4 space-y-4">
      <div className="inline-flex rounded-full bg-slate-950/70 border border-slate-800/80 p-1 text-xs">
        {tabs.map((t) => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ' +
                (active
                  ? 'bg-gradient-to-r from-purple-600/80 to-blue-600/80 text-white'
                  : 'text-slate-400 hover:text-slate-100')
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-800/70 pt-3 text-xs text-slate-400">
        {/* Replace with your real content later */}
        {tab === 'secrets' && <div>Secrets list goes here.</div>}
        {tab === 'tailscale' && <div>Tailscale devices/users go here.</div>}
        {tab === 'ai' && <div>AI assistants & usage go here.</div>}
        {tab === 'subs' && <div>Subscriptions & costs go here.</div>}
      </div>
    </div>
  );
};

export default MainInfraPage;
