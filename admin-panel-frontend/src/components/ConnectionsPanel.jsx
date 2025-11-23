// ConnectionsPanel.jsx
// Modular connections/settings view for provider configuration.
import React, { useState } from 'react';
import { Cpu, Key, RefreshCw, Cloud, Wifi, Database, Activity } from 'lucide-react';

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
    providerMeta,
    // Cloud
    cloudPath,
    setCloudPath,
    cloudEndpoint,
    setCloudEndpoint,
    // Tailnet
    tailnetStats,
    tailnetLoading,
    tailnetError,
    refreshTailnetStats,
    apiBase
}) {
    const [openaiTestLoading, setOpenaiTestLoading] = useState(false);
    const [openaiTestResult, setOpenaiTestResult] = useState(null);
    const [openaiDebug, setOpenaiDebug] = useState(null);

    async function testOpenAI() {
        if (!openaiKey) {
            setOpenaiTestResult({ status: 'key-missing', message: 'Enter API key first.' });
            return;
        }
        setOpenaiTestLoading(true);
        setOpenaiTestResult(null);
        try {
            const url = `${apiBase || ''}/api/connections/openai/test`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const ct = resp.headers.get('content-type') || '';
            let rawText = '';
            try { rawText = await resp.text(); } catch(_) {}
            let parsed = null;
            if (ct.includes('application/json') && rawText.trim().length) {
                try { parsed = JSON.parse(rawText); } catch(e) {
                    parsed = { status: 'parse-error', message: 'Could not parse JSON', raw: rawText.slice(0,500) };
                }
            } else if (rawText.trim().length) {
                parsed = { status: resp.ok ? 'non-json' : 'error', message: 'Non-JSON response', raw: rawText.slice(0,500), code: resp.status };
            } else {
                parsed = { status: resp.ok ? 'empty-response' : 'error', message: 'Empty response body', code: resp.status };
            }
            // Attach meta
            parsed._meta = { statusCode: resp.status, ok: resp.ok, url };
            setOpenaiTestResult(parsed);
        } catch (e) {
            setOpenaiTestResult({ status: 'error', message: String(e) });
        } finally {
            setOpenaiTestLoading(false);
        }
    }

    async function debugOpenAI() {
        setOpenaiDebug(null);
        try {
            const resp = await fetch(`${apiBase || ''}/api/connections/openai/debug`);
            const data = await resp.json();
            setOpenaiDebug(data);
        } catch (e) {
            setOpenaiDebug({ error: String(e) });
        }
    }
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
                        <select
                            value={openaiModel}
                            onChange={e => setOpenaiModel(e.target.value)}
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
                        >
                            {/* Curated list */}
                            <option value="gpt-4o">gpt-4o</option>
                            <option value="gpt-4.1">gpt-4.1</option>
                            <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                            <option value="o3-mini">o3-mini</option>
                            <option value="o4-mini">o4-mini</option>
                            <option value="text-embedding-3-large">text-embedding-3-large</option>
                            <option value="text-embedding-3-small">text-embedding-3-small</option>
                            <option value="CUSTOM">Custom…</option>
                        </select>
                        {openaiModel === 'CUSTOM' && (
                            <input
                                type="text"
                                placeholder="Enter custom model id"
                                onChange={e => setOpenaiModel(e.target.value)}
                                className="mt-2 w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
                            />
                        )}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={testOpenAI}
                                disabled={openaiTestLoading}
                                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 text-xs hover:bg-slate-700/70 disabled:opacity-50"
                            >
                                <Activity className={`w-3.5 h-3.5 ${openaiTestLoading ? 'animate-spin' : ''}`} />
                                {openaiTestLoading ? 'Testing…' : 'Test OpenAI'}
                            </button>
                            <button
                                type="button"
                                onClick={debugOpenAI}
                                className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 text-xs hover:bg-slate-700/70"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Debug Info
                            </button>
                        </div>
                        {openaiTestResult && (
                            <div className="mt-2 text-[10px] rounded-lg p-2 bg-slate-900/70 border border-slate-800 text-slate-300 whitespace-pre-wrap">
                                Status: {openaiTestResult.status || 'unknown'}
                                {openaiTestResult._meta && <>
                                    <br />HTTP {openaiTestResult._meta.statusCode} ({openaiTestResult._meta.ok ? 'ok' : 'error'})
                                </>}
                                {openaiTestResult.message && <>
                                    <br />{openaiTestResult.message}
                                </>}
                                {openaiTestResult.model && <>
                                    <br />Model: {openaiTestResult.model}
                                </>}
                                {openaiTestResult.tried && Array.isArray(openaiTestResult.tried) && <>
                                    <br />Tried: {openaiTestResult.tried.join(', ')}
                                </>}
                                {openaiTestResult.raw && <>
                                    <br />Raw: {openaiTestResult.raw}
                                </>}
                            </div>
                        )}
                        {openaiDebug && (
                            <div className="mt-2 text-[10px] rounded-lg p-2 bg-slate-900/70 border border-slate-800 text-slate-300 overflow-auto max-h-40">
                                <pre className="m-0 font-mono text-[10px] leading-snug">{JSON.stringify(openaiDebug, null, 2)}</pre>
                            </div>
                        )}
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
                        {ollamaModels.length > 0 ? (
                            <select
                                value={ollamaModel}
                                onChange={e => setOllamaModel(e.target.value)}
                                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
                            >
                                {ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}
                                <option value="CUSTOM">Custom…</option>
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={ollamaModel}
                                onChange={e => setOllamaModel(e.target.value)}
                                placeholder="llama3"
                                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
                            />
                        )}
                        {ollamaModel === 'CUSTOM' && (
                            <input
                                type="text"
                                placeholder="Enter custom model"
                                onChange={e => setOllamaModel(e.target.value)}
                                className="mt-2 w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
                            />
                        )}
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

            {/* Cloud Storage */}
            <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                    <Cloud className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-300">Cloud Storage</span>
                </div>
                <label className="block text-slate-500 mb-1 text-[11px]">Path / Mount</label>
                <input
                    type="text"
                    value={cloudPath}
                    onChange={e => setCloudPath(e.target.value)}
                    placeholder="/mnt/data"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:border-violet-500/70 mb-3"
                />
                <label className="block text-slate-500 mb-1 text-[11px]">Endpoint / Base URL</label>
                <input
                    type="text"
                    value={cloudEndpoint}
                    onChange={e => setCloudEndpoint(e.target.value)}
                    placeholder="http://nas.local:9000"
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-[11px] focus:outline-none focus:border-violet-500/70"
                />
            </div>

            {/* Tailnet */}
            <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                    <Wifi className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-semibold text-slate-300">Tailnet</span>
                    <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${tailnetStats?.status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{tailnetStats?.status || 'unknown'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                    <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                        <div className="text-slate-500">Devices Online</div>
                        <div className="text-slate-300 font-semibold">{tailnetStats?.devices_online ?? '--'}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                        <div className="text-slate-500">Total Devices</div>
                        <div className="text-slate-300 font-semibold">{tailnetStats?.devices_total ?? '--'}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                        <div className="text-slate-500">Exit Node</div>
                        <div className="text-slate-300 font-semibold truncate">{tailnetStats?.exit_node ?? 'none'}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                        <div className="text-slate-500">Last Check</div>
                        <div className="text-slate-300 font-semibold truncate">{tailnetStats?.last_check ?? '--'}</div>
                    </div>
                </div>
                {tailnetError && <div className="text-[10px] text-amber-400 mb-2">{tailnetError}</div>}
                <button
                    type="button"
                    onClick={refreshTailnetStats}
                    disabled={tailnetLoading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 text-xs hover:bg-slate-700/70 disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${tailnetLoading ? 'animate-spin' : ''}`} />
                    {tailnetLoading ? 'Refreshing…' : 'Refresh Tailnet'}
                </button>
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
                <span className="px-2 py-0.5 rounded-md bg-slate-800/70 border border-slate-700 text-slate-300 text-[10px] font-mono ml-auto flex items-center gap-1">
                    <Database className="w-3 h-3 text-slate-500" />
                    {cloudPath || '/mnt/data'}
                </span>
            </div>
        </div>
    );
}

export default ConnectionsPanel;
