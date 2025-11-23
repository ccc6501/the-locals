// ConnectionsPanel.jsx
// Modular connections/settings view for provider configuration.
import React from 'react';
import { Cpu, Key, RefreshCw } from 'lucide-react';

const formatModel = (m) => {
  if (!m) return '';
  return m.length > 18 ? m.slice(0, 15) + '…' : m;
};

export function ConnectionsPanel({
  provider,
  setProvider,
  openaiKey,
  setOpenaiKey,
  openaiModel,
  setOpenaiModel,
  ollamaUrl,
  setOllamaUrl,
  ollamaModel,
  setOllamaModel,
  ollamaModels,
  ollamaModelsLoading,
  refreshOllamaModels,
  temp,
  setTemp,
  providerMeta
}) {
  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Cpu className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-semibold">Connections</h2>
        <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 ${providerMeta?.color || 'text-slate-300'}`}>{providerMeta?.label}</span>
      </div>

      {/* Provider Toggle */}
      <div>
        <span className="block text-slate-500 mb-2 text-xs">Provider</span>
        <div className="inline-flex rounded-lg overflow-hidden border border-slate-700 bg-slate-900/60">
          <button
            onClick={() => setProvider('openai')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${provider === 'openai' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800/70'}`}
          >OpenAI</button>
          <button
            onClick={() => setProvider('ollama')}
            className={`px-4 py-2 text-xs font-medium transition-colors ${provider === 'ollama' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800/70'}`}
          >Ollama</button>
        </div>
      </div>

      {/* Dynamic Provider Config */}
      {provider === 'openai' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-slate-500 mb-1 text-xs">API Key</label>
            <div className="relative">
              <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="password"
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-8 py-2 text-xs focus:outline-none focus:border-violet-500/70"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-500 mb-1 text-xs">Model</label>
            <input
              type="text"
              value={openaiModel}
              onChange={e => setOpenaiModel(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-slate-500 mb-1 text-xs">Ollama URL</label>
            <input
              type="text"
              value={ollamaUrl}
              onChange={e => setOllamaUrl(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1 text-xs">Model</label>
            <input
              type="text"
              value={ollamaModel}
              onChange={e => setOllamaModel(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
              list="ollama-model-list"
            />
            <datalist id="ollama-model-list">
              {ollamaModels.map(m => <option key={m} value={m} />)}
            </datalist>
            <button
              onClick={refreshOllamaModels}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 text-xs hover:bg-slate-700/70"
              disabled={ollamaModelsLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ollamaModelsLoading ? 'animate-spin' : ''}`} />
              {ollamaModelsLoading ? 'Loading Models...' : 'Refresh Models'}
            </button>
          </div>
        </div>
      )}

      {/* Temperature */}
      <div>
        <span className="block text-slate-500 mb-1 text-xs">Temperature: <span className="text-slate-300 font-mono">{temp.toFixed(2)}</span></span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={temp}
          onChange={e => setTemp(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full bg-slate-800 appearance-none cursor-pointer"
        />
      </div>

      {/* Summary footer */}
      <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-4 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-300">Active:</span>
        <span className="px-2 py-0.5 rounded-md bg-slate-800/70 border border-slate-700 text-slate-300 text-[10px] font-mono">
          {provider === 'openai' ? formatModel(openaiModel) : formatModel(ollamaModel)}
        </span>
        {provider === 'openai' && (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${openaiKey ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/30' : 'bg-amber-500/20 text-amber-300 border border-amber-600/30'}`}>{openaiKey ? 'Key Set' : 'Key Missing'}</span>
        )}
        {provider === 'ollama' && (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${ollamaModels.length ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/30' : 'bg-slate-700/40 text-slate-400 border border-slate-700/60'}`}>{ollamaModels.length ? `${ollamaModels.length} models` : 'No models'}</span>
        )}
      </div>
    </div>
  );
}

export default ConnectionsPanel;
