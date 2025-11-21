import React, { useState, useEffect, useRef } from "react";
import { Bug } from "lucide-react";

const INITIAL_MESSAGES = [
  {
    id: "welcome-1",
    role: "assistant",
    mode: "default",
    content:
      "Welcome to ChatOps Neon. This shell mirrors your TailNet brain's routing, AI, and bug surface so every test feels like the real deal.",
    timestamp: new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  },
];

const MESSAGES_KEY = "chatops_neon_messages";
const BUGS_KEY = "chatops_neon_bugs";

const STATUS_INDICATORS = [
  {
    id: "server",
    label: "Server",
    status: "online",
    detail: "last check 12s ago",
    tone: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  {
    id: "api",
    label: "API",
    status: "stable",
    detail: "latency 23ms",
    tone: "text-sky-300",
    dot: "bg-sky-400",
  },
  {
    id: "cloud",
    label: "Cloud",
    status: "syncing",
    detail: "queue 2",
    tone: "text-violet-300",
    dot: "bg-violet-400",
  },
];

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function mockReply(userText, mode) {
  if (mode === "ops") {
    return (
      "Ops mode stub: in the real build this will read TailNet status and " +
      "generate operational notes. For now I'm just echoing you: " +
      `"${userText.slice(0, 140)}".`
    );
  }
  if (mode === "play") {
    return (
      "Lazlo mode stub: imagine a weird-science systems gremlin hiding in " +
      "your walls, narrating TailNet life. For now, normal reply placeholder."
    );
  }
  return (
    "Preview shell only. Once the backend is wired, this is where your " +
    "TailNet AI router will answer for real."
  );
}

const ChatOpsNeonShell = () => {
  const mode = "default";
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [bugs, setBugs] = useState([]);
  const [controlCollapsed, setControlCollapsed] = useState(false);
  const [isBugMode, setIsBugMode] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem(MESSAGES_KEY);
      const savedBugs = localStorage.getItem(BUGS_KEY);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
      if (savedBugs) {
        const parsedBugs = JSON.parse(savedBugs);
        if (Array.isArray(parsedBugs)) {
          setBugs(parsedBugs);
        }
      }
    } catch (e) {
      console.warn("ChatOpsNeon: failed to load persisted state", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn("ChatOpsNeon: failed to persist messages", e);
    }

    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(BUGS_KEY, JSON.stringify(bugs));
    } catch (e) {
      console.warn("ChatOpsNeon: failed to persist bugs", e);
    }
  }, [bugs]);

  const handleLogBug = () => {
    const text = input.trim();
    if (!text) return;

    const bug = {
      id: `bug-${Date.now()}`,
      text,
      mode,
      timestamp: formatTime(),
    };

    setBugs((prev) => [bug, ...prev]);
    setInput("");
  };

  const handleSend = () => {
    if (isBugMode) {
      handleLogBug();
      return;
    }

    const text = input.trim();
    if (!text) return;

    const now = formatTime();

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      mode,
      content: text,
      timestamp: now,
    };

    const assistantMsg = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      mode,
      content: mockReply(text, mode),
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const inputSectionClasses = [
    "border-t border-slate-800/80 px-4 pt-3 pb-2",
    controlCollapsed ? "sticky bottom-0 z-10 bg-slate-950/95" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="w-full max-w-md mx-auto rounded-[32px] bg-slate-950/90 border border-slate-800/80 shadow-[0_0_40px_rgba(56,189,248,0.35)] overflow-hidden flex flex-col h-full">
      <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={
                msg.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-r from-purple-500 to-sky-500 px-3 py-2 text-[13px] text-white shadow-lg"
                  : "max-w-[80%] rounded-2xl rounded-tl-sm bg-slate-900/90 border border-slate-700 px-3 py-2 text-[13px] text-slate-100"
              }
            >
              <div className="whitespace-pre-wrap leading-snug">{msg.content}</div>
              <div
                className={
                  msg.role === "user"
                    ? "text-[10px] mt-1 text-white/70 text-right"
                    : "text-[10px] mt-1 text-slate-500"
                }
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={inputSectionClasses}>
        <div className="flex items-end gap-3">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask something about the hub, secrets, TailNet, or Lazlo..."
            className="flex-1 resize-none rounded-2xl bg-slate-900/80 border border-slate-700 px-3 py-3 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/60 focus:border-purple-400 min-h-[56px] max-h-[120px]"
          />
          <button
            type="button"
            onClick={handleSend}
            className="h-full px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 transition-all"
          >
            Send
          </button>
        </div>
        <div className="text-[11px] text-slate-500">
          {isBugMode
            ? "Bug log mode active — Send will capture a note." 
            : "Press Enter to send • Shift+Enter adds a newline."}
        </div>
      </div>

      <div className="border-t border-slate-800/80 bg-slate-950/95 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-100">Control Surface</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBugMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                isBugMode
                  ? "border-amber-400 bg-amber-500/20 text-amber-100"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              Bug log
            </button>
            <button
              type="button"
              onClick={() => setControlCollapsed((prev) => !prev)}
              className="px-3 py-1 rounded-full text-[11px] border border-slate-700 text-slate-300 hover:border-slate-500"
            >
              {controlCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        </div>
        <div
          className={`space-y-3 transition-all duration-200 ${
            controlCollapsed ? "max-h-0 opacity-0 overflow-hidden" : ""
          }`}
        >
          <div className="flex flex-wrap gap-2">
            {STATUS_INDICATORS.map((status) => (
              <div
                key={status.id}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-slate-800/70 bg-slate-900/70 text-[11px]"
              >
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                <span className="text-slate-400">{status.label}:</span>
                <span className={status.tone}>{status.status}</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-500">
            System status table, updated in the shell preview.
          </div>
        </div>
      </div>

      <section className="border-t border-slate-800/80 bg-slate-950/95 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-50">Bug &amp; Idea Log</div>
          <div className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-[10px] text-slate-300">
            {bugs.length} saved
          </div>
        </div>
        {bugs.length === 0 ? (
          <div className="text-[11px] text-slate-500">
            No bugs yet. Type in the chat and hit Send while the bug chip is active, and they’ll collect here while you test.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-28 overflow-y-auto">
            {bugs.map((bug) => (
              <div
                key={bug.id}
                className="rounded-xl bg-slate-900/90 border border-slate-800 px-3 py-1.5"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>{bug.timestamp}</span>
                  <span className="capitalize text-slate-400">{bug.mode}</span>
                </div>
                <div className="text-[11px] text-slate-200 whitespace-pre-wrap">
                  {bug.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ChatOpsNeonShell;
