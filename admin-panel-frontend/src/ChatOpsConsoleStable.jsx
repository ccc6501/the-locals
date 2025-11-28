// admin-panel-frontend/src/ChatOpsConsoleStable.jsx
// Clean stable chat console (deduplicated) with provider toggle & persistence

import React, { useState, useEffect, useRef } from 'react';
import { useChatPersistence } from './hooks/useChatPersistence';
import { useProviderStatus } from './hooks/useProviderStatus';
import { ErrorToasts } from './components/ErrorToasts';
import { ConnectionsPanel } from './components/ConnectionsPanel';
import { DashboardPanel } from './components/DashboardPanel';
import { SystemPanel } from './components/SystemPanel';
import { CloudPanel } from './components/CloudPanel';
import { UserAvatar } from './components/UserAvatar';
import { RoomList } from './components/RoomList';
import { RoomHeader } from './components/RoomHeader';
import { UserProfileSwitcher } from './components/UserProfileSwitcher';
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

// Helpers
// Dynamic API base selection with port probing; caches working base in localStorage.
const pickApiBase = async () => {
    // Allow manual override
    const override = localStorage.getItem('theLocal.apiBaseOverride');
    if (override) return override;
    const cached = localStorage.getItem('theLocal.apiBaseCached');
    if (cached) return cached;
    const hostname = window.location.hostname;
    const candidates = [];
    // Port candidates align with tray BACKEND_PORTS fallback
    const portList = (localStorage.getItem('theLocal.portCandidates') || '8000,8001,8002')
        .split(',').map(p => p.trim()).filter(Boolean);
    for (const p of portList) {
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            candidates.push(`http://localhost:${p}`);
        } else {
            candidates.push(`http://${hostname}:${p}`);
        }
    }
    // Probe system summary endpoint for first responsive base
    for (const base of candidates) {
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(`${base}/api/system/public/summary`, { signal: controller.signal });
            clearTimeout(t);
            if (res.ok) {
                localStorage.setItem('theLocal.apiBaseCached', base);
                return base;
            }
        } catch { /* try next */ }
    }
    // Fallback default
    return candidates[0] || 'http://localhost:8000';
};
let API_BASE = 'http://localhost:8000'; // will be updated asynchronously

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

