import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info, QrCode, FileText } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export function DashboardPanel({ recentMessages, logs }) {
    const [showBulletin, setShowBulletin] = useState(() => localStorage.getItem('dashboard.showBulletin') === 'false' ? false : true);
    const [showQR, setShowQR] = useState(() => localStorage.getItem('dashboard.showQR') === 'false' ? false : true);
    const [showLogs, setShowLogs] = useState(() => localStorage.getItem('dashboard.showLogs') === 'false' ? false : true);

    const persist = (key, value) => localStorage.setItem(key, value ? 'true' : 'false');

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

            {/* Removed quick stats: now only in drawer */}

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

            {/* Logs Feed */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 overflow-hidden">
                <button onClick={() => { const v = !showLogs; setShowLogs(v); persist('dashboard.showLogs', v); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-900/60">
                    {showLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span>System Logs</span>
                </button>
                {showLogs && (
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-800 text-[12px]">
                        {logs === null && <div className="px-4 py-3 text-slate-500">(No auth token found for logs)</div>}
                        {Array.isArray(logs) && !logs.length && <div className="px-4 py-3 text-slate-500">No logs available.</div>}
                        {Array.isArray(logs) && logs.map(l => (
                            <div key={l.id || l.timestamp} className="px-4 py-2 flex justify-between gap-3">
                                <span className="text-slate-400 truncate">{l.timestamp || l.created_at}</span>
                                <span className="text-slate-300 flex-1 truncate">{l.message || l.event || JSON.stringify(l)}</span>
                                {l.level && <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 ${l.level === 'error' ? 'text-rose-400' : l.level === 'warn' ? 'text-amber-400' : 'text-emerald-400'}`}>{l.level}</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DashboardPanel;
