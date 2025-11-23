import React, { useState } from 'react';
import { Wifi, Server, RefreshCw, XCircle } from 'lucide-react';

export function SystemPanel({ tailnetStats, refreshTailnetStats, exitNodeChanging, setExitNodeChanging }) {
  const [exitNodeInput, setExitNodeInput] = useState('');
  const [actionMessage, setActionMessage] = useState(null);

  const applyExitNode = async (disable=false) => {
    setExitNodeChanging(true);
    setActionMessage(null);
    try {
      const body = disable ? { action: 'disable' } : { action: 'enable', nodeId: exitNodeInput.trim() };
      const res = await fetch('/api/system/tailscale/exitnode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.status === 'ok') {
        setActionMessage('Exit node updated');
        await refreshTailnetStats();
      } else {
        setActionMessage(data.error || 'Failed');
      }
    } catch (e) {
      setActionMessage(e.message);
    } finally {
      setExitNodeChanging(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Wifi className="w-4 h-4" />Tailnet Controls</h2>
        <div className="grid sm:grid-cols-3 gap-3 text-[12px]">
          <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
            <div className="text-slate-500">Status</div>
            <div className="font-semibold text-slate-300">{tailnetStats?.status || 'unknown'}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
            <div className="text-slate-500">Devices Online</div>
            <div className="font-semibold text-slate-300">{tailnetStats?.devices_online ?? '--'}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
            <div className="text-slate-500">Exit Node</div>
            <div className="font-semibold text-slate-300 truncate">{tailnetStats?.exit_node ?? 'none'}</div>
          </div>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-[10px] mb-1 text-slate-500">Exit Node (IP or name)</label>
            <input value={exitNodeInput} onChange={e=>setExitNodeInput(e.target.value)} placeholder="100.x.y.z or hostname" className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-violet-500/70" />
          </div>
          <button disabled={!exitNodeInput.trim()|| exitNodeChanging} onClick={()=>applyExitNode(false)} className="px-3 py-2 rounded-lg text-[12px] font-semibold bg-violet-600/80 hover:bg-violet-600 text-white disabled:opacity-40 flex items-center gap-1"><Server className="w-3.5 h-3.5" />Set</button>
          <button disabled={exitNodeChanging} onClick={()=>applyExitNode(true)} className="px-3 py-2 rounded-lg text-[12px] font-semibold bg-slate-800/70 border border-slate-700 hover:bg-slate-700/70 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Disable</button>
        </div>
        {actionMessage && <div className="text-[11px] text-slate-400">{actionMessage}</div>}
        <div className="pt-2 flex justify-end">
          <button onClick={refreshTailnetStats} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-300 text-[12px] hover:bg-slate-700/70"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
        </div>
      </div>
    </div>
  );
}

export default SystemPanel;
