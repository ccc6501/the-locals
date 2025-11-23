// Hook: useChatPersistence
// Loads initial messages and persists last 200 to localStorage.
import { useState, useEffect } from 'react';

export function useChatPersistence(storageKey = 'theLocal.chatMessages') {
    const loadInitialMessages = () => {
        try {
            const raw = localStorage.getItem(storageKey);
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
            createdAt: new Date().toISOString()
        }];
    };

    const [messages, setMessages] = useState(loadInitialMessages);

    useEffect(() => {
        try {
            const toStore = messages.slice(-200).map(m => ({
                id: m.id,
                role: m.role,
                authorTag: m.authorTag,
                text: m.text,
                createdAt: m.createdAt
            }));
            localStorage.setItem(storageKey, JSON.stringify(toStore));
        } catch (e) {
            console.warn('Failed to persist chat messages', e);
        }
    }, [messages, storageKey]);

    return { messages, setMessages };
}
