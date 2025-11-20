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
    MessageSquare,
    Shield,
    ChevronDown,
    CheckCircle2,
} from "lucide-react";

const nowTime = () =>
    new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
    });

const API_BASE =
    import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;

const ChatOpsConsole = () => {
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content:
                "Welcome to the ChatOps Neon shell. This is a standalone sandbox — no real API calls yet, but the layout is exactly where your Tailnet brain will plug in.",
            time: nowTime(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);

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

    // Settings tabs
    const [settingsTab, setSettingsTab] = useState("ai");

    // Tailnet stats
    const [tailnetStats, setTailnetStats] = useState(null);
    const [tailnetLoading, setTailnetLoading] = useState(false);
    const [tailnetError, setTailnetError] = useState(null);

    // User summary
    const [userSummary, setUserSummary] = useState(null);
    const [userLoading, setUserLoading] = useState(false);
    const [userError, setUserError] = useState(null);

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

    const handleSend = async () => {
        const value = input.trim();
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
        setInput("");
        setIsThinking(true);

        try {
            // build payload for your FastAPI backend
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

            // Adjust this to match whatever your backend returns
            const replyText =
                data.reply ||
                data.message ||
                data.content ||
                (typeof data === "string" ? data : JSON.stringify(data, null, 2));

            // Tag reply with provider/model info
            const modelLabel =
                effectiveProvider === "openai"
                    ? `${effectiveProvider}:${openaiModel}`
                    : `${effectiveProvider}:${ollamaModel}`;

            const aiMessage = {
                role: "assistant",
                content: `${replyText}\n\n— [${modelLabel} • temp=${temp.toFixed(2)}]`,
                time: nowTime(),
            };
            setMessages((prev) => [...prev, aiMessage]);
            setLastChatOk(true); // Mark chat as healthy
        } catch (err) {
            console.error("Chat API error:", err);
            setError(err.message || "Unknown error");
            setLastChatOk(false); // Mark chat as unhealthy

            // show the failure in the chat stream so you see it over Tailnet
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `⚠️ Chat call failed.\n\nEndpoint: ${API_BASE}/api/chat/chat\nError: ${err.message || err
                        }`,
                    time: nowTime(),
                },
            ]);
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
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

    const refreshUserSummary = async () => {
        setUserLoading(true);
        setUserError(null);
        try {
            const res = await fetch(`${API_BASE}/api/users/admin/summary`, {
                method: "GET",
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const data = await res.json();
            setUserSummary(data);
        } catch (err) {
            console.error("User summary error:", err);
            setUserError(err.message || "Unknown error");
            setUserSummary(null);
        } finally {
            setUserLoading(false);
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
                    <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-slate-800/70 flex items-center justify-between gap-3">
                        <div>
                            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                AI Assistant
                            </div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-semibold">
                                    Ops Chat Console
                                </h2>
                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-violet-500/50 text-violet-300 bg-violet-500/10">
                                    preview
                                </span>
                            </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400">
                            <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                            <span>Chat history stored in memory only</span>
                        </div>
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
                        {messages.map((m, idx) => (
                            <div
                                key={idx}
                                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"
                                    }`}
                            >
                                <div
                                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-lg ${m.role === "user"
                                        ? "bg-gradient-to-r from-violet-500 to-sky-500 text-white rounded-br-sm"
                                        : "bg-slate-900/90 border border-slate-700/70 text-slate-100 rounded-bl-sm"
                                        }`}
                                >
                                    <div className="whitespace-pre-wrap">{m.content}</div>
                                    <div
                                        className={`mt-1 text-[10px] ${m.role === "user"
                                            ? "text-white/70"
                                            : "text-slate-400/80"
                                            }`}
                                    >
                                        {m.time}
                                    </div>
                                </div>
                            </div>
                        ))}

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
                        <div className="text-[10px] text-slate-500 mb-1.5 px-1">
                            This console is **front-end only** right now. Once we're ready,
                            this is where we'll connect to your Tailnet AI router (OpenAI /
                            Ollama / local FastAPI).
                        </div>
                        <div className="flex items-end gap-2">
                            <textarea
                                rows={1}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask something about the hub, secrets, or ops…"
                                className="flex-1 resize-none rounded-2xl bg-slate-900/80 border border-slate-700/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400/70"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isThinking}
                                className="inline-flex items-center justify-center rounded-2xl px-3.5 py-2 bg-gradient-to-r from-violet-500 to-sky-500 text-white text-sm font-semibold shadow-lg shadow-violet-900/40 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
                            >
                                <Send className="w-4 h-4 mr-1" />
                                Send
                            </button>
                        </div>
                        {error && (
                            <div className="mt-2 text-[11px] text-red-400 px-1">
                                Last error from backend: {error}
                            </div>
                        )}
                    </div>
                </section>

                {/* Right column – Settings Panel */}
                <aside className="space-y-4">
                    {/* Tab strip */}
                    <div className="rounded-3xl border border-slate-800/70 bg-slate-950/95 p-3 sm:p-4 shadow-[0_18px_45px_rgba(0,0,0,0.75)]">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                    Control Surface
                                </div>
                                <div className="text-sm font-semibold text-slate-100">
                                    Settings
                                </div>
                            </div>
                            <Settings className="w-4 h-4 text-slate-500" />
                        </div>

                        <div className="inline-flex rounded-full bg-slate-900/90 border border-slate-800/80 p-1 text-[11px] font-medium">
                            <button
                                type="button"
                                onClick={() => setSettingsTab("ai")}
                                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${settingsTab === "ai"
                                    ? "bg-slate-100 text-slate-900"
                                    : "text-slate-400"
                                    }`}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>AI</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettingsTab("tailnet")}
                                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${settingsTab === "tailnet"
                                    ? "bg-slate-100 text-slate-900"
                                    : "text-slate-400"
                                    }`}
                            >
                                <Wifi className="w-3.5 h-3.5" />
                                <span>Tailnet</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettingsTab("users")}
                                className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${settingsTab === "users"
                                    ? "bg-slate-100 text-slate-900"
                                    : "text-slate-400"
                                    }`}
                            >
                                <Shield className="w-3.5 h-3.5" />
                                <span>Users</span>
                            </button>
                        </div>
                    </div>

                    {/* Settings tab content */}
                    {settingsTab === "ai" && (
                        <div className="space-y-4">
                            {/* AI provider & model */}
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
                                                background: `linear-gradient(to right, rgba(129,140,248,1) 0%, rgba(56,189,248,1) ${temp * 100
                                                    }%, rgba(15,23,42,1) ${temp * 100}%, rgba(15,23,42,1) 100%)`,
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

                            <div className="rounded-3xl border border-slate-800/70 bg-slate-950/95 p-4 text-xs text-slate-400 space-y-2">
                                <div className="font-semibold text-slate-200 flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                                    Next wiring steps
                                </div>
                                <ol className="list-decimal list-inside space-y-1">
                                    <li>Point this console at your FastAPI chat endpoint.</li>
                                    <li>Use the provider/model config to build the request body.</li>
                                    <li>Add streaming later so the messages animate in.</li>
                                </ol>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    For today, this shell is meant to give you the look & feel
                                    and a safe place to test prompts over Tailscale.
                                </p>
                            </div>
                        </div>
                    )}

                    {settingsTab === "tailnet" && (
                        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/95 p-4 sm:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.75)] space-y-3 text-sm">
                            <div className="flex items-center justify-between gap-3 mb-1">
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                        Tailnet
                                    </div>
                                    <div className="text-sm font-semibold">Server Status</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={refreshTailnetStats}
                                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-slate-700/80 text-slate-200 hover:border-sky-400/70 hover:text-sky-200 transition-colors"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Refresh
                                </button>
                            </div>

                            {tailnetLoading && (
                                <div className="text-xs text-slate-400">Loading tailnet…</div>
                            )}

                            {tailnetError && (
                                <div className="text-xs text-red-400">
                                    Failed to load tailnet summary: {tailnetError}
                                </div>
                            )}

                            {tailnetStats && !tailnetLoading && !tailnetError && (
                                <div className="space-y-1.5 text-xs text-slate-300">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Devices online</span>
                                        <span className="font-semibold">
                                            {tailnetStats.devices_online ?? "?"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Total devices</span>
                                        <span className="font-semibold">
                                            {tailnetStats.devices_total ?? "?"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Exit node</span>
                                        <span className="font-semibold">
                                            {tailnetStats.exit_node ?? "none"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Last check</span>
                                        <span className="font-semibold">
                                            {tailnetStats.last_check ?? "unknown"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {!tailnetStats && !tailnetLoading && !tailnetError && (
                                <div className="text-xs text-slate-500">
                                    No tailnet summary loaded yet. Click Refresh to query
                                    {` ${API_BASE}/api/system/tailscale/summary`}.
                                </div>
                            )}
                        </div>
                    )}

                    {settingsTab === "users" && (
                        <div className="rounded-3xl border border-slate-800/70 bg-slate-950/95 p-4 sm:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.75)] space-y-3 text-sm">
                            <div className="flex items-center justify-between gap-3 mb-1">
                                <div>
                                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                        Users
                                    </div>
                                    <div className="text-sm font-semibold">Tailnet Members</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={refreshUserSummary}
                                    className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-slate-700/80 text-slate-200 hover:border-emerald-400/70 hover:text-emerald-200 transition-colors"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Refresh
                                </button>
                            </div>

                            {userLoading && (
                                <div className="text-xs text-slate-400">Loading users…</div>
                            )}

                            {userError && (
                                <div className="text-xs text-red-400">
                                    Failed to load user summary: {userError}
                                </div>
                            )}

                            {userSummary && !userLoading && !userError && (
                                <div className="space-y-3 text-xs text-slate-300">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Total users</span>
                                        <span className="font-semibold">
                                            {userSummary.total ?? "?"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Active</span>
                                        <span className="font-semibold text-emerald-400">
                                            {userSummary.active ?? "?"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Admins</span>
                                        <span className="font-semibold text-violet-300">
                                            {userSummary.admins ?? "?"}
                                        </span>
                                    </div>

                                    {Array.isArray(userSummary.users) && userSummary.users.length > 0 && (
                                        <div className="mt-2 space-y-1.5">
                                            {userSummary.users.slice(0, 4).map((u, idx) => (
                                                <div
                                                    key={u.id ?? idx}
                                                    className="flex items-center justify-between rounded-xl bg-slate-900/80 border border-slate-800/80 px-3 py-1.5"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-slate-100">
                                                            {u.name ?? u.email ?? "Unknown"}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500">
                                                            {u.email ?? "no-email"} • {u.role ?? "user"}
                                                        </span>
                                                    </div>
                                                    {u.active && (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!userSummary && !userLoading && !userError && (
                                <div className="text-xs text-slate-500">
                                    No user data yet. Click Refresh to query
                                    {` ${API_BASE}/api/users/admin/summary`}.
                                </div>
                            )}
                        </div>
                    )}
                </aside>
            </main>
        </div>
    );
};

export default ChatOpsConsole;
