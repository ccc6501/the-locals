// admin-panel-frontend/src/ChatOpsConsoleClean.jsx
// Clean, stable chat console with provider toggle & persistence

import React, { useState, useEffect, useRef } from 'react';
import {
    Bot,
    Menu,
    MessageSquare,
    Home,
    Share2,
    BarChart3,
    User,
    UserCircle,
    Cloud,
    Wifi,
    RefreshCw,
    Settings,
    Key,
    Cpu,
    X
} from 'lucide-react';

// ---------------- Helpers ----------------
const getApiBase = () => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return `http://${hostname}:8000`;
    return 'http://localhost:8000';
};
const API_BASE = getApiBase();

const getUserColor = (userName) => {
    if (!userName) return 'from-violet-500 to-sky-500';
    const colors = [
        'from-violet-500 to-sky-500', 'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
        'from-amber-500 to-orange-500', 'from-cyan-500 to-blue-500', 'from-fuchsia-500 to-purple-500',
        'from-lime-500 to-green-500', 'from-indigo-500 to-violet-500'
    ];
    let hash = 0;
    for (let i = 0; i < userName.length; i++) hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const getDisplayText = (message) => {
    if (!message) return '';
    if (typeof message === 'string') return message;
    if (message.text && typeof message.text === 'string') return message.text;
    if (message.content && typeof message.content === 'string') return message.content;
    if (typeof message === 'object') {
        if (Array.isArray(message.choices)) {
            const content = message.choices[0]?.message?.content;
            if (content && typeof content === 'string') return content;
        }
        if (message.answer && typeof message.answer === 'string') return message.answer;
    }
    return '[unreadable response]';
};

// ---------------- Component ----------------
const ChatOpsConsoleClean = () => {
    // Messages (load persisted history if available)
    const loadInitialMessages = () => {
        try {
            const raw = localStorage.getItem('theLocal.chatMessages');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse stored messages', e);
        }
        return [{
            id: 'welcome',
            role: 'assistant',
            authorTag: 'TL',
            text: 'Hey! Welcome to The Local — your Tailnet hangout. Ask me anything or just vibe.',
            createdAt: new Date().toISOString(),
        }];
    };
    const [messages, setMessages] = useState(loadInitialMessages);
    const [draftMessage, setDraftMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);

    // View management
    const [activeView, setActiveView] = useState('chat');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Provider / model persistence
    const [provider, setProvider] = useState(() => localStorage.getItem('theLocal.provider') || 'openai');
    const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('chatops_openai_key') || '');
    const [openaiModel, setOpenaiModel] = useState(() => localStorage.getItem('chatops_openai_model') || 'gpt-4o');
    const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('chatops_ollama_url') || 'http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('theLocal.ollamaModel') || 'llama3');
    const [ollamaModels, setOllamaModels] = useState([]);
    const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
    const [temp, setTemp] = useState(0.7);

    // Status tracking
    const [lastChatOk, setLastChatOk] = useState(null);
    const [tailnetStatus, setTailnetStatus] = useState(null);
    const [ollamaStatus, setOllamaStatus] = useState(null);
    const [error, setError] = useState(null);

    // Provider status meta (for color-coded provider name)
    const getProviderStatusMeta = () => {
        if (provider === 'openai') {
            if (!openaiKey) return { label: 'KEY?', color: 'text-amber-300' };
            if (lastChatOk === true) return { label: 'OK', color: 'text-emerald-300' };
            if (lastChatOk === false) return { label: 'FAIL', color: 'text-rose-300' };
            return { label: 'WAIT', color: 'text-slate-300' };
        } else {
            if (ollamaStatus === 'online') return { label: 'OK', color: 'text-emerald-300' };
            if (ollamaStatus === 'offline') return { label: 'DOWN', color: 'text-amber-300' };
            return { label: 'WAIT', color: 'text-slate-300' };
        }
    };
    const providerMeta = getProviderStatusMeta();

    // Persistence effects
    useEffect(() => localStorage.setItem('theLocal.provider', provider), [provider]);
    useEffect(() => localStorage.setItem('chatops_openai_key', openaiKey), [openaiKey]);
    useEffect(() => localStorage.setItem('chatops_openai_model', openaiModel), [openaiModel]);
    useEffect(() => localStorage.setItem('chatops_ollama_url', ollamaUrl), [ollamaUrl]);
    useEffect(() => localStorage.setItem('theLocal.ollamaModel', ollamaModel), [ollamaModel]);

    // Scroll to bottom on message change
    useEffect(() => { const c = messagesContainerRef.current; if (c) c.scrollTop = c.scrollHeight; }, [messages]);

    // Persist messages (last 200)
    useEffect(() => {
        try {
            const toStore = messages.slice(-200).map(m => ({
                id: m.id,
                role: m.role,
                authorTag: m.authorTag,
                text: m.text,
                createdAt: m.createdAt
            }));
            localStorage.setItem('theLocal.chatMessages', JSON.stringify(toStore));
        } catch (e) { console.warn('Failed to persist chat messages', e); }
    }, [messages]);

    // Initial status boot
    useEffect(() => { refreshOllamaModels(); setTailnetStatus('online'); }, []);

    const refreshOllamaModels = async () => {
        setOllamaModelsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/chat/ollama/models?base_url=${encodeURIComponent(ollamaUrl)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setOllamaModels(data.models || []);
            setOllamaStatus('online');
            if (data.models?.length && !data.models.includes(ollamaModel)) setOllamaModel(data.models[0]);
        } catch (e) {
            console.error(e); setOllamaStatus('offline'); setOllamaModels([]);
        } finally { setOllamaModelsLoading(false); }
    };

    const sendMessageToBackend = async (text) => {
        let effectiveProvider = provider;
        if (provider === 'openai' && !openaiKey) effectiveProvider = 'ollama';
        let selectedModel = effectiveProvider === 'openai' ? openaiModel : ollamaModel;
        if (effectiveProvider === 'ollama' && (!selectedModel || !ollamaModels.includes(selectedModel))) {
            effectiveProvider = 'openai';
            selectedModel = openaiModel;
        }
        const payload = {
            message: text,
            provider: effectiveProvider,
            temperature: temp,
            config: effectiveProvider === 'openai'
                ? { api_key: openaiKey || undefined, model: selectedModel }
                : { base_url: ollamaUrl, model: selectedModel }
        };
        const res = await fetch(`${API_BASE}/api/chat/chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    };

    const handleSend = async () => {
        const text = draftMessage.trim();
        if (!text || isSending) return;
        setIsSending(true);
        const userMsg = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, role: 'user', authorTag: 'CC', text, createdAt: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setDraftMessage('');
        if (inputRef.current) setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
        try {
            const reply = await sendMessageToBackend(text);
            const assistantText = getDisplayText(reply);
            const assistantMsg = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, role: 'assistant', authorTag: 'TL', text: assistantText, createdAt: new Date().toISOString() };
            setMessages(prev => [...prev, assistantMsg]);
            setLastChatOk(true);
        } catch (err) {
            console.error(err); setError(err.message); setLastChatOk(false);
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', authorTag: 'TL', text: '⚠️ Failed: ' + (err.message || err), createdAt: new Date().toISOString() }]);
        } finally { setIsSending(false); }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

    const renderMessages = () => (
        <div className="space-y-3">
            {messages.map(m => {
                const isUser = m.role === 'user';
                const userColor = m.user_name ? getUserColor(m.user_name) : 'from-violet-500 to-sky-500';
                const text = getDisplayText(m);
                return (
                    <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`bubble-avatar ${isUser ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : ''}`}>{m.authorTag}</div>
                        <div className={`bubble-content ${isUser ? 'user-bubble-content bg-gradient-to-r ' + userColor : ''}`}>
                            <div className="bubble-text whitespace-pre-wrap leading-relaxed">{text}</div>
                        </div>
                    </div>
                );
            })}
            {isSending && (
                <div className="assistant-bubble">
                    <div className="bubble-avatar">TL</div>
                    <div className="bubble-content"><div className="bubble-text">Thinking…</div></div>
                </div>
            )}
        </div>
    );

    const ViewPlaceholder = ({ view }) => (
        <div className="px-4 py-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                {view === 'dashboard' && <Home className="w-5 h-5" />}
                {view === 'connections' && <Share2 className="w-5 h-5" />}
                {view === 'cloud' && <Cloud className="w-5 h-5" />}
                {view === 'stats' && <BarChart3 className="w-5 h-5" />}
                {view === 'system' && <User className="w-5 h-5" />}
                {view === 'profile' && <UserCircle className="w-5 h-5" />}
                {view === 'settings' && <Settings className="w-5 h-5" />}
                <span className="capitalize">{view}</span>
            </h2>
            <div className="text-sm text-slate-400">This is a restored placeholder for the <span className="font-semibold text-slate-200">{view}</span> view.</div>
            {view === 'connections' && (
                <div className="space-y-3 text-xs">
                    <div>
                        <span className="block text-slate-500 mb-1">Provider</span>
                        <div className="flex gap-2">
                            <button onClick={() => setProvider('openai')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${provider === 'openai' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-slate-800/70 border border-slate-700 text-slate-300'}`}>OpenAI</button>
                            <button onClick={() => setProvider('ollama')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${provider === 'ollama' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-slate-800/70 border border-slate-700 text-slate-300'}`}>Ollama</button>
                        </div>
                    </div>
                    {provider === 'openai' && (
                        <div>
                            <label className="block text-slate-500 mb-1">API Key</label>
                            <div className="relative">
                                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                                <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-..." className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-8 py-2 text-xs focus:outline-none focus:border-violet-500/70" />
                            </div>
                            <label className="block text-slate-500 mt-3 mb-1">Model</label>
                            <input type="text" value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70" />
                        </div>
                    )}
                    {provider === 'ollama' && (
                        <div>
                            <label className="block text-slate-500 mb-1">Ollama URL</label>
                            <input type="text" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70" />
                            <label className="block text-slate-500 mt-3 mb-1">Model</label>
                            <input type="text" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70" />
                            <button onClick={refreshOllamaModels} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 text-xs hover:bg-slate-700/70">
                                <RefreshCw className={`w-3.5 h-3.5 ${ollamaModelsLoading ? 'animate-spin' : ''}`} /> Refresh Models
                            </button>
                        </div>
                    )}
                    <div className="mt-4">
                        <span className="block text-slate-500 mb-1">Temperature</span>
                        <input type="range" min="0" max="1" step="0.01" value={temp} onChange={e => setTemp(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full bg-slate-800 appearance-none cursor-pointer" />
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="chat-app-root">
            <header className="chat-app-header flex items-center justify-between sticky top-0 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center shadow-lg"><Bot className="w-5 h-5 text-white" /></div>
                    <div>
                        <div className="text-sm font-bold tracking-tight">The Local</div>
                        <div className="text-[10px] text-slate-400 font-medium">Tailnet Hangout</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setProvider(prev => prev === 'openai' ? 'ollama' : 'openai')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors active:scale-[0.97] bg-slate-800/60 border-slate-700/60 hover:bg-slate-700/60"
                        aria-label="Toggle AI provider"
                    >
                        <Cpu className="w-3.5 h-3.5 text-slate-300" />
                        <span className={`hidden sm:inline font-semibold ${providerMeta.color}`}>{provider === 'openai' ? 'OpenAI' : 'Ollama'}</span>
                        <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/50 text-slate-300">{providerMeta.label}</span>
                    </button>
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors select-none ${tailnetStatus === 'online' ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' : tailnetStatus === 'offline' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'}`}>
                        <Wifi className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Tailnet</span>
                        <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/50">{tailnetStatus === 'online' ? 'OK' : tailnetStatus === 'offline' ? 'DOWN' : 'WAIT'}</span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(true)} className="h-10 w-10 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center" aria-label="Open drawer">
                        <Menu className="w-4 h-4 text-slate-100" />
                    </button>
                </div>
            </header>

            {mobileMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-black/55 backdrop-blur-md z-40" onClick={() => setMobileMenuOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-72 bg-slate-900/65 backdrop-blur-xl border-r border-slate-800/70 shadow-2xl z-50 flex flex-col">
                        <div className="p-4 flex-none flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                                <span className="text-sm font-semibold">Views</span>
                            </div>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-800/60"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <div className="px-4 pb-3 space-y-2 text-[11px] text-slate-400 flex-1 overflow-y-auto">
                            <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <Wifi className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Tailnet: <span className={`font-semibold ${tailnetStatus === 'online' ? 'text-emerald-400' : 'text-slate-500'}`}>{tailnetStatus || 'unknown'}</span></span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <Cpu className="w-3.5 h-3.5 text-slate-500" />
                                    <span>AI: <span className={`font-semibold ${lastChatOk ? 'text-emerald-400' : 'text-slate-500'}`}>{lastChatOk === true ? 'online' : lastChatOk === false ? 'issue' : 'idle'}</span></span>
                                </div>
                            </div>
                        </div>
                        <nav className="p-4 flex-none space-y-2 border-t border-slate-800/60 bg-slate-950/50 backdrop-blur-md">
                            {['dashboard', 'chat', 'connections', 'cloud', 'stats', 'system', 'profile', 'settings'].map(view => (
                                <button key={view} onClick={() => { setActiveView(view); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${activeView === view ? 'bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800/70'}`}>
                                    {view === 'dashboard' && <Home className="w-5 h-5" />}
                                    {view === 'chat' && <MessageSquare className="w-5 h-5" />}
                                    {view === 'connections' && <Share2 className="w-5 h-5" />}
                                    {view === 'cloud' && <Cloud className="w-5 h-5" />}
                                    {view === 'stats' && <BarChart3 className="w-5 h-5" />}
                                    {view === 'system' && <User className="w-5 h-5" />}
                                    {view === 'profile' && <UserCircle className="w-5 h-5" />}
                                    {view === 'settings' && <Settings className="w-5 h-5" />}
                                    <span className="capitalize">{view}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </>
            )}

            <main className="chat-app-main">
                <div className="chat-scroll-area" ref={messagesContainerRef}>
                    {activeView === 'chat' ? renderMessages() : <ViewPlaceholder view={activeView} />}
                </div>
                {activeView === 'chat' && (
                    <div className="chat-input-wrapper">
                        <div className="chat-input-inner">
                            <textarea
                                className="chat-input-field"
                                rows={1}
                                placeholder="Message the room..."
                                value={draftMessage}
                                onChange={e => setDraftMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                ref={inputRef}
                            />
                            <button
                                className="chat-send-button"
                                disabled={isSending || !draftMessage.trim()}
                                onClick={handleSend}
                                aria-label="Send message"
                            >
                                <span className="chat-send-icon">➤</span>
                            </button>
                        </div>
                        {error && <div className="mt-2 text-[11px] text-red-400 px-1">Error: {error}</div>}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ChatOpsConsoleClean;// admin-panel-frontend/src/ChatOpsConsoleClean.jsx
// Clean, stable chat console with provider toggle & persistence

import React, { useState, useEffect, useRef } from 'react';
import {
    Bot,
    Menu,
    MessageSquare,
    Home,
    Share2,
    BarChart3,
    User,
    UserCircle,
    Cloud,
    Wifi,
    RefreshCw,
    Settings,
    Key,
    Cpu,
    X
} from 'lucide-react';

// ---------------- Helpers ----------------
const getApiBase = () => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return `http://${hostname}:8000`;
    return 'http://localhost:8000';
};
const API_BASE = getApiBase();

const getUserColor = (userName) => {
    if (!userName) return 'from-violet-500 to-sky-500';
    const colors = [
        'from-violet-500 to-sky-500', 'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
        'from-amber-500 to-orange-500', 'from-cyan-500 to-blue-500', 'from-fuchsia-500 to-purple-500',
        'from-lime-500 to-green-500', 'from-indigo-500 to-violet-500'
    ];
    let hash = 0;
    for (let i = 0; i < userName.length; i++) hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const getDisplayText = (message) => {
    if (!message) return '';
    if (typeof message === 'string') return message;
    if (message.text && typeof message.text === 'string') return message.text;
    if (message.content && typeof message.content === 'string') return message.content;
    if (typeof message === 'object') {
        if (Array.isArray(message.choices)) {
            const content = message.choices[0]?.message?.content;
            if (content && typeof content === 'string') return content;
        }
        if (message.answer && typeof message.answer === 'string') return message.answer;
    }
    return '[unreadable response]';
};

// ---------------- Component ----------------
const ChatOpsConsoleClean = () => {
    // Messages (load persisted history if available)
    const loadInitialMessages = () => {
        try {
            const raw = localStorage.getItem('theLocal.chatMessages');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse stored messages', e);
        }
        return [{
            id: 'welcome',
            role: 'assistant',
            authorTag: 'TL',
            text: 'Hey! Welcome to The Local — your Tailnet hangout. Ask me anything or just vibe.',
            createdAt: new Date().toISOString(),
        }];
    };
    const [messages, setMessages] = useState(loadInitialMessages);
    const [draftMessage, setDraftMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);

    // View management
    const [activeView, setActiveView] = useState('chat');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Provider / model persistence
    const [provider, setProvider] = useState(() => localStorage.getItem('theLocal.provider') || 'openai');
    const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('chatops_openai_key') || '');
    const [openaiModel, setOpenaiModel] = useState(() => localStorage.getItem('chatops_openai_model') || 'gpt-4o');
    const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('chatops_ollama_url') || 'http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('theLocal.ollamaModel') || 'llama3');
    const [ollamaModels, setOllamaModels] = useState([]);
    const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
    const [temp, setTemp] = useState(0.7);

    // Status tracking
    const [lastChatOk, setLastChatOk] = useState(null);
    const [tailnetStatus, setTailnetStatus] = useState(null);
    const [ollamaStatus, setOllamaStatus] = useState(null);
    const [error, setError] = useState(null);

    // Provider status meta (for color-coded provider name)
    const getProviderStatusMeta = () => {
        if (provider === 'openai') {
            if (!openaiKey) return { label: 'KEY?', color: 'text-amber-300' };
            if (lastChatOk === true) return { label: 'OK', color: 'text-emerald-300' };
            if (lastChatOk === false) return { label: 'FAIL', color: 'text-rose-300' };
            return { label: 'WAIT', color: 'text-slate-300' };
        } else {
            if (ollamaStatus === 'online') return { label: 'OK', color: 'text-emerald-300' };
            if (ollamaStatus === 'offline') return { label: 'DOWN', color: 'text-amber-300' };
            return { label: 'WAIT', color: 'text-slate-300' };
        }
    };
    const providerMeta = getProviderStatusMeta();

    // Persistence effects
    useEffect(() => localStorage.setItem('theLocal.provider', provider), [provider]);
    useEffect(() => localStorage.setItem('chatops_openai_key', openaiKey), [openaiKey]);
    useEffect(() => localStorage.setItem('chatops_openai_model', openaiModel), [openaiModel]);
    useEffect(() => localStorage.setItem('chatops_ollama_url', ollamaUrl), [ollamaUrl]);
    useEffect(() => localStorage.setItem('theLocal.ollamaModel', ollamaModel), [ollamaModel]);

    // Scroll to bottom on message change
    useEffect(() => { const c = messagesContainerRef.current; if (c) c.scrollTop = c.scrollHeight; }, [messages]);

    // Persist messages (last 200)
    useEffect(() => {
        try {
            const toStore = messages.slice(-200).map(m => ({
                id: m.id,
                role: m.role,
                authorTag: m.authorTag,
                text: m.text,
                createdAt: m.createdAt
            }));
            localStorage.setItem('theLocal.chatMessages', JSON.stringify(toStore));
        } catch (e) { console.warn('Failed to persist chat messages', e); }
    }, [messages]);

    // Initial status boot
    useEffect(() => { refreshOllamaModels(); setTailnetStatus('online'); }, []);

    const refreshOllamaModels = async () => {
        setOllamaModelsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/chat/ollama/models?base_url=${encodeURIComponent(ollamaUrl)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setOllamaModels(data.models || []);
            setOllamaStatus('online');
            if (data.models?.length && !data.models.includes(ollamaModel)) setOllamaModel(data.models[0]);
        } catch (e) {
            console.error(e); setOllamaStatus('offline'); setOllamaModels([]);
        } finally { setOllamaModelsLoading(false); }
    };

    const sendMessageToBackend = async (text) => {
        let effectiveProvider = provider;
        if (provider === 'openai' && !openaiKey) effectiveProvider = 'ollama';
        let selectedModel = effectiveProvider === 'openai' ? openaiModel : ollamaModel;
        if (effectiveProvider === 'ollama' && (!selectedModel || !ollamaModels.includes(selectedModel))) {
            effectiveProvider = 'openai';
            selectedModel = openaiModel;
        }
        const payload = {
            message: text,
            provider: effectiveProvider,
            temperature: temp,
            config: effectiveProvider === 'openai'
                ? { api_key: openaiKey || undefined, model: selectedModel }
                : { base_url: ollamaUrl, model: selectedModel }
        };
        const res = await fetch(`${API_BASE}/api/chat/chat`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    };

    const handleSend = async () => {
        const text = draftMessage.trim();
        if (!text || isSending) return;
        setIsSending(true);
        const userMsg = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, role: 'user', authorTag: 'CC', text, createdAt: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setDraftMessage('');
        if (inputRef.current) setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
        try {
            const reply = await sendMessageToBackend(text);
            const assistantText = getDisplayText(reply);
            const assistantMsg = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, role: 'assistant', authorTag: 'TL', text: assistantText, createdAt: new Date().toISOString() };
            setMessages(prev => [...prev, assistantMsg]);
            setLastChatOk(true);
        } catch (err) {
            console.error(err); setError(err.message); setLastChatOk(false);
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', authorTag: 'TL', text: '⚠️ Failed: ' + (err.message || err), createdAt: new Date().toISOString() }]);
        } finally { setIsSending(false); }
    };

    const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

    const renderMessages = () => (
        <div className="space-y-3">
            {messages.map(m => {
                const isUser = m.role === 'user';
                const userColor = m.user_name ? getUserColor(m.user_name) : 'from-violet-500 to-sky-500';
                const text = getDisplayText(m);
                return (
                    <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`bubble-avatar ${isUser ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : ''}`}>{m.authorTag}</div>
                        <div className={`bubble-content ${isUser ? 'user-bubble-content bg-gradient-to-r ' + userColor : ''}`}>
                            <div className="bubble-text whitespace-pre-wrap leading-relaxed">{text}</div>
                        </div>
                    </div>
                );
            })}
            {isSending && (
                <div className="assistant-bubble">
                    <div className="bubble-avatar">TL</div>
                    <div className="bubble-content"><div className="bubble-text">Thinking…</div></div>
                </div>
            )}
        </div>
    );

    const ViewPlaceholder = ({ view }) => (
        <div className="px-4 py-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
                {view === 'dashboard' && <Home className="w-5 h-5" />}
                {view === 'connections' && <Share2 className="w-5 h-5" />}
                {view === 'cloud' && <Cloud className="w-5 h-5" />}
                {view === 'stats' && <BarChart3 className="w-5 h-5" />}
                {view === 'system' && <User className="w-5 h-5" />}
                {view === 'profile' && <UserCircle className="w-5 h-5" />}
                {view === 'settings' && <Settings className="w-5 h-5" />}
                <span className="capitalize">{view}</span>
            </h2>
            <div className="text-sm text-slate-400">This is a restored placeholder for the <span className="font-semibold text-slate-200">{view}</span> view.</div>
            {view === 'connections' && (
                <div className="space-y-3 text-xs">
                    <div>
                        <span className="block text-slate-500 mb-1">Provider</span>
                        <div className="flex gap-2">
                            <button onClick={() => setProvider('openai')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${provider === 'openai' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-slate-800/70 border border-slate-700 text-slate-300'}`}>OpenAI</button>
                            <button onClick={() => setProvider('ollama')} className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${provider === 'ollama' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-slate-800/70 border border-slate-700 text-slate-300'}`}>Ollama</button>
                        </div>
                    </div>
                    {provider === 'openai' && (
                        <div>
                            <label className="block text-slate-500 mb-1">API Key</label>
                            <div className="relative">
                                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                                <input type="password" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-..." className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-8 py-2 text-xs focus:outline-none focus:border-violet-500/70" />
                            </div>
                            <label className="block text-slate-500 mt-3 mb-1">Model</label>
                            <input type="text" value={openaiModel} onChange={e => setOpenaiModel(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70" />
                        </div>
                    )}
                    {provider === 'ollama' && (
                        <div>
                            <label className="block text-slate-500 mb-1">Ollama URL</label>
                            <input type="text" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70" />
                            <label className="block text-slate-500 mt-3 mb-1">Model</label>
                            <input type="text" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70" />
                            <button onClick={refreshOllamaModels} className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 text-xs hover:bg-slate-700/70">
                                <RefreshCw className={`w-3.5 h-3.5 ${ollamaModelsLoading ? 'animate-spin' : ''}`} /> Refresh Models
                            </button>
                        </div>
                    )}
                    <div className="mt-4">
                        <span className="block text-slate-500 mb-1">Temperature</span>
                        <input type="range" min="0" max="1" step="0.01" value={temp} onChange={e => setTemp(parseFloat(e.target.value))} className="w-full h-1.5 rounded-full bg-slate-800 appearance-none cursor-pointer" />
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="chat-app-root">
            <header className="chat-app-header flex items-center justify-between sticky top-0 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center shadow-lg"><Bot className="w-5 h-5 text-white" /></div>
                    <div>
                        <div className="text-sm font-bold tracking-tight">The Local</div>
                        <div className="text-[10px] text-slate-400 font-medium">Tailnet Hangout</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setProvider(prev => prev === 'openai' ? 'ollama' : 'openai')}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors active:scale-[0.97] bg-slate-800/60 border-slate-700/60 hover:bg-slate-700/60"
                        aria-label="Toggle AI provider"
                    >
                        <Cpu className="w-3.5 h-3.5 text-slate-300" />
                        <span className={`hidden sm:inline font-semibold ${providerMeta.color}`}>{provider === 'openai' ? 'OpenAI' : 'Ollama'}</span>
                        <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/50 text-slate-300">{providerMeta.label}</span>
                    </button>
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors select-none ${tailnetStatus === 'online' ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' : tailnetStatus === 'offline' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-slate-800/60 border-slate-700/60 text-slate-300'}`}>
                        <Wifi className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Tailnet</span>
                        <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/50">{tailnetStatus === 'online' ? 'OK' : tailnetStatus === 'offline' ? 'DOWN' : 'WAIT'}</span>
                    </div>
                    <button onClick={() => setMobileMenuOpen(true)} className="h-10 w-10 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center" aria-label="Open drawer">
                        <Menu className="w-4 h-4 text-slate-100" />
                    </button>
                </div>
            </header>

            {mobileMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-black/55 backdrop-blur-md z-40" onClick={() => setMobileMenuOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-72 bg-slate-900/65 backdrop-blur-xl border-r border-slate-800/70 shadow-2xl z-50 flex flex-col">
                        <div className="p-4 flex-none flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                                <span className="text-sm font-semibold">Views</span>
                            </div>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-800/60"><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        <div className="px-4 pb-3 space-y-2 text-[11px] text-slate-400 flex-1 overflow-y-auto">
                            <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <Wifi className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Tailnet: <span className={`font-semibold ${tailnetStatus === 'online' ? 'text-emerald-400' : 'text-slate-500'}`}>{tailnetStatus || 'unknown'}</span></span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <Cpu className="w-3.5 h-3.5 text-slate-500" />
                                    <span>AI: <span className={`font-semibold ${lastChatOk ? 'text-emerald-400' : 'text-slate-500'}`}>{lastChatOk === true ? 'online' : lastChatOk === false ? 'issue' : 'idle'}</span></span>
                                </div>
                            </div>
                        </div>
                        <nav className="p-4 flex-none space-y-2 border-t border-slate-800/60 bg-slate-950/50 backdrop-blur-md">
                            {['dashboard', 'chat', 'connections', 'cloud', 'stats', 'system', 'profile', 'settings'].map(view => (
                                <button key={view} onClick={() => { setActiveView(view); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${activeView === view ? 'bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800/70'}`}>
                                    {view === 'dashboard' && <Home className="w-5 h-5" />}
                                    {view === 'chat' && <MessageSquare className="w-5 h-5" />}
                                    {view === 'connections' && <Share2 className="w-5 h-5" />}
                                    {view === 'cloud' && <Cloud className="w-5 h-5" />}
                                    {view === 'stats' && <BarChart3 className="w-5 h-5" />}
                                    {view === 'system' && <User className="w-5 h-5" />}
                                    {view === 'profile' && <UserCircle className="w-5 h-5" />}
                                    {view === 'settings' && <Settings className="w-5 h-5" />}
                                    <span className="capitalize">{view}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </>
            )}

            <main className="chat-app-main">
                <div className="chat-scroll-area" ref={messagesContainerRef}>
                    {activeView === 'chat' ? renderMessages() : <ViewPlaceholder view={activeView} />}
                </div>
                {activeView === 'chat' && (
                    <div className="chat-input-wrapper">
                        <div className="chat-input-inner">
                            <textarea
                                className="chat-input-field"
                                rows={1}
                                placeholder="Message the room..."
                                value={draftMessage}
                                onChange={e => setDraftMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                ref={inputRef}
                            />
                            <button
                                className="chat-send-button"
                                disabled={isSending || !draftMessage.trim()}
                                onClick={handleSend}
                                aria-label="Send message"
                            >
                                <span className="chat-send-icon">➤</span>
                            </button>
                        </div>
                        {error && <div className="mt-2 text-[11px] text-red-400 px-1">Error: {error}</div>}
                    </div>
                )}
            </main>
        </div>
    );
};

export default ChatOpsConsoleClean;
BarChart3,
    User,
    UserCircle,
    Cloud,
    Wifi,
    RefreshCw,
    Trash2,
    Send,
    Settings,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Cpu,
    Server,
    Bug,
    Zap,
    Key,
    X
} from 'lucide-react';

// ---------------- Helpers ----------------
const getApiBase = () => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return `http://${hostname}:8000`;
    return 'http://localhost:8000';
};
const API_BASE = getApiBase();

const getUserColor = (userName) => {
    if (!userName) return 'from-violet-500 to-sky-500';
    const colors = [
        'from-violet-500 to-sky-500', 'from-emerald-500 to-teal-500', 'from-rose-500 to-pink-500',
        'from-amber-500 to-orange-500', 'from-cyan-500 to-blue-500', 'from-fuchsia-500 to-purple-500',
        'from-lime-500 to-green-500', 'from-indigo-500 to-violet-500'
    ];
    let hash = 0;
    for (let i = 0; i < userName.length; i++) hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const getDisplayText = (message) => {
    if (!message) return '';
    if (typeof message === 'string') return message;
    if (message.text && typeof message.text === 'string') return message.text;
    if (message.content && typeof message.content === 'string') return message.content;
    if (typeof message === 'object') {
        if (Array.isArray(message.choices)) {
            const content = message.choices[0]?.message?.content;
            if (content && typeof content === 'string') return content;
        }
        if (message.answer && typeof message.answer === 'string') return message.answer;
    }
    return '[unreadable response]';
};

// ---------------- Component ----------------
const ChatOpsConsoleClean = () => {
    // Messages (load persisted history if available)
    const loadInitialMessages = () => {
        try {
            const raw = localStorage.getItem('theLocal.chatMessages');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('Failed to parse stored messages', e);
        }
        // Fallback welcome message
        return [{
            id: 'welcome',
            role: 'assistant',
            authorTag: 'TL',
            text: 'Hey! Welcome to The Local — your Tailnet hangout. Ask me anything or just vibe.',
            createdAt: new Date().toISOString(),
        }];
    };
    const [messages, setMessages] = useState(loadInitialMessages);
    const [draftMessage, setDraftMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null); // for blurring to dismiss mobile keyboard

    // View management (mobile/desktop)
    const [activeView, setActiveView] = useState('chat'); // chat | dashboard | connections | cloud | stats | system | profile | settings
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Provider / model persistence
    const [provider, setProvider] = useState(() => localStorage.getItem('theLocal.provider') || 'openai');
    const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('chatops_openai_key') || '');
    const [openaiModel, setOpenaiModel] = useState(() => localStorage.getItem('chatops_openai_model') || 'gpt-4o');
    const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('chatops_ollama_url') || 'http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('theLocal.ollamaModel') || 'llama3');
    const [ollamaModels, setOllamaModels] = useState([]);
    const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
    const [temp, setTemp] = useState(0.7);

    // Status tracking
    const [lastChatOk, setLastChatOk] = useState(null);
    const [tailnetStatus, setTailnetStatus] = useState(null);
    const [ollamaStatus, setOllamaStatus] = useState(null);
    const [error, setError] = useState(null);

    // Derive provider status label + color (for coloring provider name explicitly)
    const getProviderStatusMeta = () => {
        if (provider === 'openai') {
            if (!openaiKey) return { label: 'KEY?', color: 'text-amber-300' };
            if (lastChatOk === true) return { label: 'OK', color: 'text-emerald-300' };
            if (lastChatOk === false) return { label: 'FAIL', color: 'text-rose-300' };
            return { label: 'WAIT', color: 'text-slate-300' };
        } else { // ollama
            if (ollamaStatus === 'online') return { label: 'OK', color: 'text-emerald-300' };
            if (ollamaStatus === 'offline') return { label: 'DOWN', color: 'text-amber-300' };
            return { label: 'WAIT', color: 'text-slate-300' };
        }
    };
    const providerMeta = getProviderStatusMeta();

    // Persistence effects
    useEffect(() => localStorage.setItem('theLocal.provider', provider), [provider]);
    useEffect(() => localStorage.setItem('chatops_openai_key', openaiKey), [openaiKey]);
    useEffect(() => localStorage.setItem('chatops_openai_model', openaiModel), [openaiModel]);
    useEffect(() => localStorage.setItem('chatops_ollama_url', ollamaUrl), [ollamaUrl]);
    useEffect(() => localStorage.setItem('theLocal.ollamaModel', ollamaModel), [ollamaModel]);

    // Scroll to bottom on message change
    useEffect(() => {
        const c = messagesContainerRef.current; if (c) c.scrollTop = c.scrollHeight;
    }, [messages]);

    // Persist messages (truncate to last 200 to avoid bloat)
    useEffect(() => {
        try {
            const toStore = messages.slice(-200).map(m => ({
                id: m.id,
                    < button
                        type = "button"
                        onClick = {() => setProvider(prev => prev === 'openai' ? 'ollama' : 'openai')}
className = {`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors active:scale-[0.97] bg-slate-800/60 border-slate-700/60 hover:bg-slate-700/60`}
aria - label="Toggle AI provider"
    >
                        <Cpu className="w-3.5 h-3.5 text-slate-300" />
                        <span className={`hidden sm:inline font-semibold ${providerMeta.color}`}>{provider === 'openai' ? 'OpenAI' : 'Ollama'}</span>
                        <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/50 text-slate-300">
                            {providerMeta.label}
                        </span>
                    </button >
    provider: effectiveProvider,
        temperature: temp,
            config: effectiveProvider === 'openai'
                ? { api_key: openaiKey || undefined, model: selectedModel }
                : { base_url: ollamaUrl, model: selectedModel }
        };
const res = await fetch(`${API_BASE}/api/chat/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
});
if (!res.ok) throw new Error(`HTTP ${res.status}`);
return res.json();
    };

const handleSend = async () => {
    const text = draftMessage.trim();
    if (!text || isSending) return;
    setIsSending(true);
    const userMsg = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, role: 'user', authorTag: 'CC', text, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setDraftMessage('');
    // Dismiss mobile keyboard by blurring the textarea
    if (inputRef.current) {
        // slight delay lets React finish state updates before blur
        setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
    }
    try {
        const reply = await sendMessageToBackend(text);
        const assistantText = getDisplayText(reply);
        const assistantMsg = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, role: 'assistant', authorTag: 'TL', text: assistantText, createdAt: new Date().toISOString() };
        setMessages(prev => [...prev, assistantMsg]);
        setLastChatOk(true);
    } catch (err) {
        console.error(err); setError(err.message); setLastChatOk(false);
        setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', authorTag: 'TL', text: '⚠️ Failed: ' + (err.message || err), createdAt: new Date().toISOString() }]);
    } finally { setIsSending(false); }
};

const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
};

const renderMessages = () => (
    <div className="space-y-3">
        {messages.map(m => {
            const isUser = m.role === 'user';
            const userColor = m.user_name ? getUserColor(m.user_name) : 'from-violet-500 to-sky-500';
            const text = getDisplayText(m);
            return (
                <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`bubble-avatar ${isUser ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : ''}`}>{m.authorTag}</div>
                    <div className={`bubble-content ${isUser ? 'user-bubble-content bg-gradient-to-r ' + userColor : ''}`}>
                        <div className="bubble-text whitespace-pre-wrap leading-relaxed">{text}</div>
                    </div>
                </div>
            );
        })}
        {isSending && (
            <div className="assistant-bubble">
                <div className="bubble-avatar">TL</div>
                <div className="bubble-content"><div className="bubble-text">Thinking…</div></div>
            </div>
        )}
    </div>
);

// Generic placeholder for non-chat views (restored scaffold)
const ViewPlaceholder = ({ view }) => (
    <div className="px-4 py-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
            {view === 'dashboard' && <Home className="w-5 h-5" />}
            {view === 'connections' && <Share2 className="w-5 h-5" />}
            {view === 'cloud' && <Cloud className="w-5 h-5" />}
            {view === 'stats' && <BarChart3 className="w-5 h-5" />}
            {view === 'system' && <User className="w-5 h-5" />}
            {view === 'profile' && <UserCircle className="w-5 h-5" />}
            {view === 'settings' && <Settings className="w-5 h-5" />}
            <span className="capitalize">{view}</span>
        </h2>
        <div className="text-sm text-slate-400">
            This is a restored placeholder for the <span className="font-semibold text-slate-200">{view}</span> view. Original detailed UI will be re-modularized here.
        </div>
        {view === 'connections' && (
            <div className="space-y-3 text-xs">
                <div>
                    <span className="block text-slate-500 mb-1">Provider</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setProvider('openai')}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${provider === 'openai' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-slate-800/70 border border-slate-700 text-slate-300'}`}
                        >OpenAI</button>
                        <button
                            onClick={() => setProvider('ollama')}
                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${provider === 'ollama' ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' : 'bg-slate-800/70 border border-slate-700 text-slate-300'}`}
                        >Ollama</button>
                    </div>
                </div>
                {provider === 'openai' && (
                    <div>
                        <label className="block text-slate-500 mb-1">API Key</label>
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
                        <label className="block text-slate-500 mt-3 mb-1">Model</label>
                        <input
                            type="text"
                            value={openaiModel}
                            onChange={e => setOpenaiModel(e.target.value)}
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
                        />
                    </div>
                )}
                {provider === 'ollama' && (
                    <div>
                        <label className="block text-slate-500 mb-1">Ollama URL</label>
                        <input
                            type="text"
                            value={ollamaUrl}
                            onChange={e => setOllamaUrl(e.target.value)}
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
                        />
                        <label className="block text-slate-500 mt-3 mb-1">Model</label>
                        <input
                            type="text"
                            value={ollamaModel}
                            onChange={e => setOllamaModel(e.target.value)}
                            className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-violet-500/70"
                        />
                        <button
                            onClick={refreshOllamaModels}
                            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-200 text-xs hover:bg-slate-700/70"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${ollamaModelsLoading ? 'animate-spin' : ''}`} /> Refresh Models
                        </button>
                    </div>
                )}
                <div className="mt-4">
                    <span className="block text-slate-500 mb-1">Temperature</span>
                    <input
                        type="range" min="0" max="1" step="0.01" value={temp}
                        onChange={e => setTemp(parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-full bg-slate-800 appearance-none cursor-pointer"
                    />
                </div>
            </div>
        )}
    </div>
);

return (
    <div className="chat-app-root">
        {/* Fixed / sticky header */}
        <header className="chat-app-header flex items-center justify-between sticky top-0 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/60">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center shadow-lg"><Bot className="w-5 h-5 text-white" /></div>
                <div>
                    <div className="text-sm font-bold tracking-tight">The Local</div>
                    <div className="text-[10px] text-slate-400 font-medium">Tailnet Hangout</div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {/* AI Provider Status Chip (click to toggle provider) */}
                <button
                    type="button"
                    onClick={() => setProvider(prev => prev === 'openai' ? 'ollama' : 'openai')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors active:scale-[0.97] ${provider === 'openai'
                        ? (!openaiKey
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : (lastChatOk === true
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : lastChatOk === false
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300'))
                        : (ollamaStatus === 'online'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : ollamaStatus === 'offline'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                : 'bg-slate-800/60 border-slate-700/60 text-slate-300')
                        }`}
                    aria-label="Toggle AI provider"
                >
                    <Cpu className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{provider === 'openai' ? 'OpenAI' : 'Ollama'}</span>
                    <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/50">
                        {provider === 'openai'
                            ? (!openaiKey
                                ? 'KEY?'
                                : lastChatOk === true
                                    ? 'OK'
                                    : lastChatOk === false
                                        ? 'FAIL'
                                        : 'WAIT')
                            : (ollamaStatus === 'online'
                                ? 'OK'
                                : ollamaStatus === 'offline'
                                    ? 'DOWN'
                                    : 'WAIT')}
                    </span>
                </button>
                {/* Tailnet Status Chip */}
                <div
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors select-none ${tailnetStatus === 'online'
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                        : tailnetStatus === 'offline'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                            : 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                        }`}
                >
                    <Wifi className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tailnet</span>
                    <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/50">
                        {tailnetStatus === 'online' ? 'OK' : tailnetStatus === 'offline' ? 'DOWN' : 'WAIT'}
                    </span>
                </div>
                {/* Drawer toggle */}
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="h-10 w-10 rounded-xl bg-slate-900/80 border border-slate-700 flex items-center justify-center"
                    aria-label="Open drawer"
                >
                    <Menu className="w-4 h-4 text-slate-100" />
                </button>
            </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
            <>
                <div
                    className="fixed inset-0 bg-black/55 backdrop-blur-md z-40"
                    onClick={() => setMobileMenuOpen(false)}
                />
                <div className="fixed inset-y-0 left-0 w-72 bg-slate-900/65 backdrop-blur-xl border-r border-slate-800/70 shadow-2xl z-50 flex flex-col">
                    <div className="p-4 flex-none flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center"><Bot className="w-4 h-4 text-white" /></div>
                            <span className="text-sm font-semibold">Views</span>
                        </div>
                        <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-800/60"><X className="w-5 h-5 text-slate-400" /></button>
                    </div>
                    <div className="px-4 pb-3 space-y-2 text-[11px] text-slate-400 flex-1 overflow-y-auto">
                        <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 px-3 py-2 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <Wifi className="w-3.5 h-3.5 text-slate-500" />
                                <span>Tailnet: <span className={`font-semibold ${tailnetStatus === 'online' ? 'text-emerald-400' : 'text-slate-500'}`}>{tailnetStatus || 'unknown'}</span></span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Cpu className="w-3.5 h-3.5 text-slate-500" />
                                <span>AI: <span className={`font-semibold ${lastChatOk ? 'text-emerald-400' : 'text-slate-500'}`}>{lastChatOk === true ? 'online' : lastChatOk === false ? 'issue' : 'idle'}</span></span>
                            </div>
                        </div>
                    </div>
                    <nav className="p-4 flex-none space-y-2 border-t border-slate-800/60 bg-slate-950/50 backdrop-blur-md">
                        {['dashboard', 'chat', 'connections', 'cloud', 'stats', 'system', 'profile', 'settings'].map(view => (
                            <button
                                key={view}
                                onClick={() => { setActiveView(view); setMobileMenuOpen(false); }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${activeView === view ? 'bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800/70'}`}
                            >
                                {view === 'dashboard' && <Home className="w-5 h-5" />}
                                {view === 'chat' && <MessageSquare className="w-5 h-5" />}
                                {view === 'connections' && <Share2 className="w-5 h-5" />}
                                {view === 'cloud' && <Cloud className="w-5 h-5" />}
                                {view === 'stats' && <BarChart3 className="w-5 h-5" />}
                                {view === 'system' && <User className="w-5 h-5" />}
                                {view === 'profile' && <UserCircle className="w-5 h-5" />}
                                {view === 'settings' && <Settings className="w-5 h-5" />}
                                <span className="capitalize">{view}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </>
        )}

        {/* Main area */}
        <main className="chat-app-main">
            <div className="chat-scroll-area" ref={messagesContainerRef}>
                {activeView === 'chat' ? renderMessages() : <ViewPlaceholder view={activeView} />}
            </div>
            {activeView === 'chat' && (
                <div className="chat-input-wrapper">
                    <div className="chat-input-inner">
                        <textarea
                            className="chat-input-field"
                            rows={1}
                            placeholder="Message the room..."
                            value={draftMessage}
                            onChange={e => setDraftMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            ref={inputRef}
                        />
                        <button
                            className="chat-send-button"
                            disabled={isSending || !draftMessage.trim()}
                            onClick={handleSend}
                            aria-label="Send message"
                        >
                            <span className="chat-send-icon">➤</span>
                        </button>
                    </div>
                    {error && <div className="mt-2 text-[11px] text-red-400 px-1">Error: {error}</div>}
                </div>
            )}
        </main>
    </div>
);
};

export default ChatOpsConsoleClean;
