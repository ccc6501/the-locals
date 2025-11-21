// admin-panel-frontend/src/ChatOpsConsole.jsx
import React, { useState } from "react";
import {
    Send,
    Sparkles,
    Cpu,
    Wifi,
    Settings,
    Key,
    RefreshCw,
    Shield,
    ChevronDown,
    ChevronUp,
    Bug,
    Server,
    Zap,
} from "lucide-react";
import ChatRoomList from "./ChatRoomList";

const nowTime = () =>
    new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });

const API_BASE =
    import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;

// Generate consistent color for each user
const getUserColor = (userName) => {
    if (!userName) return "from-violet-500 to-sky-500";

    const colors = [
        "from-violet-500 to-sky-500",     // purple-blue
        "from-emerald-500 to-teal-500",   // green-teal
        "from-rose-500 to-pink-500",      // red-pink
        "from-amber-500 to-orange-500",   // amber-orange
        "from-cyan-500 to-blue-500",      // cyan-blue
        "from-fuchsia-500 to-purple-500", // fuchsia-purple
        "from-lime-500 to-green-500",     // lime-green
        "from-indigo-500 to-violet-500",  // indigo-violet
    ];

    // Generate consistent index from username
    let hash = 0;
    for (let i = 0; i < userName.length; i++) {
        hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const ChatOpsConsole = () => {
    // Room state for group chat
    const [currentRoom, setCurrentRoom] = useState({ id: "general", name: "General" });
    const [lastMessageId, setLastMessageId] = useState(null);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);

    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content:
                "Welcome to ChatOps Neon. This shell mirrors your Tailnet brain's routing, AI, and bug surface so every test feels like the real deal.",
            time: nowTime(),
        },
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isThinking, setIsThinking] = useState(false);
    const inputRef = React.useRef(null);

    // Load settings from localStorage on mount
    const [provider, setProvider] = useState(() => {
        return localStorage.getItem("chatops_provider") || "openai";
    });
    const [openaiKey, setOpenaiKey] = useState(() => {
        return localStorage.getItem("chatops_openai_key") || "";
    });
    const [openaiModel, setOpenaiModel] = useState(() => {
        return localStorage.getItem("chatops_openai_model") || "gpt-4o";
    });
    const [ollamaUrl, setOllamaUrl] = useState(() => {
        return localStorage.getItem("chatops_ollama_url") || "http://localhost:11434";
    });
    const [ollamaModel, setOllamaModel] = useState(() => {
        return localStorage.getItem("chatops_ollama_model") || "llama3";
    });
    const [temp, setTemp] = useState(() => {
        const saved = localStorage.getItem("chatops_temperature");
        return saved ? parseFloat(saved) : 0.7;
    });

    const [lastTestStatus, setLastTestStatus] = useState(null);
    const [error, setError] = useState(null);

    const [controlTab, setControlTab] = useState("ai");
    const [lazloMode, setLazloMode] = useState(false);
    const [controlSurfaceCollapsed, setControlSurfaceCollapsed] = useState(false);

    const [bugReports, setBugReports] = useState([]);
    const [bugStatus, setBugStatus] = useState(null);

    // Tailnet stats
    const [tailnetStats, setTailnetStats] = useState(null);
    const [tailnetLoading, setTailnetLoading] = useState(false);
    const [tailnetError, setTailnetError] = useState(null);

    // Ollama models
    const [ollamaModels, setOllamaModels] = useState([]);
    const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);

    // Status tracking for header
    const [lastChatOk, setLastChatOk] = useState(null); // true/false/null
    const [tailnetHealthy, setTailnetHealthy] = useState(null);

    // Mode presets
    const [mode, setMode] = useState("default");

    // Persist settings to localStorage
    React.useEffect(() => {
        localStorage.setItem("chatops_provider", provider);
    }, [provider]);

    React.useEffect(() => {
        localStorage.setItem("chatops_openai_key", openaiKey);
    }, [openaiKey]);

    React.useEffect(() => {
        localStorage.setItem("chatops_openai_model", openaiModel);
    }, [openaiModel]);

    React.useEffect(() => {
        localStorage.setItem("chatops_ollama_url", ollamaUrl);
    }, [ollamaUrl]);

    React.useEffect(() => {
        localStorage.setItem("chatops_ollama_model", ollamaModel);
    }, [ollamaModel]);

    React.useEffect(() => {
        localStorage.setItem("chatops_temperature", temp.toString());
    }, [temp]);

    // Load messages from backend when room changes
    React.useEffect(() => {
        let cancelled = false;

        const loadMessages = async () => {
            setIsLoadingMessages(true);
            try {
                const res = await fetch(`/chat/rooms/${currentRoom.id}/messages`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled) return;

                // Convert backend messages to UI format
                const formattedMessages = data.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                    user_name: msg.user_name,
                    time: new Date(msg.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                    }),
                    id: msg.id,
                }));

                setMessages(formattedMessages);
                const maxId = data.length ? Math.max(...data.map(m => m.id)) : null;
                setLastMessageId(maxId);
            } catch (err) {
                console.error("Failed to load messages", err);
                if (!cancelled) {
                    setError(`Failed to load messages: ${err.message}`);
                }
            } finally {
                if (!cancelled) setIsLoadingMessages(false);
            }
        };

        loadMessages();
        return () => {
            cancelled = true;
        };
    }, [currentRoom.id]);

    // Poll for new messages every 3 seconds
    React.useEffect(() => {
        if (!currentRoom.id || isLoadingMessages) return;

        const pollInterval = setInterval(async () => {
            try {
                const url = lastMessageId
                    ? `/chat/rooms/${currentRoom.id}/messages?since_id=${lastMessageId}`
                    : `/chat/rooms/${currentRoom.id}/messages`;

                const res = await fetch(url);
                if (!res.ok) return;

                const data = await res.json();
                if (data.length === 0) return;

                // Convert and append new messages
                const newMessages = data.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                    user_name: msg.user_name,
                    time: new Date(msg.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                    }),
                    id: msg.id,
                }));

                setMessages(prev => [...prev, ...newMessages]);
                const maxId = Math.max(...data.map(m => m.id));
                setLastMessageId(maxId);
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 3000);

        return () => clearInterval(pollInterval);
    }, [currentRoom.id, lastMessageId, isLoadingMessages]);

    const handleSendMessage = async () => {
        const value = inputMessage.trim();
        if (!value || isThinking) return;

        // Auto-fallback: no OpenAI key → use Ollama
        let effectiveProvider = provider;
        if (provider === "openai" && !openaiKey) {
            effectiveProvider = "ollama";
        }

        // clear prior error
        setError(null);

        const userMessage = {
            role: "user",
            content: value,
            time: nowTime(),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInputMessage("");
        setIsThinking(true);

        // Dismiss keyboard on mobile
        if (inputRef.current) {
            inputRef.current.blur();
        }

        try {
            // STEP 1: Save user message to backend group chat
            const saveRes = await fetch(`/chat/rooms/${currentRoom.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: value,
                    role: "user",
                    lazlo_mode: lazloMode,
                    model: effectiveProvider === "openai" ? openaiModel : ollamaModel,
                }),
            });

            if (!saveRes.ok) {
                console.warn("Failed to save message to backend:", saveRes.status);
            }

            // STEP 2: Call AI chat endpoint (existing logic)
            const payload = {
                message: value,
                provider: effectiveProvider,
                mode,
                temperature: temp,
                config:
                    effectiveProvider === "openai"
                        ? {
                            api_key: openaiKey || undefined,
                            model: openaiModel,
                        }
                        : {
                            base_url: ollamaUrl,
                            model: ollamaModel,
                        },
            };

            const res = await fetch(`${API_BASE}/api/chat/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();

            const replyText =
                data.reply ||
                data.message ||
                data.content ||
                (typeof data === "string" ? data : JSON.stringify(data, null, 2));

            const modelLabel =
                effectiveProvider === "openai"
                    ? `${effectiveProvider}:${openaiModel}`
                    : `${effectiveProvider}:${ollamaModel}`;

            const aiReply = `${replyText}\n\n— [${modelLabel} • temp=${temp.toFixed(2)}]`;

            const aiMessage = {
                role: "assistant",
                content: aiReply,
                time: nowTime(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setLastChatOk(true);

            // STEP 3: Save AI response to backend
            await fetch(`/chat/rooms/${currentRoom.id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: aiReply,
                    role: "assistant",
                    lazlo_mode: lazloMode,
                    model: effectiveProvider === "openai" ? openaiModel : ollamaModel,
                }),
            });

        } catch (err) {
            console.error("Chat API error:", err);
            setError(err.message || "Unknown error");
            setLastChatOk(false);

            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `⚠️ Chat call failed.

Endpoint: ${API_BASE}/api/chat/chat
Error: ${err.message || err}`,
                    time: nowTime(),
                },
            ]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleComposerKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!inputMessage?.trim()) return;
            handleSendMessage();
        }
    };

    const handleLogBug = () => {
        const text = (inputMessage || "").trim();
        if (!text) return;

        const now = new Date();
        const lastMsg = messages[messages.length - 1] || null;

        setBugReports((prev) => [
            {
                id: now.getTime(),
                time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                text,
                context: lastMsg,
            },
            ...prev,
        ]);

        setBugStatus("saved");
        setInputMessage("");
        setControlTab("bug");

        setTimeout(() => setBugStatus(null), 2500);
    };

    const handleTestConnection = () => {
        // For now just pretend we hit an endpoint and it worked.
        setLastTestStatus({
            ok: true,
            time: nowTime(),
            provider,
        });
    };

    const refreshTailnetStats = async () => {
        setTailnetLoading(true);
        setTailnetError(null);
        try {
            const res = await fetch(`${API_BASE}/api/system/tailscale/summary`, {
                method: "GET",
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            setTailnetStats(data);
            setTailnetHealthy(true); // Mark Tailnet as healthy
        } catch (err) {
            console.error("Tailnet stats error:", err);
            setTailnetError(err.message || "Unknown error");
            setTailnetStats(null);
            setTailnetHealthy(false); // Mark Tailnet as unhealthy
        } finally {
            setTailnetLoading(false);
        }
    };

    const fetchOllamaModels = async () => {
        setOllamaModelsLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/chat/ollama/models?base_url=${encodeURIComponent(ollamaUrl)}`,
                { method: "GET" }
            );
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            setOllamaModels(data.models || []);

            // If current model isn't in the list and there are models, select the first one
            if (data.models && data.models.length > 0 && !data.models.includes(ollamaModel)) {
                setOllamaModel(data.models[0]);
            }
        } catch (err) {
            console.error("Failed to fetch Ollama models:", err);
            setOllamaModels([]);
        } finally {
            setOllamaModelsLoading(false);
        }
    };

    const ControlChip = ({ id, label, icon: Icon }) => (
        <button
            type="button"
            onClick={() => setControlTab(id)}
            className={
                "flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all " +
                (controlTab === id
                    ? "bg-slate-800 text-slate-50 border border-purple-500/60 shadow-[0_0_0_1px_rgba(168,85,247,0.5)]"
                    : "bg-slate-900/60 text-slate-400 border border-slate-700 hover:bg-slate-800/70")
            }
        >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            <span>{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-50">
            {/* Top bar */}
            <header className="border-b border-slate-800/70 bg-slate-950/95 backdrop-blur-xl">
                <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-[11px] tracking-[0.16em] text-slate-400 uppercase">
                                Design Lab • Chat Surface
                            </div>
                            <div className="text-xl font-semibold flex items-center gap-2">
                                ChatOps Neon
                                <span className="text-xs font-medium text-slate-400">
                                    experimental console
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        {/* Chat status chip */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/70">
                            <span className={`w-1.5 h-1.5 rounded-full ${lastChatOk === true ? 'bg-emerald-400 animate-pulse' :
                                lastChatOk === false ? 'bg-amber-400' : 'bg-slate-500'
                                }`} />
                            <span className="text-slate-300">
                                {lastChatOk === true ? 'chat healthy' :
                                    lastChatOk === false ? 'chat issues' : 'chat idle'}
                            </span>
                        </div>
                        {/* AI provider chip */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/70">
                            <Cpu className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-slate-400">{provider === 'openai' ? 'openai' : 'ollama'}</span>
                        </div>
                        {/* Tailnet status chip */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/70">
                            <Wifi className={`w-3.5 h-3.5 ${tailnetHealthy === true ? 'text-sky-400' :
                                tailnetHealthy === false ? 'text-amber-400' : 'text-slate-500'
                                }`} />
                            <span className="text-slate-400">
                                {tailnetHealthy === true ? 'tailnet live' :
                                    tailnetHealthy === false ? 'tailnet issues' : 'tailnet idle'}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main layout */}
            <main className="mx-auto max-w-6xl px-4 md:px-6 pt-6 pb-8 grid grid-cols-1 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-6">
                {/* Chat column */}
                <section className="rounded-3xl border border-slate-800/70 bg-gradient-to-b from-slate-950/90 to-slate-950/95 shadow-[0_18px_45px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden">
                    {/* Chat header */}
                    <div className="px-4 sm:px-6 py-3 border-b border-slate-800/70">
                        <div className="flex items-center justify-between gap-3 mb-2">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                    AI Assistant
                                </div>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-base sm:text-lg font-semibold">
                                        Ops Chat Console
                                    </h2>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-700/80 bg-slate-900/80 text-[11px] text-slate-300">
                                        <span
                                            className={`w-1.5 h-1.5 rounded-full ${lastChatOk === true
                                                ? "bg-emerald-400 animate-pulse"
                                                : lastChatOk === false
                                                    ? "bg-amber-400"
                                                    : "bg-slate-500"
                                                }`}
                                        />
                                        <span>
                                            {lastChatOk === true
                                                ? "chat healthy"
                                                : lastChatOk === false
                                                    ? "chat issues"
                                                    : "chat idle"}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        {currentRoom && (() => {
                            const uniqueUsers = [...new Set(messages.filter(m => m.user_name).map(m => m.user_name))];
                            if (uniqueUsers.length > 0) {
                                return (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] uppercase tracking-wider text-slate-500">Active:</span>
                                        {uniqueUsers.map(userName => {
                                            const color = getUserColor(userName);
                                            return (
                                                <span
                                                    key={userName}
                                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r ${color} text-white text-[10px] font-medium shadow-md`}
                                                >
                                                    <span className="w-1 h-1 rounded-full bg-white/80 animate-pulse" />
                                                    {userName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </div>

                    {/* Mode selector */}
                    <div className="px-4 py-2 border-b border-slate-800/50 flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-slate-500 mr-1">Mode:</span>
                        {['default', 'ops', 'play'].map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${mode === m
                                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50'
                                    : 'bg-slate-900/50 text-slate-400 border border-slate-700/50 hover:border-slate-600/70'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 overflow-y-auto space-y-3 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.12),_transparent_55%)]">
                        {messages.map((m, idx) => {
                            const userColor = m.user_name ? getUserColor(m.user_name) : "from-violet-500 to-sky-500";
                            return (
                                <div
                                    key={m.id || idx}
                                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-lg ${m.role === "user"
                                            ? `bg-gradient-to-r ${userColor} text-white rounded-br-sm`
                                            : "bg-slate-900/90 border border-slate-700/70 text-slate-100 rounded-bl-sm"
                                            }`}
                                    >
                                        {m.user_name && m.role === "user" && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="text-[11px] font-semibold text-white/90">
                                                    {m.user_name}
                                                </div>
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                                            </div>
                                        )}
                                        <div className="whitespace-pre-wrap">{m.content}</div>
                                        <div
                                            className={`mt-1 text-[10px] ${m.role === "user" ? "text-white/70" : "text-slate-400/80"
                                                }`}
                                        >
                                            {m.time}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 bg-slate-900/90 border border-slate-700/70 text-[11px] text-slate-400">
                                    <div className="flex gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.12s]" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.24s]" />
                                    </div>
                                    <span>Thinking…</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input bar */}
                    <div className="border-t border-slate-800/80 bg-slate-950/95 px-3 sm:px-4 py-3">
                        <div className="flex gap-2 max-w-screen-lg mx-auto items-end">
                            <textarea
                                ref={inputRef}
                                rows={3}
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={handleComposerKeyDown}
                                placeholder="Ask something about the hub, secrets, TailNet, or Lazlo…"
                                className="flex-1 px-4 py-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 resize-none min-h-[56px] max-h-[120px]"
                            />
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={handleSendMessage}
                                    className="flex items-center justify-center px-3 py-2 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 active:scale-95 shadow-lg shadow-purple-900/40 transition-all"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleLogBug}
                                    className="px-3 py-2 rounded-2xl bg-slate-900/80 border border-amber-500/60 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/10 active:scale-95"
                                >
                                    Log bug
                                </button>
                            </div>
                        </div>
                        {bugStatus === "saved" && (
                            <div className="mt-2 text-[11px] text-emerald-400 text-right">
                                ✓ Bug saved to log
                            </div>
                        )}
                        {error && (
                            <div className="mt-2 text-[11px] text-red-400 px-1">
                                Last error from backend: {error}
                            </div>
                        )}
                    </div>

                    {/* Bug Log - At bottom of chat */}
                    <section className="border-t border-slate-800/80 bg-slate-950/95 px-3 sm:px-4 py-3">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-50">Bug & Idea Log</h3>
                                <p className="text-xs text-slate-400">
                                    Notes you send with <span className="font-semibold text-slate-200">Log bug</span> show up here while you test.
                                </p>
                            </div>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-slate-900 text-slate-300">
                                {bugReports.length} saved
                            </span>
                        </div>

                        {bugReports.length === 0 && (
                            <div className="text-xs text-slate-500 border border-dashed border-slate-700 rounded-xl p-3">
                                No bugs yet. Type in the chat, tap <span className="font-semibold">Log bug</span>, and they’ll collect here.
                            </div>
                        )}

                        {bugReports.length > 0 && (
                            <div className="max-h-64 overflow-y-auto space-y-2">
                                {bugReports.map((bug) => (
                                    <div
                                        key={bug.id}
                                        className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200"
                                    >
                                        <div className="flex justify-between mb-1">
                                            <span className="font-semibold text-slate-100">Note</span>
                                            <span className="text-[10px] text-slate-500">{bug.time}</span>
                                        </div>
                                        <div className="whitespace-pre-wrap">{bug.text}</div>
                                        {bug.context?.content && (
                                            <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-800 pt-1">
                                                Last reply:{" "}
                                                <span className="text-slate-300">
                                                    {bug.context.content.slice(0, 120)}…
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </section>

                {/* Right column – Settings Panel */}
                <aside className="space-y-4">
                    {/* Chat Rooms */}
                    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/95 p-4 sm:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
                        <ChatRoomList
                            currentRoom={currentRoom}
                            onSelectRoom={(room) => {
                                setCurrentRoom(room);
                                setMessages([]);        // flush when switching rooms
                                setLastMessageId(null); // force full reload
                            }}
                        />
                    </div>

                    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/95 p-4 sm:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
                        <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => setControlSurfaceCollapsed(!controlSurfaceCollapsed)}
                        >
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                    Control Surface
                                </div>
                                <div className="text-sm font-semibold text-slate-100">Settings</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4 text-slate-500" />
                                {controlSurfaceCollapsed ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                ) : (
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                )}
                            </div>
                        </div>

                        {!controlSurfaceCollapsed && (
                            <>
                                <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
                                    <ControlChip id="ai" label="AI" icon={Zap} />
                                    <ControlChip id="tailnet" label="TailNet" icon={Wifi} />
                                    <ControlChip id="laz" label="Laz" icon={Cpu} />
                                    <ControlChip id="provider" label="Provider" icon={Server} />
                                    <ControlChip id="bug" label="Bug" icon={Bug} />
                                </div>

                                <div className="mt-4 space-y-4">
                                    {controlTab === "ai" && (
                                        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/95 p-4 sm:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
                                            <div className="flex items-center justify-between gap-3 mb-4">
                                                <div>
                                                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                                        AI Connections
                                                    </div>
                                                    <div className="text-sm font-semibold">Provider & Model</div>
                                                </div>
                                                <Cpu className="w-4 h-4 text-slate-500" />
                                            </div>

                                            <div className="space-y-3 text-sm">
                                                <div>
                                                    <div className="text-xs text-slate-400 mb-1.5">Provider</div>
                                                    <div className="inline-flex rounded-full bg-slate-900/80 border border-slate-700/80 p-1">
                                                        <button
                                                            onClick={() => setProvider("openai")}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${provider === "openai"
                                                                ? "bg-slate-100 text-slate-900"
                                                                : "text-slate-400"
                                                                }`}
                                                        >
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            OpenAI
                                                        </button>
                                                        <button
                                                            onClick={() => setProvider("ollama")}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${provider === "ollama"
                                                                ? "bg-slate-100 text-slate-900"
                                                                : "text-slate-400"
                                                                }`}
                                                        >
                                                            <Cpu className="w-3.5 h-3.5" />
                                                            Ollama
                                                        </button>
                                                    </div>
                                                </div>

                                                {provider === "openai" ? (
                                                    <>
                                                        <div>
                                                            <div className="text-xs text-slate-400 mb-1.5">
                                                                OpenAI API Key
                                                            </div>
                                                            <div className="relative">
                                                                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                                                                <input
                                                                    type="password"
                                                                    value={openaiKey}
                                                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                                                    placeholder="sk-…"
                                                                    className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 pl-8 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-400/70"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-slate-400 mb-1.5">
                                                                Model
                                                            </div>
                                                            <div className="relative">
                                                                <select
                                                                    value={openaiModel}
                                                                    onChange={(e) => setOpenaiModel(e.target.value)}
                                                                    className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 pr-7 text-xs text-slate-100 focus:outline-none focus:border-violet-400/70 appearance-none"
                                                                >
                                                                    <option value="gpt-4o">gpt-4o</option>
                                                                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                                                                    <option value="gpt-4.1">gpt-4.1</option>
                                                                </select>
                                                                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div>
                                                            <div className="text-xs text-slate-400 mb-1.5">
                                                                Ollama URL
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={ollamaUrl}
                                                                onChange={(e) => setOllamaUrl(e.target.value)}
                                                                className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-400/70"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <div className="text-xs text-slate-400">
                                                                    Model
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={fetchOllamaModels}
                                                                    disabled={ollamaModelsLoading}
                                                                    className="text-[10px] px-2 py-0.5 rounded-md border border-slate-700/80 text-slate-300 hover:border-sky-400/70 hover:text-sky-200 transition-colors disabled:opacity-50"
                                                                >
                                                                    {ollamaModelsLoading ? "Loading..." : "Refresh"}
                                                                </button>
                                                            </div>
                                                            {ollamaModels.length > 0 ? (
                                                                <div className="relative">
                                                                    <select
                                                                        value={ollamaModel}
                                                                        onChange={(e) => setOllamaModel(e.target.value)}
                                                                        className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 pr-7 text-xs text-slate-100 focus:outline-none focus:border-violet-400/70 appearance-none"
                                                                    >
                                                                        {ollamaModels.map((model) => (
                                                                            <option key={model} value={model}>
                                                                                {model}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    <ChevronDown className="w-3 h-3 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                                                                </div>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={ollamaModel}
                                                                    onChange={(e) => setOllamaModel(e.target.value)}
                                                                    placeholder="Click Refresh to load models"
                                                                    className="w-full rounded-xl bg-slate-900/80 border border-slate-700/80 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-400/70"
                                                                />
                                                            )}
                                                        </div>
                                                    </>
                                                )}

                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-slate-400">Temperature</span>
                                                        <span className="text-[11px] text-slate-500">
                                                            {temp.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.01"
                                                        value={temp}
                                                        onChange={(e) => setTemp(parseFloat(e.target.value))}
                                                        className="w-full h-1.5 rounded-full bg-slate-800 appearance-none cursor-pointer"
                                                        style={{
                                                            background: `linear-gradient(to right, rgba(129,140,248,1) 0%, rgba(56,189,248,1) ${temp * 100}%, rgba(15,23,42,1) ${temp * 100}%, rgba(15,23,42,1) 100%)`,
                                                        }}
                                                    />
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={handleTestConnection}
                                                    className="mt-2 inline-flex items-center justify-center w-full rounded-2xl bg-slate-100 text-slate-900 text-xs font-semibold px-3 py-2 hover:bg-white transition-colors"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                                                    Test Connection (mock)
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {controlTab === "tailnet" && (
                                        <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-slate-200">TailNet Status</span>
                                                <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                    {tailnetHealthy === false
                                                        ? "issues"
                                                        : tailnetHealthy === true
                                                            ? "healthy"
                                                            : "idle"}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400">
                                                This pane will eventually surface live TailScale node health, latency, and reachability.
                                            </p>
                                            {tailnetError && (
                                                <div className="text-[11px] text-rose-400">
                                                    Failed to load: {tailnetError}
                                                </div>
                                            )}
                                            {tailnetLoading && (
                                                <div className="text-[11px] text-slate-400">Refreshing TailNet preview…</div>
                                            )}
                                            {tailnetStats && !tailnetLoading && !tailnetError && (
                                                <div className="space-y-1 text-xs text-slate-300">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Devices online</span>
                                                        <span className="font-semibold">{tailnetStats.devices_online ?? "?"}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Total devices</span>
                                                        <span className="font-semibold">{tailnetStats.devices_total ?? "?"}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Exit node</span>
                                                        <span className="font-semibold">{tailnetStats.exit_node ?? "none"}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Last check</span>
                                                        <span className="font-semibold">{tailnetStats.last_check ?? "unknown"}</span>
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={refreshTailnetStats}
                                                className="w-full rounded-xl border border-slate-700/80 px-3 py-2 text-[11px] text-slate-200 hover:border-sky-400/70 hover:text-sky-200 transition-colors"
                                            >
                                                Refresh TailNet
                                            </button>
                                        </div>
                                    )}

                                    {controlTab === "laz" && (
                                        <div className="p-4 rounded-2xl bg-slate-900/70 border border-purple-500/40 space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-50">Lazlo Mode</h3>
                                                    <p className="text-xs text-slate-400">
                                                        Toggle a playful systems-engineer persona for the AI: eccentric, tailnet-obsessed, but technically accurate.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => setLazloMode((prev) => !prev)}
                                                    className={
                                                        "px-4 py-1.5 rounded-full text-xs font-semibold transition-all " +
                                                        (lazloMode
                                                            ? "bg-purple-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.7)]"
                                                            : "bg-slate-800 text-slate-300 border border-slate-600")
                                                    }
                                                >
                                                    {lazloMode ? "ON" : "OFF"}
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-slate-500">
                                                When ON, future API calls from this console should include a Lazlo-flavored system prompt. For now, this just tracks state in the UI.
                                            </p>
                                        </div>
                                    )}

                                    {controlTab === "provider" && (
                                        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-700 space-y-3">
                                            <h3 className="text-sm font-semibold text-slate-50">Routing Presets</h3>
                                            <p className="text-xs text-slate-400">
                                                Quick shortcuts for how this console should talk to your models.
                                            </p>
                                            <div className="grid grid-cols-3 gap-2 text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setProvider("openai");
                                                        setOpenaiModel("gpt-4o");
                                                        setTemp(0.3);
                                                    }}
                                                    className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-100"
                                                >
                                                    Steady Ops
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setProvider("ollama");
                                                        setOllamaModel("llama3");
                                                        setTemp(0.7);
                                                    }}
                                                    className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-100"
                                                >
                                                    Local Playground
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setProvider("openai");
                                                        setOpenaiModel("gpt-4o");
                                                        setTemp(0.95);
                                                    }}
                                                    className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-purple-500/60 text-slate-100"
                                                >
                                                    Neon Chat
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {controlTab === "bug" && (
                                        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                                            <h3 className="text-sm font-semibold text-slate-50">Bug Surface</h3>
                                            <p className="text-xs text-slate-400">
                                                Type in the chat box and hit <span className="font-semibold text-slate-200">Log bug</span> to capture glitches and ideas below.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </aside>

            </main>
        </div>
    );
}; export default ChatOpsConsole;
