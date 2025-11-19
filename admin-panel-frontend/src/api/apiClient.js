/**
 * API Client Configuration for Admin Panel
 * Connects React frontend to FastAPI backend
 */

// Auto-detect API URL based on hostname
// Behavior:
// - If REACT_APP_API_URL is set, use it (explicit override)
// - If running in the browser on the same host as the frontend, construct a URL
//   pointing to that host on port 8000 (e.g. http://<hostname>:8000/api).
//   This avoids using 'localhost' which would refer to the remote device.
const getAPIBaseURL = () => {
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }

    const hostname = window.location.hostname;

    // If we're on localhost during development, call the local backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8000/api';
    }

    // For remote access (Tailscale IPs, MagicDNS names, etc.), build the backend URL
    // by using the same hostname but port 8000 where the FastAPI backend runs.
    // Example: accessing http://home-hub:3001 from a phone -> API -> http://home-hub:8000/api
    return `http://${hostname}:8000/api`;
};

const getWSURL = () => {
    if (process.env.REACT_APP_WS_URL) {
        return process.env.REACT_APP_WS_URL;
    }

    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'ws://localhost:8000/ws';
    }

    // Use same hostname and port 8000 for WebSocket endpoint when remote
    return `ws://${hostname}:8000/ws`;
};

const API_BASE_URL = getAPIBaseURL();
const WS_URL = getWSURL();

// Token management
const TOKEN_KEY = 'admin_panel_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Make authenticated API request
 */
export const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
            ...options.headers,
        },
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        // Handle 401 - only redirect to login if not on Tailscale
        if (response.status === 401) {
            const hostname = window.location.hostname;
            const isTailscale = hostname === 'home-hub' ||
                hostname.includes('taimen-godzilla.ts.net') ||
                hostname.startsWith('100.');

            removeToken();

            // Don't redirect on Tailscale - auto-login will handle it
            if (!isTailscale) {
                window.location.href = '/login';
            }
            throw new Error('Session expired. Please login again.');
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};

/**
 * API Methods
 */
