// Hook: useProviderStatus
// Handles provider meta labeling/color and polling health endpoint.
import { useEffect, useMemo } from 'react';

const getApiBase = () => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return `http://${hostname}:8000`;
    return 'http://localhost:8000';
};
const API_BASE = getApiBase();

export function useProviderStatus({ provider, openaiKey, ollamaUrl, lastChatOk, setLastChatOk, ollamaStatus, setOllamaStatus }) {
    // Derive provider meta (label + color) for chip
    const providerMeta = useMemo(() => {
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
    }, [provider, openaiKey, lastChatOk, ollamaStatus]);

    // Poll health endpoint every 20s for lightweight status updates.
    useEffect(() => {
        let cancelled = false;
        const poll = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/chat/health?ollama_url=${encodeURIComponent(ollamaUrl)}`);
                if (!res.ok) return;
                const data = await res.json();
                const openaiStatus = data.providerStatuses?.openai;
                const ollamaStat = data.providerStatuses?.ollama;
                if (cancelled) return;
                if (openaiStatus === 'ok' && lastChatOk == null) setLastChatOk(true);
                if (openaiStatus === 'key-missing') setLastChatOk(false);
                if (ollamaStat === 'ok') setOllamaStatus('online');
                else if (ollamaStat === 'offline') setOllamaStatus('offline');
                else if (ollamaStat === 'error') setOllamaStatus(null);
            } catch (_) {
                // swallow temporary network errors
            }
        };
        poll();
        const id = setInterval(poll, 20000);
        return () => { cancelled = true; clearInterval(id); };
    }, [ollamaUrl, lastChatOk, setLastChatOk, setOllamaStatus]);

    return providerMeta;
}
