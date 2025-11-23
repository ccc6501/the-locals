import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function DashboardPanel({ tailnetStats, systemSummary, recentMessages }) {
  const [showBulletin, setShowBulletin] = useState(true);
  const [showQR, setShowQR] = useState(true);

  const bulletin = `Welcome to The Local Dashboard.\n\nThis hub gives you a quick pulse of your Tailnet, AI activity, and system health. Use the side drawer for live resource gauges. Tabs will grow as more services come online.`;
  const tailnetInviteUrl = window.location.origin; // Placeholder; could become an actual invite URL

  const recentChats = recentMessages.filter(m => m.role === 'user').slice(-8).reverse();

  return (
    <div className="p-6 space-y-6">
      {/* Bulletin */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
        <button onClick={() => setShowBulletin(s => !s)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900/60">
          {showBulletin ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Info className="w-4 h-4 text-violet-400" />
          <span>Intro Bulletin</span>
        </button>
        {showBulletin && (
          <div className="px-4 pb-4 text-[13px] leading-relaxed whitespace-pre-wrap text-slate-300 font-mono">
            {bulletin}
          </div>
        )}
      </div>

      {/* QR Share */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
        <button onClick={() => setShowQR(s => !s)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900/60">
          {showQR ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <QrCode className="w-4 h-4 text-sky-400" />
          <span>Tailnet Access QR</span>
        </button>
        {showQR && (
          <div className="px-4 pb-4 flex items-center gap-6 flex-wrap">
            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
              <QRCodeSVG value={tailnetInviteUrl} size={140} bgColor="#020617" fgColor="#e2e8f0" />
            </div>
            <div className="text-[12px] text-slate-400 max-w-xs">
              Scan to open The Local interface. For secure Tailnet join links, future releases will embed ephemeral invite tokens.
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats Row */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="stat-label">Tailnet Status</div>
          <div className="stat-value text-sky-300">{tailnetStats?.status || 'unknown'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CPU</div>
          <div className="stat-value">{systemSummary?.cpu ?? '--'}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Memory</div>
          <div className="stat-value">{systemSummary?.memory ?? '--'}%</div>
        </div>
      </div>

      {/* Recent Chats */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">Recent Chats</span>
          <span className="text-[10px] text-slate-500">last {recentChats.length} user prompts</span>
        </div>
        <div className="divide-y divide-slate-800">
          {recentChats.map(m => (
            <div key={m.id} className="px-4 py-2 text-[12px] text-slate-300 truncate" title={m.text}>{m.text}</div>
          ))}
          {!recentChats.length && <div className="px-4 py-3 text-[12px] text-slate-500">No recent user messages.</div>}
        </div>
      </div>

      {/* System Notifications Placeholder */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/50">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">System Notifications</span>
          <span className="text-[10px] text-slate-500">placeholder</span>
        </div>
        <div className="px-4 py-3 text-[12px] text-slate-500">Log feed & alerts will appear here once auth tokens are wired.</div>
      </div>
    </div>
  );
}

export default DashboardPanel;
