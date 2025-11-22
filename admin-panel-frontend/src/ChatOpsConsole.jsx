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
    Server,
    Zap,
    Menu,
    X,
    MessageSquare,
    Activity,
    Home,
    Share2,
    Database,
    BarChart3,
    Cloud,
    User,
    Bug,
    Trash2,
} from "lucide-react";
import ChatRoomList from "./ChatRoomList";

const nowTime = () =>
    new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });

// Auto-detect API base URL - use same host as frontend for remote access
const getApiBase = () => {
    const hostname = window.location.hostname;
    // If accessed via Tailscale IP or hostname, use that for backend too
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:8000`;
    }
    return "http://localhost:8000";
};

const API_BASE = getApiBase();

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

    // Ref for auto-scroll to bottom
    const messagesEndRef = React.useRef(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

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
        return localStorage.getItem("chatops_ollama_model") || "glm4:latest";
    });
    const [temp, setTemp] = useState(() => {
        const saved = localStorage.getItem("chatops_temperature");
        return saved ? parseFloat(saved) : 0.7;
    });
    const [chatSize, setChatSize] = useState(() => {
        const saved = localStorage.getItem("chatops_chat_size");
        return saved || "medium"; // small, medium, large
    });

    const [lastTestStatus, setLastTestStatus] = useState(null);
    const [error, setError] = useState(null);

    const [controlTab, setControlTab] = useState("ai");
    const [lazloMode, setLazloMode] = useState(false);
    const [controlSurfaceCollapsed, setControlSurfaceCollapsed] = useState(false);

    const [bugReports, setBugReports] = useState([]);
    const [bugStatus, setBugStatus] = useState(null);
    const [bugLogCollapsed, setBugLogCollapsed] = useState(true);

    // Mobile navigation
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeView, setActiveView] = useState("chat"); // dashboard, chat, connections, cloud, stats, system

    // Bulletin board
    const [bulletinPosts, setBulletinPosts] = useState(() => {
        const saved = localStorage.getItem("chatops_bulletin_posts");
        return saved ? JSON.parse(saved) : [];
    });
    const [bulletinInput, setBulletinInput] = useState("");

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

    React.useEffect(() => {
        localStorage.setItem("chatops_chat_size", chatSize);
    }, [chatSize]);

    React.useEffect(() => {
        localStorage.setItem("chatops_bulletin_posts", JSON.stringify(bulletinPosts));
    }, [bulletinPosts]);

    // Auto-scroll to bottom when messages change
    React.useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Load messages from backend when room changes
    React.useEffect(() => {
        let cancelled = false;

        const loadMessages = async () => {
            setIsLoadingMessages(true);
            try {
                const res = await fetch(`${API_BASE}/chat/rooms/${currentRoom.id}/messages`);
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
                    ? `${API_BASE}/chat/rooms/${currentRoom.id}/messages?since_id=${lastMessageId}`
                    : `${API_BASE}/chat/rooms/${currentRoom.id}/messages`;

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
            const saveRes = await fetch(`${API_BASE}/chat/rooms/${currentRoom.id}/messages`, {
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
            await fetch(`${API_BASE}/chat/rooms/${currentRoom.id}/messages`, {
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

    const refreshOllamaModels = async () => {
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
            console.error("Ollama models error:", err);
            setOllamaModels([]);
        } finally {
            setOllamaModelsLoading(false);
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
        <div className="flex flex-col h-screen w-full bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-50 overflow-hidden">
            {/* Sleek Top Header with Status Chips */}
            <header className="flex-none border-b border-slate-800/50 bg-slate-950/98 backdrop-blur-xl">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="text-sm font-bold tracking-tight">ChatOps</div>
                            <div className="text-[10px] text-slate-400 font-medium">AI Infrastructure</div>
                        </div>
                    </div>

                    {/* Status Chips */}
                    <div className="flex items-center gap-2 text-xs">
                        {/* API Status */}
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${provider === 'openai' && !openaiKey ? 'bg-amber-500/10 border-amber-500/30' :
                            provider === 'ollama' && ollamaModels.length === 0 ? 'bg-amber-500/10 border-amber-500/30' :
                                lastChatOk === true ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700/50'
                            }`}>
                            <Cpu className={`w-3.5 h-3.5 ${provider === 'openai' && !openaiKey ? 'text-amber-400' :
                                provider === 'ollama' && ollamaModels.length === 0 ? 'text-amber-400' :
                                    lastChatOk === true ? 'text-emerald-400' : 'text-slate-500'
                                }`} />
                            <span className="hidden sm:inline text-[11px] font-medium">
                                {provider === 'openai' ? 'OpenAI' : 'Ollama'}
                            </span>
                        </div>

                        {/* Tailscale Status */}
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${tailnetHealthy === true ? 'bg-sky-500/10 border-sky-500/30' : 'bg-slate-800/50 border-slate-700/50'
                            }`}>
                            <Wifi className={`w-3.5 h-3.5 ${tailnetHealthy === true ? 'text-sky-400' : 'text-slate-500'}`} />
                            <span className="hidden md:inline text-[11px] font-medium">
                                {tailnetHealthy ? 'Connected' : 'Offline'}
                            </span>
                        </div>

                        {/* Cloud Storage Status */}
                        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-slate-800/50 border-slate-700/50">
                            <Cloud className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-[11px] font-medium text-slate-400">Storage</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile slide-out menu */}
            {mobileMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                        onClick={() => setMobileMenuOpen(false)}
                    />

                    {/* Drawer */}
                    <div className="lg:hidden fixed inset-y-0 left-0 w-72 bg-slate-950/98 border-r border-slate-800/70 shadow-2xl z-50 flex flex-col">
                        <div className="p-4 flex-none">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center">
                                        <Shield className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-sm font-semibold">Menu</span>
                                </div>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-1 rounded-lg hover:bg-slate-800/70"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            {/* Status visualizers at top */}
                            <div className="space-y-3 pb-6 border-b border-slate-800/70">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Provider</span>
                                    <span className="text-slate-300 font-medium">{provider === 'openai' ? 'OpenAI' : 'Ollama'}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Room</span>
                                    <span className="text-slate-300 font-medium">{currentRoom.name}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Tailnet</span>
                                    <span className={`font-medium ${tailnetHealthy ? 'text-sky-400' : 'text-slate-500'}`}>
                                        {tailnetHealthy ? 'Connected' : 'Unknown'}
                                    </span>
                                </div>

                                {/* Font Size Control */}
                                <div className="pt-3 border-t border-slate-800/70">
                                    <label className="block text-xs text-slate-500 mb-2">Chat Text Size</label>
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={() => setChatSize("small")}
                                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${chatSize === "small"
                                                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                }`}
                                        >
                                            S
                                        </button>
                                        <button
                                            onClick={() => setChatSize("medium")}
                                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${chatSize === "medium"
                                                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                }`}
                                        >
                                            M
                                        </button>
                                        <button
                                            onClick={() => setChatSize("large")}
                                            className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${chatSize === "large"
                                                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                }`}
                                        >
                                            L
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Spacer to push navigation to bottom */}
                        <div className="flex-1"></div>

                        {/* Navigation tabs at bottom for thumb reachability */}
                        <nav className="p-4 flex-none space-y-2">
                            <button
                                onClick={() => {
                                    setActiveView("dashboard");
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${activeView === "dashboard"
                                    ? "bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg"
                                    : "text-slate-300 hover:bg-slate-800/70"
                                    }`}
                            >
                                <Home className="w-6 h-6" />
                                <span>Dashboard</span>
                            </button>

                            <button
                                onClick={() => {
                                    setActiveView("chat");
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${activeView === "chat"
                                    ? "bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg"
                                    : "text-slate-300 hover:bg-slate-800/70"
                                    }`}
                            >
                                <MessageSquare className="w-6 h-6" />
                                <span>Chat</span>
                            </button>

                            <button
                                onClick={() => {
                                    setActiveView("connections");
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${activeView === "connections"
                                    ? "bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg"
                                    : "text-slate-300 hover:bg-slate-800/70"
                                    }`}
                            >
                                <Share2 className="w-6 h-6" />
                                <span>Connections</span>
                            </button>

                            <button
                                onClick={() => {
                                    setActiveView("cloud");
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${activeView === "cloud"
                                    ? "bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg"
                                    : "text-slate-300 hover:bg-slate-800/70"
                                    }`}
                            >
                                <Database className="w-6 h-6" />
                                <span>Cloud</span>
                            </button>

                            <button
                                onClick={() => {
                                    setActiveView("stats");
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${activeView === "stats"
                                    ? "bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg"
                                    : "text-slate-300 hover:bg-slate-800/70"
                                    }`}
                            >
                                <BarChart3 className="w-6 h-6" />
                                <span>Stats / Metrics</span>
                            </button>

                            <button
                                onClick={() => {
                                    setActiveView("system");
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${activeView === "system"
                                    ? "bg-gradient-to-r from-violet-600 to-sky-600 text-white shadow-lg"
                                    : "text-slate-300 hover:bg-slate-800/70"
                                    }`}
                            >
                                <User className="w-6 h-6" />
                                <span>Rooms / Users</span>
                            </button>
                        </nav>
                    </div>
                </>
            )}            {/* Global warning banner for API key issues - sits below header */}
            {(() => {
                const noOpenAI = provider === 'openai' && !openaiKey;
                const noOllama = provider === 'ollama' && ollamaModels.length === 0;
                if (noOpenAI || noOllama) {
                    return (
                        <div className="flex-none px-3 sm:px-4 py-2 text-xs bg-amber-900/40 border-b border-amber-600/40 flex items-start gap-2">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 text-[10px] font-bold mt-0.5">!</span>
                            <div className="flex-1 leading-relaxed">
                                {noOpenAI && (
                                    <span>
                                        <span className="font-semibold text-amber-200">OpenAI key missing.</span> Enter an API key in Provider tab or switch to Ollama.
                                    </span>
                                )}
                                {noOllama && (
                                    <span>
                                        <span className="font-semibold text-amber-200">No Ollama models.</span> Start Ollama then click Refresh Models in Settings.
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            {/* Main layout - flex for full height */}
            <main className="flex-1 mx-auto max-w-6xl w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 overflow-hidden">
                {/* Desktop: 2-column layout, Mobile: single view based on activeView */}
                <div className="h-full grid grid-cols-1 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-3 sm:gap-4">
                    {/* Chat column - always visible on desktop, conditionally on mobile */}
                    <section className={`rounded-2xl sm:rounded-3xl border border-slate-800/70 bg-gradient-to-b from-slate-950/90 to-slate-950/95 shadow-[0_18px_45px_rgba(0,0,0,0.75)] flex flex-col overflow-hidden h-full ${activeView !== 'chat' ? 'hidden lg:flex' : ''
                        }`}>
                        {/* Simplified Chat header */}
                        <div className="flex-none px-3 sm:px-4 py-2 border-b border-slate-800/70 bg-slate-950/60">
                            {currentRoom && (() => {
                                const uniqueUsers = [...new Set(messages.filter(m => m.user_name).map(m => m.user_name))];
                                if (uniqueUsers.length > 0) {
                                    return (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[9px] uppercase tracking-wider text-slate-500">Active:</span>
                                            {uniqueUsers.slice(0, 4).map(userName => {
                                                const color = getUserColor(userName);
                                                return (
                                                    <span
                                                        key={userName}
                                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r ${color} text-white text-[9px] font-medium shadow-sm`}
                                                    >
                                                        <span className="w-1 h-1 rounded-full bg-white/80" />
                                                        {userName}
                                                    </span>
                                                );
                                            })}
                                            {uniqueUsers.length > 4 && (
                                                <span className="text-[9px] text-slate-500">+{uniqueUsers.length - 4}</span>
                                            )}
                                        </div>
                                    );
                                }
                                return <div className="text-[10px] text-slate-500">{currentRoom.name} • Team chat</div>;
                            })()}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 overflow-y-auto space-y-3 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(129,140,248,0.12),_transparent_55%)]">
                            {messages.map((m, idx) => {
                                const userColor = m.user_name ? getUserColor(m.user_name) : "from-violet-500 to-sky-500";
                                const isUser = m.role === "user";
                                const sizeClass = chatSize === "small" ? "text-xs" : chatSize === "large" ? "text-base" : "text-sm";

                                return (
                                    <div
                                        key={m.id || idx}
                                        className={`flex gap-2 ${isUser ? "justify-end flex-row-reverse" : "justify-start"}`}
                                    >
                                        {/* Metadata - Outside the bubble for both user and assistant */}
                                        <div className={`flex flex-col gap-0.5 justify-end pb-1 min-w-[60px] ${isUser ? "items-end" : "items-start"}`}>
                                            {/* Show username for users, "Assistant" for AI */}
                                            <div className="text-[10px] font-medium text-slate-400">
                                                {isUser ? (m.user_name || "User") : "Assistant"}
                                            </div>
                                            <div className="text-[9px] text-slate-500">
                                                {m.time}
                                            </div>
                                            {m.model && !isUser && (
                                                <div className="text-[8px] text-slate-600 font-mono">
                                                    {m.model.split(':')[0]}
                                                </div>
                                            )}
                                        </div>

                                        {/* Message Bubble - Clean, no internal metadata */}
                                        <div
                                            className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${sizeClass} shadow-lg ${isUser
                                                ? `bg-gradient-to-r ${userColor} text-white rounded-br-sm`
                                                : "bg-gradient-to-br from-indigo-600/90 to-purple-700/90 border border-indigo-500/30 text-white rounded-bl-sm"
                                                }`}
                                        >
                                            <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
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
                            {/* Scroll anchor */}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input bar - Sticky at bottom of chat container, 3 lines tall */}
                        <div className="flex-none border-t border-slate-800/80 bg-slate-950/98 px-3 sm:px-4 py-3">
                            <div className="flex gap-2.5 items-end">
                                <textarea
                                    ref={inputRef}
                                    rows={3}
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={handleComposerKeyDown}
                                    placeholder="Ask about the hub, secrets, or TailNet…"
                                    className="flex-1 px-4 py-3 bg-slate-800/60 border border-slate-700/60 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 resize-none"
                                    style={{ WebkitUserSelect: 'text', minHeight: '84px', maxHeight: '120px' }}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className="flex items-center justify-center px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 shadow-lg shadow-emerald-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ minHeight: '84px' }}
                                    disabled={isThinking}
                                >
                                    <Send className="w-5 h-5 text-white" />
                                </button>
                            </div>
                            {error && (
                                <div className="mt-2 text-[11px] text-red-400 px-1">
                                    Last error from backend: {error}
                                </div>
                            )}
                        </div>

                        {/* Bug Log - At bottom of chat - REMOVED */}
                        {/* <section className="border-t border-slate-800/80 bg-slate-950/95 px-3 sm:px-4 py-3">
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
                        </section> */}
                    </section>

                    {/* Floating Burger Button - Bottom Right (Mobile Only) */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden fixed bottom-24 right-6 z-50 p-4 rounded-full bg-gradient-to-br from-amber-600 to-orange-600 shadow-2xl shadow-amber-900/50 hover:scale-110 active:scale-95 transition-transform"
                    >
                        {mobileMenuOpen ? (
                            <X className="w-6 h-6 text-white" />
                        ) : (
                            <Menu className="w-6 h-6 text-white" />
                        )}
                    </button>

                    {/* Mobile-only view content */}
                    {activeView === 'dashboard' && (
                        <div className="lg:hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.75)] overflow-y-auto h-full">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Home className="w-5 h-5" />
                                Community Dashboard
                            </h2>
                            <div className="space-y-4">
                                {/* Welcome Message */}
                                <div className="rounded-xl border border-violet-700/50 bg-gradient-to-br from-violet-950/60 to-indigo-950/60 p-4">
                                    <h3 className="text-sm font-semibold mb-2 text-violet-300">Welcome to The Local Build!</h3>
                                    <p className="text-xs text-slate-300 mb-3 leading-relaxed">
                                        Hey! Connect to our Tailscale network to join the chat. Scan the QR code below or visit the URL directly. Once connected, you'll be able to chat with the team and our AI assistants.
                                    </p>
                                    <div className="bg-white p-2 rounded-lg inline-block">
                                        <img
                                            src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=http://100.88.23.90:5180/"
                                            alt="QR Code"
                                            className="w-32 h-32"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2 font-mono">http://100.88.23.90:5180/</p>
                                </div>

                                {/* Bulletin Board */}
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Community Bulletin Board
                                    </h3>

                                    {/* Post Input */}
                                    <div className="mb-4">
                                        <textarea
                                            value={bulletinInput}
                                            onChange={(e) => setBulletinInput(e.target.value)}
                                            placeholder="Share an update, idea, or announcement..."
                                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none"
                                            rows={3}
                                        />
                                        <button
                                            onClick={() => {
                                                if (bulletinInput.trim()) {
                                                    setBulletinPosts([
                                                        {
                                                            id: Date.now(),
                                                            text: bulletinInput.trim(),
                                                            time: nowTime(),
                                                            date: new Date().toLocaleDateString()
                                                        },
                                                        ...bulletinPosts
                                                    ]);
                                                    setBulletinInput("");
                                                }
                                            }}
                                            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-semibold transition-all"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            Post to Board
                                        </button>
                                    </div>

                                    {/* Posts */}
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {bulletinPosts.length === 0 && (
                                            <p className="text-xs text-slate-500 text-center py-4">No posts yet. Be the first to share!</p>
                                        )}
                                        {bulletinPosts.map((post) => (
                                            <div key={post.id} className="bg-slate-900/60 border border-slate-800 rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] text-slate-500">{post.date} • {post.time}</span>
                                                    <button
                                                        onClick={() => setBulletinPosts(bulletinPosts.filter(p => p.id !== post.id))}
                                                        className="text-slate-600 hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-200 whitespace-pre-wrap">{post.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'connections' && (
                        <div className="lg:hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.75)] overflow-y-auto h-full">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Share2 className="w-5 h-5" />
                                Connections
                            </h2>
                            <div className="space-y-4">
                                {/* AI Provider Settings */}
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                                    <h3 className="text-sm font-semibold mb-3">AI Provider</h3>
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            onClick={() => setProvider("openai")}
                                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${provider === "openai"
                                                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                }`}
                                        >
                                            OpenAI
                                        </button>
                                        <button
                                            onClick={() => setProvider("ollama")}
                                            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${provider === "ollama"
                                                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                }`}
                                        >
                                            Ollama
                                        </button>
                                    </div>

                                    {provider === "openai" && (
                                        <div className="space-y-2">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">API Key</label>
                                                <input
                                                    type="password"
                                                    value={openaiKey}
                                                    onChange={(e) => setOpenaiKey(e.target.value)}
                                                    placeholder="sk-..."
                                                    className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">Model</label>
                                                <input
                                                    type="text"
                                                    value={openaiModel}
                                                    onChange={(e) => setOpenaiModel(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {provider === "ollama" && (
                                        <div className="space-y-2">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">Ollama URL</label>
                                                <input
                                                    type="text"
                                                    value={ollamaUrl}
                                                    onChange={(e) => setOllamaUrl(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">Model</label>
                                                <input
                                                    type="text"
                                                    value={ollamaModel}
                                                    onChange={(e) => setOllamaModel(e.target.value)}
                                                    className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs"
                                                />
                                            </div>
                                            <button
                                                onClick={refreshOllamaModels}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-300 text-xs hover:bg-slate-800/70"
                                            >
                                                <RefreshCw className={`w-3.5 h-3.5 ${ollamaModelsLoading ? 'animate-spin' : ''}`} />
                                                Refresh Models
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Tailscale Devices */}
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                                    <h3 className="text-sm font-semibold mb-3">Tailscale Devices</h3>
                                    <button
                                        onClick={async () => {
                                            setTailnetLoading(true);
                                            setTailnetError(null);
                                            try {
                                                const res = await fetch(`${API_BASE}/api/system/tailscale/summary`);
                                                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                                                const data = await res.json();
                                                setTailnetStats(data);
                                                setTailnetHealthy(true);
                                            } catch (err) {
                                                setTailnetError(err.message);
                                                setTailnetHealthy(false);
                                            } finally {
                                                setTailnetLoading(false);
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-300 text-sm hover:bg-slate-800/70"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${tailnetLoading ? 'animate-spin' : ''}`} />
                                        Load Tailnet Info
                                    </button>
                                    {tailnetStats && (
                                        <div className="mt-3 space-y-2 text-xs">
                                            <div className="flex justify-between">
                                                <span className="text-slate-500">Device Count</span>
                                                <span className="text-slate-300">{tailnetStats.device_count || 'N/A'}</span>
                                            </div>
                                        </div>
                                    )}
                                    {tailnetError && (
                                        <div className="mt-3 text-xs text-red-400">Error: {tailnetError}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'cloud' && (
                        <div className="lg:hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.75)] overflow-y-auto h-full">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Cloud className="w-5 h-5" />
                                Cloud Storage
                            </h2>
                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                                    <p className="text-xs text-slate-400">Cloud storage integration coming soon</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'stats' && (
                        <div className="lg:hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.75)] overflow-y-auto h-full">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Stats & Metrics
                            </h2>
                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                                    <h3 className="text-sm font-semibold mb-2">Performance Metrics</h3>
                                    <p className="text-xs text-slate-400">Analytics coming soon</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeView === 'system' && (
                        <div className="lg:hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.75)] overflow-y-auto h-full">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Rooms & Users
                            </h2>

                            <div className="space-y-4">
                                {/* Active Users */}
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Active Users
                                    </h3>
                                    <div className="space-y-2">
                                        {(() => {
                                            const uniqueUsers = [...new Set(messages.filter(m => m.user_name).map(m => m.user_name))];
                                            if (uniqueUsers.length === 0) {
                                                return <p className="text-xs text-slate-500">No active users yet</p>;
                                            }
                                            return uniqueUsers.map(userName => {
                                                const color = getUserColor(userName);
                                                return (
                                                    <div key={userName} className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/60">
                                                        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${color}`} />
                                                        <span className="text-sm text-slate-200">{userName}</span>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>

                                {/* Chat Rooms */}
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Chat Rooms
                                    </h3>
                                    <ChatRoomList
                                        currentRoom={currentRoom}
                                        onSelectRoom={(room) => {
                                            setCurrentRoom(room);
                                            setMessages([]);
                                            setLastMessageId(null);
                                            setActiveView("chat");
                                            setMobileMenuOpen(false);
                                        }}
                                    />
                                </div>

                                {/* Network Info */}
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <Wifi className="w-4 h-4" />
                                        Network Info
                                    </h3>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Backend</span>
                                            <span className="text-slate-300 font-mono">{API_BASE}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Status</span>
                                            <span className={lastChatOk ? 'text-emerald-400' : 'text-slate-500'}>
                                                {lastChatOk ? 'Connected' : 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Right column – Settings Panel (Desktop: always visible, Mobile: only on 'chat' view) */}
                    <aside className="hidden lg:block space-y-4 overflow-y-auto">
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

                    {/* Mobile-only full-screen panels */}
                    {activeView === 'settings' && (
                        <div className="lg:hidden rounded-2xl border border-slate-800/70 bg-slate-950/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.75)] overflow-y-auto h-full">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Settings
                            </h2>
                            {/* Settings content - reuse from aside */}
                            <div className="space-y-4">
                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/95 p-4">
                                    <ChatRoomList
                                        currentRoom={currentRoom}
                                        onSelectRoom={(room) => {
                                            setCurrentRoom(room);
                                            setMessages([]);
                                            setLastMessageId(null);
                                            setActiveView('chat');
                                        }}
                                    />
                                </div>

                                <div className="rounded-xl border border-slate-800/70 bg-slate-950/95 p-4">
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-3">
                                        Control Surface
                                    </div>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        <button
                                            onClick={() => setControlTab("ai")}
                                            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${controlTab === "ai"
                                                ? "bg-slate-800 text-slate-50 border border-purple-500/60"
                                                : "bg-slate-900/60 text-slate-400 border border-slate-700"
                                                }`}
                                        >
                                            <Zap className="w-3.5 h-3.5" />
                                            <span>AI</span>
                                        </button>
                                        <button
                                            onClick={() => setControlTab("tailnet")}
                                            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${controlTab === "tailnet"
                                                ? "bg-slate-800 text-slate-50 border border-purple-500/60"
                                                : "bg-slate-900/60 text-slate-400 border border-slate-700"
                                                }`}
                                        >
                                            <Wifi className="w-3.5 h-3.5" />
                                            <span>TailNet</span>
                                        </button>
                                        <button
                                            onClick={() => setControlTab("laz")}
                                            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${controlTab === "laz"
                                                ? "bg-slate-800 text-slate-50 border border-purple-500/60"
                                                : "bg-slate-900/60 text-slate-400 border border-slate-700"
                                                }`}
                                        >
                                            <Cpu className="w-3.5 h-3.5" />
                                            <span>Laz</span>
                                        </button>
                                        <button
                                            onClick={() => setControlTab("provider")}
                                            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${controlTab === "provider"
                                                ? "bg-slate-800 text-slate-50 border border-purple-500/60"
                                                : "bg-slate-900/60 text-slate-400 border border-slate-700"
                                                }`}
                                        >
                                            <Server className="w-3.5 h-3.5" />
                                            <span>Provider</span>
                                        </button>
                                        <button
                                            onClick={() => setControlTab("bug")}
                                            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium transition-all ${controlTab === "bug"
                                                ? "bg-slate-800 text-slate-50 border border-purple-500/60"
                                                : "bg-slate-900/60 text-slate-400 border border-slate-700"
                                                }`}
                                        >
                                            <Bug className="w-3.5 h-3.5" />
                                            <span>Bug</span>
                                        </button>
                                    </div>

                                    {/* Provider settings */}
                                    {controlTab === "provider" && (
                                        <div className="mt-4 space-y-3">
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-2">Provider</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setProvider("openai")}
                                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${provider === "openai"
                                                            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                            : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                            }`}
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5" />
                                                        OpenAI
                                                    </button>
                                                    <button
                                                        onClick={() => setProvider("ollama")}
                                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${provider === "ollama"
                                                            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                            : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                            }`}
                                                    >
                                                        <Cpu className="w-3.5 h-3.5" />
                                                        Ollama
                                                    </button>
                                                </div>
                                            </div>

                                            {provider === "openai" && (
                                                <>
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-2">API Key</label>
                                                        <input
                                                            type="password"
                                                            value={openaiKey}
                                                            onChange={(e) => setOpenaiKey(e.target.value)}
                                                            placeholder="sk-..."
                                                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-2">Model</label>
                                                        <input
                                                            type="text"
                                                            value={openaiModel}
                                                            onChange={(e) => setOpenaiModel(e.target.value)}
                                                            placeholder="gpt-4o"
                                                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {provider === "ollama" && (
                                                <>
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-2">Ollama URL</label>
                                                        <input
                                                            type="text"
                                                            value={ollamaUrl}
                                                            onChange={(e) => setOllamaUrl(e.target.value)}
                                                            placeholder="http://localhost:11434"
                                                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-2">Model</label>
                                                        <input
                                                            type="text"
                                                            value={ollamaModel}
                                                            onChange={(e) => setOllamaModel(e.target.value)}
                                                            placeholder="glm4:latest"
                                                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            <div>
                                                <label className="block text-xs text-slate-400 mb-2">Temperature: {temp}</label>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.1"
                                                    value={temp}
                                                    onChange={(e) => setTemp(parseFloat(e.target.value))}
                                                    className="w-full"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs text-slate-400 mb-2">Chat Text Size</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setChatSize("small")}
                                                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${chatSize === "small"
                                                            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                            : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                            }`}
                                                    >
                                                        Small
                                                    </button>
                                                    <button
                                                        onClick={() => setChatSize("medium")}
                                                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${chatSize === "medium"
                                                            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                            : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                            }`}
                                                    >
                                                        Medium
                                                    </button>
                                                    <button
                                                        onClick={() => setChatSize("large")}
                                                        className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${chatSize === "large"
                                                            ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                                                            : "bg-slate-900/80 border border-slate-700 text-slate-400"
                                                            }`}
                                                    >
                                                        Large
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}; export default ChatOpsConsole;