const ChatOpsConsoleStable = () => {
    // Messages (persistence via hook)
    const { messages, setMessages } = useChatPersistence();
    const [draftMessage, setDraftMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);

    // Views
    const [activeView, setActiveView] = useState('chat');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Provider / model
    const [provider, setProvider] = useState(() => localStorage.getItem('theLocal.provider') || 'openai');
    const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('chatops_openai_key') || '');
    const [openaiModel, setOpenaiModel] = useState(() => localStorage.getItem('chatops_openai_model') || 'gpt-4o');
    const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('chatops_ollama_url') || 'http://localhost:11434');
    const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('theLocal.ollamaModel') || 'llama3');
    const [ollamaModels, setOllamaModels] = useState([]);
    const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
    const [temp, setTemp] = useState(0.7);

    // Status
    const [lastChatOk, setLastChatOk] = useState(null);
    const [tailnetStatus, setTailnetStatus] = useState(null);
    const [tailnetStats, setTailnetStats] = useState(null);
    const [tailnetLoading, setTailnetLoading] = useState(false);
    const [tailnetError, setTailnetError] = useState(null);
    const [systemSummary, setSystemSummary] = useState(null);
    const [aiRequestCount, setAiRequestCount] = useState(() => parseInt(localStorage.getItem('theLocal.aiRequestCount') || '0', 10));
    const [userCount, setUserCount] = useState(null);
    const [logs, setLogs] = useState([]);
    const [ollamaStatus, setOllamaStatus] = useState(null);
    const [errors, setErrors] = useState([]); // toast errors

    // Provider meta + polling via hook
    const providerMeta = useProviderStatus({
        provider,
        openaiKey,
        ollamaUrl,
        lastChatOk,
        setLastChatOk,
        ollamaStatus,
        setOllamaStatus
    });

    // Helper to truncate long model names for badge display
    const formatModel = (m) => {
        if (!m) return '';
        return m.length > 12 ? m.slice(0, 9) + '…' : m;
    };

    // Cloud storage config
    const [cloudPath, setCloudPath] = useState(() => localStorage.getItem('theLocal.cloudPath') || '/mnt/data');
    const [cloudEndpoint, setCloudEndpoint] = useState(() => localStorage.getItem('theLocal.cloudEndpoint') || '');

    // Multi-user & room state
    const [currentUser, setCurrentUser] = useState(() => {
        const stored = localStorage.getItem('theLocal.currentUser');
        return stored ? JSON.parse(stored) : null;
    });
    const [users, setUsers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(() => {
        const stored = localStorage.getItem('theLocal.currentRoom');
        return stored ? JSON.parse(stored) : null;
    });
    const [unreadCounts, setUnreadCounts] = useState({});
    const [roomsLoading, setRoomsLoading] = useState(false);

    // Helper to push error to toast list
    const pushError = (msg) => {
        setErrors(prev => [{ id: `e-${Date.now()}`, message: msg }, ...prev.slice(0, 9)]);
    };

    // Persistence effects
    useEffect(() => localStorage.setItem('theLocal.provider', provider), [provider]);
    useEffect(() => localStorage.setItem('chatops_openai_key', openaiKey), [openaiKey]);
    useEffect(() => localStorage.setItem('chatops_openai_model', openaiModel), [openaiModel]);
    useEffect(() => localStorage.setItem('chatops_ollama_url', ollamaUrl), [ollamaUrl]);
    useEffect(() => localStorage.setItem('theLocal.ollamaModel', ollamaModel), [ollamaModel]);
    useEffect(() => localStorage.setItem('theLocal.cloudPath', cloudPath), [cloudPath]);
    useEffect(() => localStorage.setItem('theLocal.cloudEndpoint', cloudEndpoint), [cloudEndpoint]);
    useEffect(() => {
        if (currentUser) localStorage.setItem('theLocal.currentUser', JSON.stringify(currentUser));
    }, [currentUser]);
    useEffect(() => {
        if (currentRoom) localStorage.setItem('theLocal.currentRoom', JSON.stringify(currentRoom));
    }, [currentRoom]);

    // Scroll
    useEffect(() => { const c = messagesContainerRef.current; if (c) c.scrollTop = c.scrollHeight; }, [messages]);

    // Resolve API base dynamically on mount then trigger initial fetches
    useEffect(() => {
        (async () => {
            API_BASE = await pickApiBase();
            // Re-run initial data pulls after base resolved
            refreshOllamaModels();
            refreshTailnetStats();
            refreshSystemSummary();
            refreshUserCount();
            refreshLogs();
            refreshUsers();
            refreshRooms();
        })();
    }, []);
    useEffect(() => {
        const interval = setInterval(() => {
            refreshTailnetStats();
            refreshSystemSummary();
            refreshUserCount();
            refreshLogs();
            refreshUnreadCounts();
        }, 30000);
        return () => clearInterval(interval);
    }, [currentUser, rooms]);

    // Refresh rooms when user changes
    useEffect(() => {
        if (currentUser) {
            refreshRooms();
        }
    }, [currentUser]);

    const refreshOllamaModels = async () => {
        setOllamaModelsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/chat/ollama/models?base_url=${encodeURIComponent(ollamaUrl)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setOllamaModels(data.models || []);
            setOllamaStatus('online');
            if (data.models?.length && !data.models.includes(ollamaModel)) setOllamaModel(data.models[0]);
        } catch (e) { console.error(e); setOllamaStatus('offline'); setOllamaModels([]); } finally { setOllamaModelsLoading(false); }
    };

    const refreshTailnetStats = async () => {
        setTailnetLoading(true);
        setTailnetError(null);
        try {
            const url = `${API_BASE}/api/system/tailscale/summary`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            const contentType = res.headers.get('content-type') || '';
            if (!res.ok) {
                throw new Error(`Tailnet HTTP ${res.status}`);
            }
            if (!contentType.includes('application/json')) {
                const text = await res.text();
                throw new Error(`Unexpected non-JSON response (${contentType || 'unknown'}): ${text.slice(0, 120)}...`);
            }
            const data = await res.json();
            // Normalize status values from backend
            const rawStatus = (data.status || '').toLowerCase();
            const normalized = ['connected', 'online', 'ok'].includes(rawStatus)
                ? 'online'
                : ['disconnected', 'error', 'not_installed', 'timeout'].includes(rawStatus)
                    ? 'offline'
                    : 'pending';
            setTailnetStats({ ...data, last_check: new Date().toLocaleTimeString(), normalized_status: normalized });
            setTailnetStatus(normalized);
        } catch (err) {
            console.error(err);
            setTailnetStatus('offline');
            setTailnetError(err.message);
            pushError(`Tailnet refresh failed: ${err.message}`);
        } finally {
            setTailnetLoading(false);
        }
    };

    const refreshSystemSummary = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/system/public/summary`);
            if (!res.ok) throw new Error(`Sys summary ${res.status}`);
            const data = await res.json();
            if (!data.error) setSystemSummary(data);
        } catch (e) {
            console.warn('System summary fetch failed', e.message);
        }
    };

    const refreshUserCount = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/users/public/count`);
            if (!res.ok) throw new Error('user count');
            const data = await res.json();
            if (typeof data.total === 'number') setUserCount(data.total);
        } catch (e) { /* ignore */ }
    };

    const refreshRooms = async () => {
        setRoomsLoading(true);
        try {
            const token = resolveToken();
            const res = await fetch(`${API_BASE}/api/rooms`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!res.ok) {
                // If we get 401/403, might need user setup
                if (res.status === 401 || res.status === 403) {
                    console.warn('Rooms require authentication. Run init_multi_user.py to set up users.');
                }
                throw new Error(`Rooms ${res.status}`);
            }
            const data = await res.json();
            setRooms(data || []);

            // Auto-select first room if none selected
            if (!currentRoom && data.length > 0) {
                setCurrentRoom(data[0]);
            }
        } catch (e) {
            console.error('Failed to load rooms:', e);
            // Don't show error toast on every failed load - it's expected if DB not initialized
            if (!e.message.includes('401') && !e.message.includes('403')) {
                pushError(`Failed to load rooms: ${e.message}`);
            }
        } finally {
            setRoomsLoading(false);
        }
    };

    const refreshUsers = async () => {
        try {
            const token = resolveToken();
            const res = await fetch(`${API_BASE}/api/users`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error(`Users ${res.status}`);
            const data = await res.json();
            setUsers(data || []);

            // Auto-select current user if not set
            if (!currentUser && data.length > 0) {
                // Find owner or first user
                const owner = data.find(u => u.role === 'owner') || data[0];
                setCurrentUser(owner);
            }
        } catch (e) {
            console.error('Failed to load users:', e);
        }
    };

    const refreshUnreadCounts = async () => {
        if (!currentUser || !rooms.length) return;

        try {
            const token = resolveToken();
            const counts = {};

            // Fetch unread count for each room
            await Promise.all(
                rooms.map(async (room) => {
                    try {
                        const res = await fetch(`${API_BASE}/api/rooms/${room.id}/unread-count`, {
                            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                        });
                        if (res.ok) {
                            const data = await res.json();
                            counts[room.id] = data.unread_count || 0;
                        }
                    } catch (e) {
                        console.warn(`Failed to get unread count for room ${room.id}:`, e);
                    }
                })
            );

            setUnreadCounts(counts);
        } catch (e) {
            console.error('Failed to refresh unread counts:', e);
        }
    };

    const resolveToken = () => {
        const candidates = ['chatops_token', 'auth_token', 'jwt', 'access_token'];
        for (const k of candidates) { const v = localStorage.getItem(k); if (v) return v; }
        return null;
    };

    const createRoom = async (slug, name) => {
        try {
            const token = resolveToken();
            const res = await fetch(`${API_BASE}/api/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    slug,
                    name,
                    type: 'group',
                    icon: '💬',
                    color: '#8b5cf6'
                })
            });

            if (!res.ok) {
                const error = await res.text();
                throw new Error(`Failed to create room: ${error}`);
            }

            const newRoom = await res.json();
            setRooms(prev => [...prev, newRoom]);
            setCurrentRoom(newRoom);
            setActiveView('chat');
            pushError(`Room "${name}" created!`);
        } catch (e) {
            console.error('Failed to create room:', e);
            pushError(e.message);
        }
    };

    const refreshLogs = async () => {
        const token = resolveToken();
        if (!token) { setLogs(null); return; }
        try {
            const res = await fetch(`${API_BASE}/api/system/logs?limit=25`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('logs');
            const data = await res.json();
            if (Array.isArray(data)) setLogs(data); else setLogs([]);
        } catch (e) { setLogs([]); }
    };

    const sendMessageToBackend = async (text) => {
        let effectiveProvider = provider;
        if (provider === 'openai' && !openaiKey) effectiveProvider = 'ollama';
        let selectedModel = effectiveProvider === 'openai' ? openaiModel : ollamaModel;
        if (effectiveProvider === 'ollama' && (!selectedModel || !ollamaModels.includes(selectedModel))) { effectiveProvider = 'openai'; selectedModel = openaiModel; }

        // Build payload with room context
        const payload = {
            message: text,
            provider: effectiveProvider,
            temperature: temp,
            config: effectiveProvider === 'openai'
                ? { api_key: openaiKey || undefined, model: selectedModel }
                : { base_url: ollamaUrl, model: selectedModel },
            room_id: currentRoom?.id,
            user_id: currentUser?.id
        };

        const res = await fetch(`${API_BASE}/api/chat/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    };

    const handleSend = async () => {
        const text = draftMessage.trim();
        if (!text || isSending) return;
        setIsSending(true);
        const userMsg = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, role: 'user', authorTag: currentUser?.initials || 'CC', text, createdAt: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setDraftMessage('');
        if (inputRef.current) setTimeout(() => inputRef.current && inputRef.current.blur(), 0);
        try {
            const reply = await sendMessageToBackend(text);
            const assistantText = getDisplayText(reply);
            const assistantTag = reply.authorTag || 'TL';
            const assistantMsg = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, role: 'assistant', authorTag: assistantTag, text: assistantText, createdAt: new Date().toISOString() };
            setMessages(prev => [...prev, assistantMsg]);
            setAiRequestCount(prev => {
                const next = prev + 1; localStorage.setItem('theLocal.aiRequestCount', String(next)); return next;
            });
            setLastChatOk(true);

            // Mark room as read after sending
            if (currentRoom?.id && currentUser?.id) {
                markRoomAsRead(currentRoom.id);
            }
        } catch (err) {
            console.error(err);
            setLastChatOk(false);
            const msg = err.message || String(err);
            setErrors(prev => [{ id: `e-${Date.now()}`, message: msg }, ...prev.slice(0, 9)]); // keep last 10
            setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', authorTag: 'TL', text: '⚠️ Failed: ' + msg, createdAt: new Date().toISOString() }]);
        } finally { setIsSending(false); }
    };

    const handleRoomSelect = (room) => {
        setCurrentRoom(room);
        // Clear messages and load room history (for now just clear)
        setMessages([]);
        // Mark as read
        markRoomAsRead(room.id);
    };

    const handleUserSelect = (user) => {
        setCurrentUser(user);
        // Rooms will reload via useEffect
    };

    const markRoomAsRead = async (roomId) => {
        if (!currentUser) return;
        try {
            const token = resolveToken();
            await fetch(`${API_BASE}/api/rooms/${roomId}/read`, {
                method: 'PATCH',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            // Update unread count locally
            setUnreadCounts(prev => ({ ...prev, [roomId]: 0 }));
        } catch (e) {
            console.warn('Failed to mark room as read:', e);
        }
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
                {view === 'cloud' && <Cloud className="w-5 h-5" />}
                {view === 'stats' && <BarChart3 className="w-5 h-5" />}
                {view === 'system' && <User className="w-5 h-5" />}
                {view === 'profile' && <UserCircle className="w-5 h-5" />}
                {view === 'settings' && <Settings className="w-5 h-5" />}
                <span className="capitalize">{view}</span>
            </h2>
            <div className="text-sm text-slate-400">This is a restored placeholder for the <span className="font-semibold text-slate-200">{view}</span> view.</div>
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
                    {/* User Profile Switcher */}
                    {currentUser && users.length > 0 && (
                        <UserProfileSwitcher
                            users={users}
                            currentUser={currentUser}
                            onUserSelect={handleUserSelect}
                        />
                    )}

                    <button type="button" onClick={() => setProvider(prev => prev === 'openai' ? 'ollama' : 'openai')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors active:scale-[0.97] bg-slate-800/60 border-slate-700/60 hover:bg-slate-700/60" aria-label="Toggle AI provider">
                        <Cpu className="w-3.5 h-3.5 text-slate-300" />
                        {/* Key presence dot for OpenAI */}
                        {provider === 'openai' && (
                            <span className={`w-2 h-2 rounded-full ${openaiKey && openaiKey.length > 10 ? 'bg-emerald-400' : 'bg-slate-500'} hidden sm:inline`} />
                        )}
                        <span className={`hidden sm:inline font-semibold ${providerMeta.color}`}>{provider === 'openai' ? 'OpenAI' : 'Ollama'}</span>
                        {/* Model badge */}
                        <span className="hidden md:inline font-mono text-[10px] px-1 py-0.5 rounded bg-slate-900/60 border border-slate-700 text-slate-300">{provider === 'openai' ? formatModel(openaiModel) : formatModel(ollamaModel)}</span>
                        <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-900/50 text-slate-300">{providerMeta.label}</span>
                    </button>
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[11px] font-medium transition-colors select-none ${tailnetStatus === 'online' ? 'bg-slate-800/70 border-slate-700 text-slate-300' : tailnetStatus === 'offline' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-slate-800/60 border-slate-700/60 text-slate-400'}`}>
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
                                    <span>AI: <span className="font-semibold text-slate-400">{lastChatOk === true ? 'ok' : lastChatOk === false ? 'issue' : 'wait'}</span></span>
                                </div>
                                {/* Gauges */}
                                <div className="mt-3 space-y-2 text-[10px]">
                                    <div>
                                        <div className="flex justify-between"><span className="text-slate-500">CPU</span><span className="text-slate-400">{systemSummary?.cpu ?? '--'}%</span></div>
                                        <div className="h-2 rounded bg-slate-800 overflow-hidden"><div style={{ width: `${systemSummary?.cpu || 0}%` }} className="h-full bg-violet-500/70" /></div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between"><span className="text-slate-500">Mem</span><span className="text-slate-400">{systemSummary?.memory ?? '--'}%</span></div>
                                        <div className="h-2 rounded bg-slate-800 overflow-hidden"><div style={{ width: `${systemSummary?.memory || 0}%` }} className="h-full bg-sky-500/70" /></div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between"><span className="text-slate-500">Disk</span><span className="text-slate-400">{systemSummary?.disk ?? '--'}%</span></div>
                                        <div className="h-2 rounded bg-slate-800 overflow-hidden"><div style={{ width: `${systemSummary?.disk || 0}%` }} className="h-full bg-emerald-500/70" /></div>
                                    </div>
                                    <div className="flex justify-between pt-1"><span className="text-slate-500">Users</span><span className="text-slate-400">{userCount ?? new Set(messages.filter(m => m.role === 'user').map(m => m.authorTag || 'U')).size}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Net Sent</span><span className="text-slate-400">{systemSummary?.bytes_sent ? (systemSummary.bytes_sent / 1048576).toFixed(1) + ' MB' : '--'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Net Recv</span><span className="text-slate-400">{systemSummary?.bytes_recv ? (systemSummary.bytes_recv / 1048576).toFixed(1) + ' MB' : '--'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">AI Requests</span><span className="text-slate-400">{aiRequestCount}</span></div>
                                </div>
                            </div>
                        </div>
                        <nav className="p-4 flex-none space-y-2 border-t border-slate-800/60 bg-slate-950/50 backdrop-blur-md">
                            {['dashboard', 'chat', 'rooms', 'connections', 'cloud', 'stats', 'system', 'profile', 'settings'].map(view => (
                                <button key={view} onClick={() => { setActiveView(view); setMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all ${activeView === view ? 'bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-800/70'}`}>
                                    {view === 'dashboard' && <Home className="w-5 h-5" />}
                                    {view === 'chat' && <MessageSquare className="w-5 h-5" />}
                                    {view === 'rooms' && <MessageSquare className="w-5 h-5" />}
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
                <div className="flex flex-1 min-h-0">
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Room Header - Only show in chat view when room selected */}
                        {activeView === 'chat' && currentRoom && (
                            <RoomHeader
                                room={currentRoom}
                                aiConfig={currentRoom.ai_config ? JSON.parse(currentRoom.ai_config) : {}}
                            />
                        )}

                        {/* Messages/Content Area */}
                        <div className="chat-scroll-area flex-1" ref={messagesContainerRef}>
                            {activeView === 'chat' && renderMessages()}
                            {activeView === 'dashboard' && <DashboardPanel recentMessages={messages} logs={logs} />}
                            {activeView === 'rooms' && (
                                <div className="p-6 max-w-4xl mx-auto w-full">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-2xl font-bold text-white">Rooms</h2>
                                        <button
                                            onClick={() => {
                                                const name = prompt('Room name:');
                                                if (!name) return;
                                                const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                                                createRoom(slug, name);
                                            }}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-sky-600 text-white font-medium hover:from-violet-700 hover:to-sky-700 transition-all"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                            Create Room
                                        </button>
                                    </div>
                                    
                                    {roomsLoading ? (
                                        <div className="text-center text-slate-400 py-12">
                                            <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
                                            <p>Loading rooms...</p>
                                        </div>
                                    ) : rooms.length === 0 ? (
                                        <div className="text-center text-slate-400 py-12">
                                            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                            <p className="text-lg mb-2">No rooms yet</p>
                                            <p className="text-sm text-slate-500">Create your first room or run init_multi_user.py to set up default rooms</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {rooms.map(room => {
                                                const unreadCount = unreadCounts[room.id] || 0;
                                                const isActive = currentRoom?.id === room.id;
                                                
                                                return (
                                                    <button
                                                        key={room.id}
                                                        onClick={() => {
                                                            handleRoomSelect(room);
                                                            setActiveView('chat');
                                                        }}
                                                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                                                            isActive
                                                                ? 'bg-gradient-to-r from-violet-600 to-sky-600 border-violet-500 text-white'
                                                                : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800/70 hover:border-slate-700'
                                                        }`}
                                                    >
                                                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
                                                            isActive ? 'bg-white/20' : 'bg-slate-800'
                                                        }`}>
                                                            {room.type === 'system' && <MessageSquare className="w-6 h-6" />}
                                                            {room.type === 'dm' && <User className="w-6 h-6" />}
                                                            {room.type === 'group' && <User className="w-6 h-6" />}
                                                        </div>
                                                        
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-semibold text-sm">{room.name}</span>
                                                                {room.is_system && (
                                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">System</span>
                                                                )}
                                                            </div>
                                                            {room.slug && (
                                                                <span className="text-xs text-slate-400">#{room.slug}</span>
                                                            )}
                                                        </div>
                                                        
                                                        {unreadCount > 0 && (
                                                            <div className="flex-shrink-0 bg-rose-500 text-white text-xs font-bold rounded-full min-w-[24px] h-6 flex items-center justify-center px-2">
                                                                {unreadCount > 99 ? '99+' : unreadCount}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeView === 'connections' && (
                                <ConnectionsPanel
                                    provider={provider}
                                    setProvider={setProvider}
                                    openaiKey={openaiKey}
                                    setOpenaiKey={setOpenaiKey}
                                    openaiModel={openaiModel}
                                    setOpenaiModel={setOpenaiModel}
                                    ollamaUrl={ollamaUrl}
                                    setOllamaUrl={setOllamaUrl}
                                    ollamaModel={ollamaModel}
                                    setOllamaModel={setOllamaModel}
                                    ollamaModels={ollamaModels}
                                    ollamaModelsLoading={ollamaModelsLoading}
                                    refreshOllamaModels={refreshOllamaModels}
                                    temp={temp}
                                    setTemp={setTemp}
                                    providerMeta={providerMeta}
                                    cloudPath={cloudPath}
                                    setCloudPath={setCloudPath}
                                    cloudEndpoint={cloudEndpoint}
                                    setCloudEndpoint={setCloudEndpoint}
                                    tailnetStats={tailnetStats}
                                    tailnetLoading={tailnetLoading}
                                    tailnetError={tailnetError}
                                    refreshTailnetStats={refreshTailnetStats}
                                    apiBase={API_BASE}
                                />
                            )}
                            {activeView === 'system' && <SystemPanel tailnetStats={tailnetStats} refreshTailnetStats={refreshTailnetStats} exitNodeChanging={tailnetLoading} setExitNodeChanging={setTailnetLoading} />}
                            {activeView === 'cloud' && <CloudPanel apiBase={API_BASE} />}
                            {activeView !== 'chat' && activeView !== 'connections' && activeView !== 'dashboard' && activeView !== 'system' && activeView !== 'cloud' && activeView !== 'rooms' && <ViewPlaceholder view={activeView} />}
                        </div>

                        {/* Chat Input - Only show in chat view */}
                        {activeView === 'chat' && (
                            <div className="chat-input-wrapper">
                                <div className="chat-input-inner">
                                    <textarea className="chat-input-field" rows={1} placeholder={currentRoom ? `Message ${currentRoom.slug || currentRoom.name}...` : "Select a room to chat..."} value={draftMessage} onChange={e => setDraftMessage(e.target.value)} onKeyDown={handleKeyDown} ref={inputRef} disabled={!currentRoom} />
                                    <button className="chat-send-button" disabled={isSending || !draftMessage.trim() || !currentRoom} onClick={handleSend} aria-label="Send message">
                                        <span className="chat-send-icon">➤</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!messages.length) return;
                                            if (!window.confirm('Clear all chat history?')) return;
                                            const welcome = { id: 'welcome', role: 'assistant', authorTag: currentRoom?.ai_config ? JSON.parse(currentRoom.ai_config).assistant_initials || 'TL' : 'TL', text: 'History cleared. Fresh start! Ask me anything.', createdAt: new Date().toISOString() };
                                            setMessages([welcome]);
                                            localStorage.removeItem('theLocal.chatMessages');
                                            setErrors(prev => [{ id: `e-${Date.now()}`, message: 'Chat history cleared' }, ...prev]);
                                        }}
                                        className="ml-2 px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-800/70 border border-slate-700 text-slate-300 hover:bg-slate-700/70 active:scale-95"
                                    >Clear</button>
                                </div>
                                {/* Error toasts rendered globally */}
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <ErrorToasts
                errors={errors}
                dismiss={(id) => setErrors(prev => prev.filter(e => e.id !== id))}
            />
        </div>
    );
};

export default ChatOpsConsoleStable;