export const api = {
    // Generic HTTP methods for custom endpoints
    get: async (endpoint) => {
        return await apiRequest(endpoint, { method: 'GET' });
    },

    post: async (endpoint, data) => {
        return await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    patch: async (endpoint, data) => {
        return await apiRequest(endpoint, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined,
        });
    },

    delete: async (endpoint) => {
        return await apiRequest(endpoint, { method: 'DELETE' });
    },

    // Authentication
    auth: {
        login: async (email, password) => {
            const response = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            if (response.access_token) {
                setToken(response.access_token);
            }
            return response;
        },

        logout: async () => {
            await apiRequest('/auth/logout', { method: 'POST' });
            removeToken();
        },

        getProfile: async () => {
            return await apiRequest('/auth/profile');
        },
    },

    // Users
    users: {
        getAll: async () => {
            return await apiRequest('/users');
        },

        getById: async (id) => {
            return await apiRequest(`/users/${id}`);
        },

        create: async (userData) => {
            return await apiRequest('/users', {
                method: 'POST',
                body: JSON.stringify(userData),
            });
        },

        update: async (id, userData) => {
            return await apiRequest(`/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify(userData),
            });
        },

        delete: async (id) => {
            return await apiRequest(`/users/${id}`, {
                method: 'DELETE',
            });
        },

        suspend: async (id) => {
            return await apiRequest(`/users/${id}/suspend`, {
                method: 'PATCH',
            });
        },

        activate: async (id) => {
            return await apiRequest(`/users/${id}/activate`, {
                method: 'PATCH',
            });
        },

        getNotifications: async () => {
            return await apiRequest('/users/notifications/my');
        },

        markNotificationRead: async (id) => {
            return await apiRequest(`/users/notifications/${id}/read`, {
                method: 'PATCH',
            });
        },
    },

    // Chat
    chat: {
        getThreads: async () => {
            return await apiRequest('/chat/threads');
        },

        createThread: async (threadData) => {
            return await apiRequest('/chat/threads', {
                method: 'POST',
                body: JSON.stringify(threadData),
            });
        },

        getMessages: async (threadId) => {
            return await apiRequest(`/chat/threads/${threadId}/messages`);
        },

        sendMessage: async (threadId, text) => {
            return await apiRequest(`/chat/threads/${threadId}/messages`, {
                method: 'POST',
                body: JSON.stringify({ text, threadId }),
            });
        },

        deleteThread: async (threadId) => {
            return await apiRequest(`/chat/threads/${threadId}`, {
                method: 'DELETE',
            });
        },
    },

    // Invites
    invites: {
        getAll: async () => {
            return await apiRequest('/invites');
        },

        create: async (maxUses = 5) => {
            return await apiRequest('/invites', {
                method: 'POST',
                body: JSON.stringify({ max_uses: maxUses }),
            });
        },

        revoke: async (id) => {
            return await apiRequest(`/invites/${id}/revoke`, {
                method: 'PATCH',
            });
        },

        delete: async (id) => {
            return await apiRequest(`/invites/${id}`, {
                method: 'DELETE',
            });
        },
    },

    // Connections
    connections: {
        getAll: async () => {
            return await apiRequest('/connections');
        },

        updateTailscale: async (config) => {
            return await apiRequest('/connections/tailscale', {
                method: 'PUT',
                body: JSON.stringify(config),
            });
        },

        testTailscale: async () => {
            return await apiRequest('/connections/tailscale/test', {
                method: 'POST',
            });
        },

        updateOpenAI: async (config) => {
            return await apiRequest('/connections/openai', {
                method: 'PUT',
                body: JSON.stringify(config),
            });
        },

        testOpenAI: async () => {
            return await apiRequest('/connections/openai/test', {
                method: 'POST',
            });
        },

        updateOllama: async (config) => {
            return await apiRequest('/connections/ollama', {
                method: 'PUT',
                body: JSON.stringify(config),
            });
        },

        testOllama: async () => {
            return await apiRequest('/connections/ollama/test', {
                method: 'POST',
            });
        },
    },

    // Cloud Storage
    storage: {
        getConfig: async () => {
            return await apiRequest('/storage/config');
        },

        updateConfig: async (config) => {
            return await apiRequest('/storage/config', {
                method: 'PUT',
                body: JSON.stringify(config),
            });
        },

        listFiles: async (path = '/') => {
            return await apiRequest(`/storage/files?path=${encodeURIComponent(path)}`);
        },

        uploadFile: async (file, path = '/') => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', path);

            const token = getToken();
            const response = await fetch(`${API_BASE_URL}/storage/upload`, {
                method: 'POST',
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                },
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');
            return await response.json();
        },

        deleteFile: async (fileId) => {
            return await apiRequest(`/storage/files/${fileId}`, {
                method: 'DELETE',
            });
        },
    },

    // Settings
    settings: {
        get: async () => {
            return await apiRequest('/settings');
        },

        update: async (settings) => {
            return await apiRequest('/settings', {
                method: 'PUT',
                body: JSON.stringify(settings),
            });
        },

        sendNotification: async (message, target = 'all') => {
            return await apiRequest('/settings/notifications/send', {
                method: 'POST',
                body: JSON.stringify({ message, target }),
            });
        },
    },

    // System
    system: {
        getHealth: async () => {
            return await apiRequest('/system/health');
        },

        getLogs: async (limit = 100) => {
            return await apiRequest(`/system/logs?limit=${limit}`);
        },

        restart: async () => {
            return await apiRequest('/system/restart', {
                method: 'POST',
            });
        },

        backup: async () => {
            return await apiRequest('/system/backup', {
                method: 'POST',
            });
        },

        getMetrics: async () => {
            return await apiRequest('/system/metrics');
        },
    },
};

/**
 * WebSocket Connection Manager
 */
export class WebSocketManager {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    connect(onMessage) {
        const token = getToken();
        if (!token) {
            console.warn('No token available for WebSocket connection');
            return;
        }

        this.socket = new WebSocket(`${WS_URL}?token=${token}`);

        this.socket.onopen = () => {
            console.log('✅ WebSocket connected');
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (onMessage) onMessage(data);

                // Notify listeners
                this.listeners.forEach((callback) => callback(data));
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.socket.onclose = () => {
            console.log('❌ WebSocket disconnected');
            // Attempt reconnect after 3 seconds
            setTimeout(() => this.connect(onMessage), 3000);
        };
    }

    send(type, data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type, data }));
        } else {
            console.warn('WebSocket not connected');
        }
    }

    addListener(id, callback) {
        this.listeners.set(id, callback);
    }

    removeListener(id) {
        this.listeners.delete(id);
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export default api;
