import React, { useState, useEffect } from 'react';
import { api, WebSocketManager, getToken } from './api/apiClient';
import {
    Shield, Loader2, Menu, Bell, MessageSquare, Users, QrCode, Zap, Cloud, Settings, Activity,
    UserPlus, Search, Filter, Edit, Ban, CheckCircle, Trash2, PlusCircle, Wifi, Bot,
    CheckCircle2, XCircle, Server, Save, Upload, RefreshCw, Download, Sparkles, Megaphone,
    Send, Plus, ChevronLeft, Phone, VideoIcon, MoreVertical, Paperclip, X, Database,
    TrendingUp, Terminal, HardDrive, MessageCircle, File
} from 'lucide-react';

const AdminPanelConnected = () => {
    // ===========================================
    // STATE MANAGEMENT
    // ===========================================

    // Authentication
    const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [loginError, setLoginError] = useState('');
    const [loading, setLoading] = useState(true);
    const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    // Core data
    const [data, setData] = useState({
        profile: null,
        users: [],
        invites: [],
        settings: null
    });

    // Chat threads
    const [chatThreads, setChatThreads] = useState([]);

    // UI State (same as before)
    const [activeTab, setActiveTab] = useState('chat');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showPingModal, setShowPingModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [pingTarget, setPingTarget] = useState(null);
    const [pingMessage, setPingMessage] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    // Provide safe defaults to prevent crashes when tabs render before data loads
    const [settings, setSettings] = useState({
        allowRegistration: true,
        requireEmailVerification: false,
        aiRateLimit: 100,
        storagePerUser: 10,
        maxDevicesPerUser: 3,
        aiProvider: 'ollama'
    });
    const [editForm, setEditForm] = useState({ name: '', email: '', role: 'user' });

    // Mobile & Sidebar
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [showChatThreads, setShowChatThreads] = useState(true);
    const [activeThread, setActiveThread] = useState(1);
    const [showNewThreadModal, setShowNewThreadModal] = useState(false);
    const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

    // Notifications
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

    // Chat
    const [inputMessage, setInputMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Connections (safe defaults)
    const [connections, setConnections] = useState({
        tailscale: { enabled: true, authKey: '', hostname: 'home-hub-1', status: 'disconnected' },
        openai: { enabled: false, apiKey: '', model: 'gpt-4o-mini', status: 'disconnected' },
        ollama: { enabled: false, endpoint: 'http://localhost:11434', model: 'gemma:2b', status: 'disconnected' }
    });
    const [testingOpenAI, setTestingOpenAI] = useState(false);
    const [testingOllama, setTestingOllama] = useState(false);
    const [testingTailscale, setTestingTailscale] = useState(false);

    // Cloud Storage (safe defaults)
    const [cloudStorage, setCloudStorage] = useState({
        provider: 's3',
        bucket: '',
        region: 'us-east-1',
        accessKey: ''
    });
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState([]);

    // Settings
    const [systemInstructions, setSystemInstructions] = useState('');
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [debugMode, setDebugMode] = useState(false);
    const [autoBackup, setAutoBackup] = useState(true);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [notificationTarget, setNotificationTarget] = useState('all');

    // System Health (safe defaults)
    const [systemHealth, setSystemHealth] = useState({
        uptime: '—',
        cpu: 0,
        memory: 0,
        dbSize: '—',
        lastBackup: '—',
        networkStatus: 'Online',
        latency: '—'
    });

    // WebSocket
    const [wsManager] = useState(() => new WebSocketManager());

    // ===========================================
    // COMPUTED VALUES & HELPERS
    // ===========================================

    const profile = data.profile || { name: 'Admin User', role: 'admin', email: 'admin@example.com' };
    const unreadNotifications = notifications.filter(n => !n.read).length;
    const stats = {
        activeUsers: data.users.filter(u => u.status === 'online').length,
        totalUsers: data.users.length,
        totalAIUsage: data.users.reduce((sum, u) => sum + (u.aiUsage || 0), 0),
        totalStorage: data.users.reduce((sum, u) => sum + (u.storageUsed || 0), 0)
    };
    const filteredUsers = data.users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'all' || user.status === filterStatus;
        return matchesSearch && matchesFilter;
    });
    const invites = data.invites || [];
    const currentThread = chatThreads.find(t => t.id === activeThread) || {
        id: 1, name: 'AI Assistant', type: 'ai', messages: [], avatar: 'bot'
    };
    const currentMessages = currentThread.messages || [];
    const aiStatus = { service: 'OpenAI', status: 'connected' };

    const getPageTitle = () => {
        const titles = {
            chat: 'Chat',
            users: 'User Management',
            invites: 'Invite Codes',
            connections: 'API Connections',
            cloud: 'Cloud Storage',
            settings: 'Settings',
            system: 'System Health'
        };
        return titles[activeTab] || 'Admin Panel';
    };

    const getStatusColor = (status) => {
        const colors = {
            online: 'bg-green-500',
            offline: 'bg-gray-500',
            suspended: 'bg-red-500'
        };
        return colors[status] || 'bg-gray-500';
    };

    const getRoleColor = (role) => {
        const colors = {
            admin: 'bg-red-500/20 text-red-400 border-red-500/30',
            moderator: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            user: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
        };
        return colors[role] || colors.user;
    };

    const handleNavigateFolder = (file) => {
        if (file.type === 'folder') {
            setCurrentPath(file.path);
        }
    };

    const getFileIcon = (file) => {
        if (file.type === 'folder') {
            return <HardDrive size={20} className="text-blue-400" />;
        }
        return <File size={20} className="text-gray-400" />;
    };

    // Fetch all data on mount
    useEffect(() => {
        if (isAuthenticated) {
            fetchAllData();
            connectWebSocket();
        }

        return () => {
            wsManager.disconnect();
        };
    }, [isAuthenticated]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [
                profile,
                users,
                invites,
                threads,
                settingsData,
                connectionsData,
                health,
                storageConfig
            ] = await Promise.all([
                api.auth.getProfile(),
                api.users.getAll(),
                api.invites.getAll(),
                api.chat.getThreads(),
                api.settings.get(),
                api.connections.getAll(),
                api.system.getHealth(),
                api.storage.getConfig()
            ]);

            setData({
                profile,
                users,
                invites,
                // merge settings with safe defaults
                settings: {
                    allowRegistration: true,
                    requireEmailVerification: false,
                    aiRateLimit: 100,
                    storagePerUser: 10,
                    maxDevicesPerUser: 3,
                    ...(settingsData || {})
                }
            });

            setChatThreads(threads);
            // merge each section with safe defaults to avoid nulls
            setSettings(prev => ({
                ...prev,
                ...(settingsData || {})
            }));
            setConnections(prev => ({
                tailscale: { enabled: true, authKey: '', hostname: 'home-hub-1', status: 'disconnected' },
                openai: { enabled: false, apiKey: '', model: 'gpt-4o-mini', status: 'disconnected' },
                ollama: { enabled: false, endpoint: 'http://localhost:11434', model: 'llama3.1:latest', status: 'disconnected' },
                ...(connectionsData || {})
            }));
            setSystemHealth(prev => ({
                uptime: '—', cpu: 0, memory: 0, dbSize: '—', lastBackup: '—', networkStatus: 'Online', latency: '—',
                ...(health || {})
            }));
            setCloudStorage(prev => ({
                provider: 's3', bucket: '', region: 'us-east-1', accessKey: '',
                ...(storageConfig || {})
            }));

        } catch (error) {
            console.error('Error fetching data:', error);
            if (error.message.includes('401')) {
                setIsAuthenticated(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const connectWebSocket = () => {
        wsManager.connect((data) => {
            const { type, data: payload } = data;

            switch (type) {
                case 'new_message':
                    // Refresh chat threads
                    api.chat.getThreads().then(setChatThreads);
                    break;
                case 'user_status_changed':
                    // Refresh users
                    api.users.getAll().then(users => {
                        setData(prev => ({ ...prev, users }));
                    });
                    break;
                case 'notification':
                    // Add notification
                    setNotifications(prev => [
                        { id: Date.now(), message: payload.message, time: 'Just now', read: false },
                        ...prev
                    ]);
                    break;
            }
        });
    };

    // ===========================================
    // AUTHENTICATION HANDLERS
    // ===========================================

    // Auto-login for Tailscale access
    useEffect(() => {
        const isTailscaleAccess = () => {
            const hostname = window.location.hostname;
            console.log('[Auto-Login] Checking hostname:', hostname);
            const isTailscale = hostname === 'home-hub' ||
                hostname.includes('taimen-godzilla.ts.net') ||
                hostname.startsWith('100.');
            console.log('[Auto-Login] Is Tailscale?', isTailscale);
            return isTailscale;
        };

        const attemptAutoLogin = async () => {
            console.log('[Auto-Login] State check:', {
                isAuthenticated,
                autoLoginAttempted,
                isTailscale: isTailscaleAccess()
            });

            if (!isAuthenticated && !autoLoginAttempted && isTailscaleAccess()) {
                setAutoLoginAttempted(true);
                console.log('[Auto-Login] Attempting auto-login for ccc6501@gmail.com');
                try {
                    // Auto-login with admin email and dummy password (backend will ignore password)
                    const result = await api.auth.login('ccc6501@gmail.com', 'auto');
                    console.log('[Auto-Login] Success!', result);
                    setIsAuthenticated(true);
                } catch (error) {
                    console.error('[Auto-Login] Failed:', error);
                    // If auto-login fails, user will see normal login screen
                }
            }
        };

        attemptAutoLogin();
    }, [isAuthenticated, autoLoginAttempted]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');

        try {
            if (isRegistering) {
                // Register new user
                await api.post('/auth/register', {
                    email: loginForm.email,
                    password: loginForm.password
                });
                // Auto-login after registration
                await api.auth.login(loginForm.email, loginForm.password);
                setIsAuthenticated(true);
            } else {
                // Normal login
                await api.auth.login(loginForm.email, loginForm.password);
                setIsAuthenticated(true);
            }
        } catch (error) {
            setLoginError(error.message || (isRegistering ? 'Registration failed' : 'Login failed'));
        }
    };

    const handleLogout = async () => {
        try {
            await api.auth.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setIsAuthenticated(false);
            wsManager.disconnect();
        }
    };

    // ===========================================
    // USER MANAGEMENT HANDLERS
    // ===========================================

    const handleUserAction = async (action, user) => {
        try {
            if (action === 'delete') {
                if (!window.confirm(`Delete ${user.name}?`)) return;
                await api.users.delete(user.id);
            } else if (action === 'suspend') {
                await api.users.suspend(user.id);
            } else if (action === 'activate') {
                await api.users.activate(user.id);
            } else if (action === 'edit') {
                handleOpenUserModal(user);
                return;
            }

            // Refresh users
            const users = await api.users.getAll();
            setData(prev => ({ ...prev, users }));

        } catch (error) {
            alert(`Failed to ${action} user: ${error.message}`);
        }
    };

    const handleOpenUserModal = (user) => {
        setSelectedUser(user);
        if (user) {
            // Edit existing user
            setEditForm({
                name: user.name,
                email: user.email,
                role: user.role
            });
        } else {
            // Create new user
            setEditForm({
                name: '',
                email: '',
                role: 'user'
            });
        }
        setShowUserModal(true);
    };

    const handleSaveUser = async () => {
        try {
            if (selectedUser) {
                await api.users.update(selectedUser.id, editForm);
            } else {
                await api.users.create({ ...editForm, password: 'changeme123' });
            }

            const users = await api.users.getAll();
            setData(prev => ({ ...prev, users }));
            setShowUserModal(false);

        } catch (error) {
            alert(`Failed to save user: ${error.message}`);
        }
    };

    const handlePingUser = (user) => {
        setPingTarget(user);
        setPingMessage('');
        setShowPingModal(true);
    };

    const handleSendPing = async () => {
        if (!pingMessage.trim() || !pingTarget) return;

        try {
            await api.post(`/users/${pingTarget.id}/ping`, { message: pingMessage });
            setShowPingModal(false);
            setPingMessage('');
            setPingTarget(null);
            alert(`Ping sent to ${pingTarget.name}`);
        } catch (error) {
            alert(`Failed to send ping: ${error.message}`);
        }
    };

    // ===========================================
    // SYSTEM ACTIONS
    // ===========================================

    const handleRestartServer = async () => {
        if (!window.confirm('Are you sure you want to restart the backend server? This may cause a brief interruption.')) {
            return;
        }

        try {
            await api.post('/system/restart');
            alert('Server restart initiated. The server will be back online in a few seconds.');
        } catch (error) {
            alert(`Failed to restart server: ${error.message}`);
        }
    };

    const handleBackupDatabase = async () => {
        try {
            const response = await api.post('/system/backup');
            alert(`Database backup created successfully: ${response.filename}`);
        } catch (error) {
            alert(`Failed to create backup: ${error.message}`);
        }
    };

    const handleViewLogs = async () => {
        try {
            const logs = await api.get('/system/logs');
            console.log('System Logs:', logs);
            alert(`Retrieved ${logs.length} log entries. Check browser console for details.`);
        } catch (error) {
            alert(`Failed to retrieve logs: ${error.message}`);
        }
    };

    // ===========================================
    // CHAT HANDLERS
    // ===========================================

    const handleDeleteThread = async () => {
        if (!currentThread || !window.confirm(`Delete conversation with ${currentThread.name}? This action cannot be undone.`)) {
            return;
        }

        try {
            await api.delete(`/chat/threads/${currentThread.id}`);

            // Remove thread from list
            setChatThreads(prev => prev.filter(t => t.id !== currentThread.id));

            // Switch to first remaining thread or create new
            if (chatThreads.length > 1) {
                setActiveThread(chatThreads.find(t => t.id !== currentThread.id)?.id || 1);
            }

            alert('Conversation deleted successfully');
        } catch (error) {
            alert(`Failed to delete conversation: ${error.message}`);
        }
    };

    const handleSendMessage = async () => {
        if (!inputMessage.trim()) return;

        const tempMessage = {
            id: Date.now(),
            sender: 'me',
            text: inputMessage,
            timestamp: new Date()
        };

        // Optimistic update
        setChatThreads(prev => prev.map(thread =>
            thread.id === activeThread
                ? { ...thread, messages: [...(thread.messages || []), tempMessage] }
                : thread
        ));

        setInputMessage('');
        setIsTyping(true);

        try {
            const response = await api.chat.sendMessage(activeThread, inputMessage);

            // Refresh thread to get AI response
            const threads = await api.chat.getThreads();
            setChatThreads(threads);

        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
            // Revert optimistic update
            setChatThreads(prev => prev.map(thread =>
                thread.id === activeThread
                    ? { ...thread, messages: thread.messages.filter(m => m.id !== tempMessage.id) }
                    : thread
            ));
        } finally {
            setIsTyping(false);
        }
    };

    const handleCreateThread = async (type) => {
        try {
            const newThread = await api.chat.createThread({
                type,
                name: type === 'ai' ? 'AI Assistant' : 'New Chat',
                avatar: type === 'ai' ? 'bot' : 'group'
            });

            const threads = await api.chat.getThreads();
            setChatThreads(threads);
            setActiveThread(newThread.id);
            setShowNewThreadModal(false);

        } catch (error) {
            alert(`Failed to create thread: ${error.message}`);
        }
    };

    // ===========================================
    // INVITE HANDLERS
    // ===========================================

    const handleCreateInvite = async () => {
        try {
            await api.invites.create(5);
            const invites = await api.invites.getAll();
            setData(prev => ({ ...prev, invites }));
        } catch (error) {
            alert(`Failed to create invite: ${error.message}`);
        }
    };

    const handleCopyInvite = (code) => {
        navigator.clipboard.writeText(code);
        alert(`Invite code copied: ${code}`);
    };

    const handleRevokeInvite = async (inviteId) => {
        if (!window.confirm('Revoke this invite code? It will no longer be usable.')) {
            return;
        }

        try {
            await api.patch(`/invites/${inviteId}/revoke`);
            const invites = await api.invites.getAll();
            setData(prev => ({ ...prev, invites }));
            alert('Invite code revoked successfully');
        } catch (error) {
            alert(`Failed to revoke invite: ${error.message}`);
        }
    };

    // ===========================================
    // CONNECTION HANDLERS
    // ===========================================

    const handleTestOpenAI = async () => {
        setTestingOpenAI(true);
        try {
            const result = await api.connections.testOpenAI();
            const icon = result.status === 'connected' ? '✅' : result.status === 'unconfigured' ? '⚠️' : '❌';
            const message = result.response
                ? `${icon} ${result.message}\nResponse: ${result.response}`
                : `${icon} ${result.message}`;
            alert(message);

            const connectionsData = await api.connections.getAll();
            setConnections(connectionsData);
        } catch (error) {
            alert(`❌ OpenAI test failed: ${error.message}`);
        } finally {
            setTestingOpenAI(false);
        }
    };

    const handleTestOllama = async () => {
        setTestingOllama(true);
        try {
            const result = await api.connections.testOllama();
            const icon = result.status === 'connected' ? '✅' : result.status === 'unconfigured' ? '⚠️' : '❌';
            const message = result.response
                ? `${icon} ${result.message}\nResponse: ${result.response}`
                : `${icon} ${result.message}`;
            alert(message);

            const connectionsData = await api.connections.getAll();
            setConnections(connectionsData);
        } catch (error) {
            alert(`❌ Ollama test failed: ${error.message}`);
        } finally {
            setTestingOllama(false);
        }
    };

    const handleTestTailscale = async () => {
        setTestingTailscale(true);
        try {
            const result = await api.connections.testTailscale();
            const icon = result.status === 'connected' ? '✅' : result.status === 'unconfigured' ? '⚠️' : '❌';
            const message = `${icon} ${result.message}`;
            alert(message);

            const connectionsData = await api.connections.getAll();
            setConnections(connectionsData);
        } catch (error) {
            alert(`❌ Tailscale test failed: ${error.message}`);
        } finally {
            setTestingTailscale(false);
        }
    };

    const handleSaveConnections = async () => {
        try {
            // Save all connection configurations
            await Promise.all([
                api.connections.updateTailscale({
                    enabled: connections.tailscale.enabled,
                    authKey: connections.tailscale.authKey || '',
                    hostname: connections.tailscale.hostname || ''
                }),
                api.connections.updateOpenAI({
                    enabled: connections.openai.enabled,
                    apiKey: connections.openai.apiKey || '',
                    model: connections.openai.model || 'gpt-4o-mini'
                }),
                api.connections.updateOllama({
                    enabled: connections.ollama.enabled,
                    endpoint: connections.ollama.endpoint || 'http://localhost:11434',
                    model: connections.ollama.model || 'llama3.1:latest'
                })
            ]);

            alert('✅ Connection settings saved successfully!');

            // Reload connections to get updated status
            const connectionsData = await api.connections.getAll();
            setConnections(connectionsData);
        } catch (error) {
            alert(`❌ Failed to save connections: ${error.message}`);
        }
    };

    // ===========================================
    // SETTINGS HANDLERS
    // ===========================================

    const handleSaveSettings = async () => {
        try {
            await api.settings.update(settings);
            alert('Settings saved successfully!');
        } catch (error) {
            alert(`Failed to save settings: ${error.message}`);
        }
    };

    const handleSendNotification = async () => {
        try {
            await api.settings.sendNotification(notificationMessage, notificationTarget);
            alert('Notification sent!');
            setNotificationMessage('');
        } catch (error) {
            alert(`Failed to send notification: ${error.message}`);
        }
    };

    // ===========================================
    // CLOUD STORAGE HANDLERS
    // ===========================================

    const loadFiles = async () => {
        try {
            const filesList = await api.storage.listFiles(currentPath);
            setFiles(filesList);
        } catch (error) {
            console.error('Error loading files:', error);
        }
    };

    useEffect(() => {
        if (activeTab === 'cloud' && isAuthenticated) {
            loadFiles();
        }
    }, [activeTab, currentPath, isAuthenticated]);

    // ===========================================
    // NOTIFICATION HANDLERS
    // ===========================================

    const fetchNotifications = async () => {
        try {
            const notifs = await api.users.getNotifications();
            setNotifications(notifs);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const handleMarkNotificationRead = async (notificationId) => {
        try {
            await api.users.markNotificationRead(notificationId);
            fetchNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Poll for notifications every 10 seconds
    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 10000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    // ===========================================
    // SYSTEM HANDLERS
    // ===========================================

    const refreshSystemHealth = async () => {
        try {
            const health = await api.system.getHealth();
            setSystemHealth(health);
        } catch (error) {
            console.error('Error fetching system health:', error);
        }
    };

    useEffect(() => {
        if (activeTab === 'system' && isAuthenticated) {
            refreshSystemHealth();
            const interval = setInterval(refreshSystemHealth, 5000);
            return () => clearInterval(interval);
        }
    }, [activeTab, isAuthenticated]);

    // ===========================================
    // LOGIN SCREEN
    // ===========================================

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20">
                    <div className="text-center mb-8">
                        <Shield className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                        <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
                        <p className="text-gray-300">{isRegistering ? 'Create new account' : 'Sign in to continue'}</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        {loginError && (
                            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-200">
                                {loginError}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                            <input
                                type="email"
                                value={loginForm.email}
                                onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="admin@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                            <input
                                type="password"
                                value={loginForm.password}
                                onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition"
                        >
                            {isRegistering ? 'Register' : 'Sign In'}
                        </button>

                        <div className="text-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsRegistering(!isRegistering);
                                    setLoginError('');
                                }}
                                className="text-purple-300 hover:text-purple-200 text-sm transition"
                            >
                                {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
                            </button>
                        </div>

                        {!isRegistering && (
                            <div className="text-center text-sm text-gray-400 mt-4">
                                <p>Demo: admin@example.com / auto</p>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        );
    }

    // ===========================================
    // LOADING SCREEN
    // ===========================================

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-16 h-16 text-purple-400 animate-spin mx-auto mb-4" />
                    <p className="text-white text-xl">Loading...</p>
                </div>
            </div>
        );
    }

    // ===========================================
    // MAIN RENDER (Keep the same UI structure as before)
    // ===========================================

    // TODO: Insert the rest of the JSX from the original component here
    // The UI structure remains the same, but now it's connected to the backend

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
            {/* Header */}
            <div className="bg-gray-900/50 backdrop-blur-xl border-b border-gray-800/50 sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <button
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            className="p-2 hover:bg-gray-800/50 rounded-lg transition-all touch-manipulation lg:hidden"
                        >
                            <Menu size={20} className="text-gray-400" />
                        </button>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                <Shield size={18} className="sm:w-5 sm:h-5 text-white" />
                            </div>
                            <div className="hidden sm:block">
                                <h1 className="text-lg sm:text-xl font-bold text-white">{getPageTitle()}</h1>
                                <p className="text-xs text-gray-500">Admin Panel</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 hover:bg-gray-800/50 rounded-lg transition-all relative touch-manipulation"
                            >
                                <Bell size={18} className="sm:w-5 sm:h-5 text-gray-400" />
                                {unreadNotifications > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">
                                        {unreadNotifications}
                                    </span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl z-50">
                                    <div className="p-4 border-b border-gray-800">
                                        <h3 className="font-semibold text-white">Notifications</h3>
                                    </div>
                                    <div className="max-h-96 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500">
                                                <p className="text-sm">No notifications</p>
                                            </div>
                                        ) : (
                                            notifications.map(notif => (
                                                <div
                                                    key={notif.id}
                                                    onClick={() => !notif.read && handleMarkNotificationRead(notif.id)}
                                                    className={`p-4 border-b border-gray-800/50 hover:bg-gray-800/30 transition-all cursor-pointer ${!notif.read ? 'bg-blue-900/10 border-l-2 border-l-blue-500' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            {notif.title && (
                                                                <p className="text-sm font-medium text-white mb-1">{notif.title}</p>
                                                            )}
                                                            <p className="text-sm text-gray-300">{notif.message}</p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {new Date(notif.createdAt).toLocaleString()}
                                                            </p>
                                                        </div>
                                                        {!notif.read && (
                                                            <div className="w-2 h-2 rounded-full bg-blue-500 ml-2 mt-1 flex-shrink-0"></div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Profile */}
                        <button
                            onClick={() => setShowProfileModal(true)}
                            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800/30 hover:bg-gray-800/50 rounded-lg border border-gray-700/30 transition-all w-full"
                        >
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {profile.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-xs sm:text-sm font-medium text-white">{profile.name}</p>
                                <p className="text-xs text-gray-500">{profile.role}</p>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex h-[calc(100vh-70px)]">
                {/* Sidebar */}
                <div className={`${sidebarCollapsed && !isMobileView ? 'w-0' : 'w-64 sm:w-72'
                    } ${isMobileView && sidebarCollapsed ? 'hidden' : 'flex'
                    } flex-col bg-gray-900/30 backdrop-blur-xl border-r border-gray-800/50 transition-all duration-300 absolute lg:relative h-full z-30 lg:z-auto`}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {(() => {
                            const role = profile?.role;
                            if (role === 'admin') {
                                return [
                                    { id: 'chat', icon: MessageSquare, label: 'Chat' },
                                    { id: 'users', icon: Users, label: 'Users' },
                                    { id: 'invites', icon: QrCode, label: 'Invites' },
                                    { id: 'connections', icon: Zap, label: 'Connections' },
                                    { id: 'cloud', icon: Cloud, label: 'Cloud Storage' },
                                    { id: 'settings', icon: Settings, label: 'Settings' },
                                    { id: 'system', icon: Activity, label: 'System Health' }
                                ];
                            } else if (role === 'moderator') {
                                return [
                                    { id: 'chat', icon: MessageSquare, label: 'Chat' },
                                    { id: 'users', icon: Users, label: 'Users' },
                                    { id: 'invites', icon: QrCode, label: 'Invites' },
                                    { id: 'settings', icon: Settings, label: 'Settings' }
                                ];
                            } else {
                                return [
                                    { id: 'chat', icon: MessageSquare, label: 'Chat' },
                                    { id: 'cloud', icon: Cloud, label: 'Cloud Storage' }
                                ];
                            }
                        })().map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id);
                                    if (isMobileView) setSidebarCollapsed(true);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all touch-manipulation ${activeTab === tab.id
                                    ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 text-white shadow-lg shadow-purple-500/10'
                                    : 'hover:bg-gray-800/50 text-gray-400'
                                    }`}
                            >
                                <tab.icon size={20} />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Stats in Sidebar */}
                    <div className="p-4 border-t border-gray-800/50">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Active Users</span>
                                <span className="text-sm font-bold text-green-400">{stats.activeUsers}/{stats.totalUsers}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">AI Usage</span>
                                <span className="text-sm font-bold text-purple-400">{stats.totalAIUsage}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">Storage</span>
                                <span className="text-sm font-bold text-blue-400">{stats.totalStorage.toFixed(1)} GB</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* CHAT TAB */}
                    {activeTab === 'chat' && (
                        <div className="flex-1 flex overflow-hidden">
                            {/* Chat Threads Sidebar */}
                            {(!isMobileView || showChatThreads) && (
                                <div className="w-full sm:w-80 border-r border-gray-800/50 flex flex-col bg-gray-900/20">
                                    <div className="p-4 border-b border-gray-800/50">
                                        <button
                                            onClick={() => setShowNewThreadModal(true)}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all touch-manipulation"
                                        >
                                            <Plus size={20} />
                                            New Conversation
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto">
                                        {chatThreads.map(thread => (
                                            <button
                                                key={thread.id}
                                                onClick={() => {
                                                    setActiveThread(thread.id);
                                                    if (isMobileView) setShowChatThreads(false);
                                                }}
                                                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-800/30 transition-all border-b border-gray-800/30 text-left touch-manipulation ${activeThread === thread.id ? 'bg-gray-800/50' : ''
                                                    }`}
                                            >
                                                <div className="relative flex-shrink-0">
                                                    {thread.type === 'ai' ? (
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                                            <Bot size={24} className="text-white" />
                                                        </div>
                                                    ) : thread.type === 'group' ? (
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                                                            <Users size={24} className="text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold">
                                                            {thread.avatar}
                                                        </div>
                                                    )}
                                                    {thread.status === 'online' && (
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-semibold text-white truncate">{thread.name}</h4>
                                                        {thread.unread > 0 && (
                                                            <span className="ml-2 px-2 py-0.5 bg-purple-600 rounded-full text-xs font-bold flex-shrink-0">
                                                                {thread.unread}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-gray-400 truncate">{thread.lastMessage}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Chat Messages */}
                            {(!isMobileView || !showChatThreads) && (
                                <div className="flex-1 flex flex-col">
                                    {/* Chat Header */}
                                    <div className="p-4 border-b border-gray-800/50 bg-gray-900/30 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {isMobileView && (
                                                <button
                                                    onClick={() => setShowChatThreads(true)}
                                                    className="p-2 hover:bg-gray-800/50 rounded-lg transition-all touch-manipulation"
                                                >
                                                    <ChevronLeft size={20} className="text-gray-400" />
                                                </button>
                                            )}
                                            <div>
                                                <h3 className="font-semibold text-white">{currentThread?.name}</h3>
                                                <p className="text-xs text-gray-500">
                                                    {currentThread?.type === 'ai' ? 'AI Assistant' :
                                                        currentThread?.type === 'group' ? `${data.users.length} members` :
                                                            currentThread?.status || 'Offline'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleDeleteThread}
                                                className="p-2 hover:bg-red-500/20 rounded-lg transition-all touch-manipulation"
                                                title="Delete conversation"
                                            >
                                                <Trash2 size={18} className="text-red-400" />
                                            </button>
                                            <button className="p-2 hover:bg-gray-800/50 rounded-lg transition-all touch-manipulation">
                                                <Phone size={18} className="text-gray-400" />
                                            </button>
                                            <button className="p-2 hover:bg-gray-800/50 rounded-lg transition-all touch-manipulation">
                                                <VideoIcon size={18} className="text-gray-400" />
                                            </button>
                                            <button className="p-2 hover:bg-gray-800/50 rounded-lg transition-all touch-manipulation">
                                                <MoreVertical size={18} className="text-gray-400" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Messages */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {currentMessages.map(msg => (
                                            <div
                                                key={msg.id}
                                                className={`flex gap-3 ${msg.sender === 'me' ? 'flex-row-reverse' : 'flex-row'}`}
                                            >
                                                {msg.sender !== 'me' && (
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                                        {msg.sender === 'bot' ? <Bot size={16} /> : msg.sender[0]}
                                                    </div>
                                                )}
                                                <div
                                                    className={`max-w-md px-4 py-3 rounded-2xl ${msg.sender === 'me'
                                                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                                                        : 'bg-gray-800/50 text-white'
                                                        }`}
                                                >
                                                    {msg.sender !== 'me' && msg.sender !== 'bot' && (
                                                        <p className="text-xs text-gray-400 mb-1">{msg.sender}</p>
                                                    )}
                                                    <p className="text-sm">{msg.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {isTyping && (
                                            <div className="flex gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                                                    <Bot size={16} className="text-white" />
                                                </div>
                                                <div className="px-4 py-3 bg-gray-800/50 rounded-2xl">
                                                    <div className="flex gap-1">
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Input */}
                                    <div className="p-4 border-t border-gray-800/50 bg-gray-900/30">
                                        <div className="flex items-center gap-2">
                                            <button className="p-2 hover:bg-gray-800/50 rounded-lg transition-all touch-manipulation">
                                                <Paperclip size={20} className="text-gray-400" />
                                            </button>
                                            <input
                                                type="text"
                                                value={inputMessage}
                                                onChange={(e) => setInputMessage(e.target.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                                placeholder="Type a message..."
                                                className="flex-1 bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                            />
                                            <button
                                                onClick={handleSendMessage}
                                                className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl transition-all shadow-lg shadow-purple-500/20 touch-manipulation"
                                            >
                                                <Send size={20} className="text-white" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* USERS TAB */}
                    {activeTab === 'users' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            {/* Header Actions */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <div className="relative flex-1 sm:flex-initial">
                                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Search users..."
                                            className="w-full sm:w-64 bg-gray-800/50 border border-gray-700/50 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setShowFilters(!showFilters)}
                                        className="p-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl hover:bg-gray-800 transition-all touch-manipulation"
                                    >
                                        <Filter size={18} className="text-gray-400" />
                                    </button>
                                </div>

                                {(profile?.role === 'admin' || profile?.role === 'moderator') && (
                                    <button
                                        onClick={() => handleOpenUserModal(null)}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all touch-manipulation"
                                    >
                                        <UserPlus size={18} />
                                        Add User
                                    </button>
                                )}
                            </div>

                            {/* Filters */}
                            {showFilters && (
                                <div className="mb-6 p-4 bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl">
                                    <div className="flex flex-wrap gap-2">
                                        {['all', 'online', 'offline', 'suspended'].map(status => (
                                            <button
                                                key={status}
                                                onClick={() => setFilterStatus(status)}
                                                className={`px-4 py-2 rounded-lg font-medium transition-all touch-manipulation ${filterStatus === status
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                                                    }`}
                                            >
                                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Users Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {filteredUsers.map(user => (
                                    <div
                                        key={user.id}
                                        className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:border-gray-600/50 transition-all"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="relative flex-shrink-0">
                                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
                                                    {user.name.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(user.status)} rounded-full border-2 border-gray-900`} />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h3 className="text-base sm:text-lg font-semibold text-white">{user.name}</h3>
                                                        <p className="text-xs sm:text-sm text-gray-400">{user.handle}</p>
                                                    </div>
                                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${getRoleColor(user.role)}`}>
                                                        {user.role}
                                                    </span>
                                                </div>

                                                <p className="text-xs sm:text-sm text-gray-400 truncate mb-2">{user.email}</p>

                                                {user.lastDevice && (
                                                    <div className="text-xs text-gray-500 mb-3 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Server size={12} className="text-blue-400" />
                                                            <span>{user.lastDevice}</span>
                                                        </div>
                                                        {user.lastIp && (
                                                            <div className="flex items-center gap-2">
                                                                <Wifi size={12} className="text-green-400" />
                                                                <span>{user.lastIp}</span>
                                                            </div>
                                                        )}
                                                        {user.lastActive && (
                                                            <div className="flex items-center gap-2">
                                                                <Activity size={12} className="text-purple-400" />
                                                                <span>Active {new Date(user.lastActive).toLocaleString()}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                                                    <span className="flex items-center gap-1">
                                                        <Server size={14} />
                                                        {user.devices} devices
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Bot size={14} />
                                                        {user.aiUsage} AI
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <HardDrive size={14} />
                                                        {user.storageUsed} GB
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenUserModal(user)}
                                                        className="flex-1 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm font-medium text-white transition-all touch-manipulation"
                                                    >
                                                        <Edit size={14} className="inline mr-1" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handlePingUser(user)}
                                                        className="px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg text-sm font-medium text-blue-400 transition-all touch-manipulation"
                                                        title="Send notification to user"
                                                    >
                                                        <Bell size={14} className="inline mr-1" />
                                                        Ping
                                                    </button>
                                                    {(profile?.role === 'admin' || profile?.role === 'moderator') && (
                                                        user.status !== 'suspended' ? (
                                                            <button
                                                                onClick={() => handleUserAction('suspend', user)}
                                                                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-medium text-red-400 transition-all touch-manipulation"
                                                            >
                                                                <Ban size={14} className="inline mr-1" />
                                                                Suspend
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleUserAction('activate', user)}
                                                                className="px-3 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-sm font-medium text-green-400 transition-all touch-manipulation"
                                                            >
                                                                <CheckCircle size={14} className="inline mr-1" />
                                                                Activate
                                                            </button>
                                                        )
                                                    )}
                                                    <button
                                                        onClick={() => handleUserAction('delete', user)}
                                                        className="p-2 hover:bg-red-500/10 rounded-lg transition-all touch-manipulation"
                                                    >
                                                        <Trash2 size={16} className="text-red-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* INVITES TAB */}
                    {activeTab === 'invites' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-bold text-white">Invite Codes</h2>
                                    <p className="text-sm text-gray-400">Manage invitation codes for new users</p>
                                </div>
                                {(profile?.role === 'admin' || profile?.role === 'moderator') && (
                                    <button
                                        onClick={handleCreateInvite}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all touch-manipulation"
                                    >
                                        <PlusCircle size={18} />
                                        Create Invite
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                {invites.map(invite => (
                                    <div
                                        key={invite.id}
                                        className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl p-6 hover:border-gray-600/50 transition-all"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                                                    <QrCode size={24} className="text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-bold text-white font-mono">{invite.code}</p>
                                                    <p className="text-xs text-gray-500">Created {invite.createdAt}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${invite.status === 'active'
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                }`}>
                                                {invite.status}
                                            </span>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-400">Uses</span>
                                                <span className="text-sm font-bold text-white">{invite.uses} / {invite.maxUses}</span>
                                            </div>

                                            <div className="relative h-2 bg-gray-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all"
                                                    style={{ width: `${(invite.uses / invite.maxUses) * 100}%` }}
                                                />
                                            </div>

                                            <div className="flex items-center gap-2 pt-2">
                                                <button
                                                    onClick={() => handleCopyInvite(invite.code)}
                                                    className="flex-1 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg text-sm font-medium text-white transition-all touch-manipulation"
                                                >
                                                    Copy
                                                </button>
                                                {(profile?.role === 'admin' || profile?.role === 'moderator') && (
                                                    <button
                                                        onClick={() => handleRevokeInvite(invite.id)}
                                                        className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm font-medium text-red-400 transition-all touch-manipulation"
                                                    >
                                                        Revoke
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CONNECTIONS TAB */}
                    {activeTab === 'connections' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">API Connections</h2>

                            <div className="space-y-6">
                                {/* Tailscale */}
                                <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                                            <Wifi size={24} className="text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-white">Tailscale VPN</h3>
                                            <p className="text-sm text-gray-400">Secure network connectivity</p>
                                        </div>
                                        <button
                                            onClick={() => setConnections(prev => ({
                                                ...prev,
                                                tailscale: { ...prev.tailscale, enabled: !prev.tailscale.enabled }
                                            }))}
                                            className={`relative w-12 h-6 rounded-full transition-all ${connections.tailscale.enabled ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gray-600'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${connections.tailscale.enabled ? 'left-6' : 'left-0.5'
                                                }`} />
                                        </button>
                                    </div>

                                    {connections.tailscale.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Auth Key</label>
                                                <input
                                                    type="password"
                                                    value={connections.tailscale.authKey}
                                                    onChange={(e) => setConnections(prev => ({
                                                        ...prev,
                                                        tailscale: { ...prev.tailscale, authKey: e.target.value }
                                                    }))}
                                                    placeholder="tskey-auth-xxxxx"
                                                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Hostname</label>
                                                <input
                                                    type="text"
                                                    value={connections.tailscale.hostname}
                                                    onChange={(e) => setConnections(prev => ({
                                                        ...prev,
                                                        tailscale: { ...prev.tailscale, hostname: e.target.value }
                                                    }))}
                                                    placeholder="my-server"
                                                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleTestTailscale}
                                                    disabled={testingTailscale}
                                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                                                >
                                                    {testingTailscale ? (
                                                        <><Loader2 size={18} className="inline animate-spin mr-2" />Testing...</>
                                                    ) : (
                                                        'Test Connection'
                                                    )}
                                                </button>
                                                {connections.tailscale.status === 'connected' && (
                                                    <CheckCircle2 size={24} className="text-green-400" />
                                                )}
                                                {connections.tailscale.status === 'error' && (
                                                    <XCircle size={24} className="text-red-400" />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* OpenAI */}
                                <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                            <Bot size={24} className="text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-white">OpenAI</h3>
                                            <p className="text-sm text-gray-400">GPT-4 & other models</p>
                                        </div>
                                        <button
                                            onClick={() => setConnections(prev => ({
                                                ...prev,
                                                openai: { ...prev.openai, enabled: !prev.openai.enabled }
                                            }))}
                                            className={`relative w-12 h-6 rounded-full transition-all ${connections.openai.enabled ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gray-600'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${connections.openai.enabled ? 'left-6' : 'left-0.5'
                                                }`} />
                                        </button>
                                    </div>

                                    {connections.openai.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
                                                <input
                                                    type="password"
                                                    value={connections.openai.apiKey}
                                                    onChange={(e) => setConnections(prev => ({
                                                        ...prev,
                                                        openai: { ...prev.openai, apiKey: e.target.value }
                                                    }))}
                                                    placeholder="sk-xxxxx"
                                                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                                                <select
                                                    value={connections.openai.model}
                                                    onChange={(e) => setConnections(prev => ({
                                                        ...prev,
                                                        openai: { ...prev.openai, model: e.target.value }
                                                    }))}
                                                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                                                >
                                                    <option value="gpt-4o">GPT-4o</option>
                                                    <option value="gpt-4o-mini">GPT-4o Mini (Recommended)</option>
                                                    <option value="gpt-4o-2024-11-20">GPT-4o (Nov 2024)</option>
                                                    <option value="gpt-4o-2024-08-06">GPT-4o (Aug 2024)</option>
                                                    <option value="gpt-4o-2024-05-13">GPT-4o (May 2024)</option>
                                                    <option value="chatgpt-4o-latest">ChatGPT-4o Latest</option>
                                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                                    <option value="gpt-4-turbo-2024-04-09">GPT-4 Turbo (Apr 2024)</option>
                                                    <option value="gpt-4">GPT-4</option>
                                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                                    <option value="o1-preview">o1 Preview</option>
                                                    <option value="o1-mini">o1 Mini</option>
                                                    <option value="o3-mini">o3 Mini (High)</option>
                                                    <option value="o3-mini:medium">o3 Mini (Medium)</option>
                                                    <option value="o3-mini:low">o3 Mini (Low)</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleTestOpenAI}
                                                    disabled={testingOpenAI}
                                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                                                >
                                                    {testingOpenAI ? (
                                                        <><Loader2 size={18} className="inline animate-spin mr-2" />Testing...</>
                                                    ) : (
                                                        'Test Connection'
                                                    )}
                                                </button>
                                                {connections.openai.status === 'connected' && (
                                                    <CheckCircle2 size={24} className="text-green-400" />
                                                )}
                                                {connections.openai.status === 'error' && (
                                                    <XCircle size={24} className="text-red-400" />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Ollama */}
                                <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                                            <Server size={24} className="text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-white">Ollama</h3>
                                            <p className="text-sm text-gray-400">Local AI models</p>
                                        </div>
                                        <button
                                            onClick={() => setConnections(prev => ({
                                                ...prev,
                                                ollama: { ...prev.ollama, enabled: !prev.ollama.enabled }
                                            }))}
                                            className={`relative w-12 h-6 rounded-full transition-all ${connections.ollama.enabled ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gray-600'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${connections.ollama.enabled ? 'left-6' : 'left-0.5'
                                                }`} />
                                        </button>
                                    </div>

                                    {connections.ollama.enabled && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Endpoint</label>
                                                <input
                                                    type="text"
                                                    value={connections.ollama.endpoint}
                                                    onChange={(e) => setConnections(prev => ({
                                                        ...prev,
                                                        ollama: { ...prev.ollama, endpoint: e.target.value }
                                                    }))}
                                                    placeholder="http://host.docker.internal:11434"
                                                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                                />
                                                <p className="mt-2 text-xs text-gray-400">Tip: When running the backend in Docker on Windows/Mac, use host.docker.internal to reach Ollama running on your host.</p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                                                <select
                                                    value={connections.ollama.model}
                                                    onChange={(e) => setConnections(prev => ({
                                                        ...prev,
                                                        ollama: { ...prev.ollama, model: e.target.value }
                                                    }))}
                                                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                                                >
                                                    <option value="gemma:2b">Gemma 2B (Recommended - Fast)</option>
                                                    <option value="phi3:latest">Phi 3 Latest</option>
                                                    <option value="mistral:latest">Mistral Latest</option>
                                                    <option value="llama3.1:8b">Llama 3.1 8B</option>
                                                    <option value="llama3.1:latest">Llama 3.1 Latest</option>
                                                    <option value="qwen3:14b">Qwen 3 14B (Large)</option>
                                                    <option value="glm-4.6:cloud">GLM 4.6 Cloud</option>
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleTestOllama}
                                                    disabled={testingOllama}
                                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                                                >
                                                    {testingOllama ? (
                                                        <><Loader2 size={18} className="inline animate-spin mr-2" />Testing...</>
                                                    ) : (
                                                        'Test Connection'
                                                    )}
                                                </button>
                                                {connections.ollama.status === 'connected' && (
                                                    <CheckCircle2 size={24} className="text-green-400" />
                                                )}
                                                {connections.ollama.status === 'error' && (
                                                    <XCircle size={24} className="text-red-400" />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Save All Connections Button */}
                            <div className="mt-6">
                                <button
                                    onClick={handleSaveConnections}
                                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-semibold shadow-lg shadow-purple-500/20 transition-all touch-manipulation flex items-center justify-center gap-2"
                                >
                                    <Save size={20} />
                                    Save All Connection Settings
                                </button>
                            </div>
                        </div>
                    )}

                    {/* CLOUD STORAGE TAB */}
                    {activeTab === 'cloud' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            <div className="mb-6">
                                <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Cloud Storage</h2>

                                {/* Storage Provider Config */}
                                <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 mb-6">
                                    <h3 className="text-lg font-semibold text-white mb-4">Configuration</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Provider</label>
                                            <select
                                                value={cloudStorage.provider}
                                                onChange={(e) => setCloudStorage(prev => ({ ...prev, provider: e.target.value }))}
                                                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                                            >
                                                <option value="s3">Amazon S3</option>
                                                <option value="gcs">Google Cloud Storage</option>
                                                <option value="azure">Azure Blob Storage</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Bucket</label>
                                            <input
                                                type="text"
                                                value={cloudStorage.bucket}
                                                onChange={(e) => setCloudStorage(prev => ({ ...prev, bucket: e.target.value }))}
                                                placeholder="my-bucket"
                                                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Region</label>
                                            <input
                                                type="text"
                                                value={cloudStorage.region}
                                                onChange={(e) => setCloudStorage(prev => ({ ...prev, region: e.target.value }))}
                                                placeholder="us-east-1"
                                                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">Access Key</label>
                                            <input
                                                type="password"
                                                value={cloudStorage.accessKey}
                                                onChange={(e) => setCloudStorage(prev => ({ ...prev, accessKey: e.target.value }))}
                                                placeholder="AKIAXXXXX"
                                                className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                            />
                                        </div>
                                    </div>
                                    <button className="mt-4 w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all touch-manipulation">
                                        <Save size={18} className="inline mr-2" />
                                        Save Configuration
                                    </button>
                                </div>

                                {/* File Browser */}
                                <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">Files</h3>
                                            <p className="text-sm text-gray-400">{currentPath}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all touch-manipulation">
                                                <Upload size={18} className="text-gray-400" />
                                            </button>
                                            <button className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all touch-manipulation">
                                                <RefreshCw size={18} className="text-gray-400" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {files.map((file, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleNavigateFolder(file)}
                                                className="w-full flex items-center gap-3 p-3 hover:bg-gray-700/30 rounded-lg transition-all text-left touch-manipulation"
                                            >
                                                {getFileIcon(file)}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                                                    <p className="text-xs text-gray-500">{file.size}</p>
                                                </div>
                                                <div className="text-xs text-gray-500">{file.modified}</div>
                                                {file.type === 'file' && (
                                                    <button className="p-1 hover:bg-gray-600/50 rounded transition-all">
                                                        <Download size={16} className="text-gray-400" />
                                                    </button>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SETTINGS TAB */}
                    {activeTab === 'settings' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Settings</h2>
                            <div className="space-y-6">
                                {/* Access Control - Admin Only */}
                                {profile?.role === 'admin' && (
                                    <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4">Access Control</h3>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Allow New Registrations', key: 'allowRegistration' },
                                                { label: 'Require Email Verification', key: 'requireEmailVerification' }
                                            ].map(setting => (
                                                <div key={setting.key} className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                                                    <span className="text-sm font-medium text-gray-200">{setting.label}</span>
                                                    <button
                                                        onClick={() => setSettings({ ...settings, [setting.key]: !settings[setting.key] })}
                                                        className={`relative w-12 h-6 rounded-full transition-all ${settings[setting.key] ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gray-600'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${settings[setting.key] ? 'left-6' : 'left-0.5'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* AI Service Provider - Admin Only */}
                                {profile?.role === 'admin' && (
                                    <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4">AI Service Provider</h3>
                                        <div className="space-y-4">
                                            <div className="p-4 bg-gray-700/30 rounded-xl">
                                                <p className="text-sm text-gray-400 mb-3">Choose which AI service to use for chat responses</p>
                                                <div className="flex items-center gap-4">
                                                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="aiProvider"
                                                            value="ollama"
                                                            checked={settings.aiProvider === 'ollama'}
                                                            onChange={() => setSettings({ ...settings, aiProvider: 'ollama' })}
                                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <Bot size={18} className="text-green-400" />
                                                            <span className="text-sm font-medium text-white">Ollama (Local)</span>
                                                        </div>
                                                    </label>
                                                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="aiProvider"
                                                            value="openai"
                                                            checked={settings.aiProvider === 'openai'}
                                                            onChange={() => setSettings({ ...settings, aiProvider: 'openai' })}
                                                            className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles size={18} className="text-blue-400" />
                                                            <span className="text-sm font-medium text-white">OpenAI</span>
                                                        </div>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Resource Limits - Admin Only */}
                                {profile?.role === 'admin' && (
                                    <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4">Resource Limits</h3>
                                        <div className="space-y-6">
                                            {[
                                                { label: 'AI Rate Limit (per day)', key: 'aiRateLimit', min: 10, max: 500, step: 10 },
                                                { label: 'Storage Per User (GB)', key: 'storagePerUser', min: 1, max: 100, step: 1 },
                                                { label: 'Max Devices Per User', key: 'maxDevicesPerUser', min: 1, max: 10, step: 1 }
                                            ].map(slider => (
                                                <div key={slider.key}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium text-gray-200">{slider.label}</span>
                                                        <span className="text-lg font-bold text-purple-400">{settings[slider.key]}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min={slider.min}
                                                        max={slider.max}
                                                        step={slider.step}
                                                        value={settings[slider.key]}
                                                        onChange={(e) => setSettings({ ...settings, [slider.key]: parseInt(e.target.value) })}
                                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* System-wide AI Instructions - Admin Only */}
                                {profile?.role === 'admin' && (
                                    <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                                <Sparkles size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-white">System-wide AI Instructions</h3>
                                                <p className="text-sm text-gray-400">Global instructions applied to all AI interactions</p>
                                            </div>
                                        </div>
                                        <textarea
                                            value={systemInstructions}
                                            onChange={(e) => setSystemInstructions(e.target.value)}
                                            placeholder="Enter system-wide AI instructions..."
                                            rows={6}
                                            className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
                                        />
                                    </div>
                                )}
                                {/* Network Notifications - Admin and Mod */}
                                {(profile?.role === 'admin' || profile?.role === 'moderator') && (
                                    <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                                <Megaphone size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-white">Network Notifications</h3>
                                                <p className="text-sm text-gray-400">Send announcements to users</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Target Audience</label>
                                                <select
                                                    value={notificationTarget}
                                                    onChange={(e) => setNotificationTarget(e.target.value)}
                                                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                >
                                                    <option value="all">All Users</option>
                                                    <option value="admins">Admins Only</option>
                                                    <option value="moderators">Moderators Only</option>
                                                    <option value="users">Regular Users</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                                                <textarea
                                                    value={notificationMessage}
                                                    onChange={(e) => setNotificationMessage(e.target.value)}
                                                    placeholder="Enter your announcement..."
                                                    rows={4}
                                                    className="w-full bg-gray-700/50 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all resize-none"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSendNotification}
                                                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all touch-manipulation"
                                            >
                                                <Send size={18} className="inline mr-2" />
                                                Send Notification
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {/* Advanced Options - Admin Only */}
                                {profile?.role === 'admin' && (
                                    <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4">Advanced Options</h3>
                                        <div className="space-y-4">
                                            {[
                                                { label: 'Maintenance Mode', state: maintenanceMode, setState: setMaintenanceMode },
                                                { label: 'Debug Mode', state: debugMode, setState: setDebugMode },
                                                { label: 'Auto Backup', state: autoBackup, setState: setAutoBackup }
                                            ].map((option, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                                                    <span className="text-sm font-medium text-gray-200">{option.label}</span>
                                                    <button
                                                        onClick={() => option.setState(!option.state)}
                                                        className={`relative w-12 h-6 rounded-full transition-all ${option.state ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gray-600'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${option.state ? 'left-6' : 'left-0.5'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Save Button - Admin Only */}
                                {profile?.role === 'admin' && (
                                    <button
                                        onClick={handleSaveSettings}
                                        className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-semibold text-lg shadow-lg shadow-purple-500/20 transition-all touch-manipulation"
                                    >
                                        <Save size={20} className="inline mr-2" />
                                        Save All Settings
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SYSTEM HEALTH TAB */}
                    {activeTab === 'system' && (
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">System Health</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                {[
                                    {
                                        title: 'Server',
                                        icon: Server,
                                        items: [
                                            { label: 'Uptime', value: systemHealth.uptime, status: 'good' },
                                            { label: 'CPU Usage', value: `${systemHealth.cpu}%`, status: systemHealth.cpu < 70 ? 'good' : 'warning' },
                                            { label: 'Memory', value: `${systemHealth.memory}%`, status: systemHealth.memory < 80 ? 'good' : 'warning' }
                                        ]
                                    },
                                    {
                                        title: 'Database',
                                        icon: Database,
                                        items: [
                                            { label: 'Connection', value: 'Active', status: 'good' },
                                            { label: 'Size', value: systemHealth.dbSize, status: 'good' },
                                            { label: 'Last Backup', value: systemHealth.lastBackup, status: 'good' }
                                        ]
                                    },
                                    {
                                        title: 'Network',
                                        icon: Wifi,
                                        items: [
                                            { label: 'Status', value: systemHealth.networkStatus, status: 'good' },
                                            { label: 'Latency', value: systemHealth.latency, status: 'good' },
                                            { label: 'Bandwidth', value: 'Normal', status: 'good' }
                                        ]
                                    },
                                    {
                                        title: 'AI Service',
                                        icon: Bot,
                                        items: [
                                            { label: 'Provider', value: aiStatus.service, status: aiStatus.status === 'connected' ? 'good' : 'bad' },
                                            { label: 'Status', value: aiStatus.status === 'connected' ? 'Active' : 'Inactive', status: aiStatus.status === 'connected' ? 'good' : 'bad' },
                                            { label: 'Requests', value: '1,234', status: 'good' }
                                        ]
                                    }
                                ].map((section, i) => (
                                    <div key={i} className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                                <section.icon size={20} className="text-white" />
                                            </div>
                                            <h3 className="text-lg font-semibold text-white">{section.title}</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {section.items.map((item, j) => (
                                                <div key={j} className="flex items-center justify-between">
                                                    <span className="text-sm text-gray-400">{item.label}</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${item.status === 'good' ? 'bg-green-500' :
                                                            item.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                                            }`} />
                                                        <span className="text-sm font-medium text-white">{item.value}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Performance Chart */}
                            <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Performance Overview</h3>
                                <div className="h-64 flex items-center justify-center text-gray-500">
                                    <div className="text-center">
                                        <TrendingUp size={48} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">Performance metrics visualization</p>
                                        <p className="text-xs text-gray-600 mt-2">Connect to monitoring service for real-time data</p>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <button
                                    onClick={handleRestartServer}
                                    className="p-4 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/50 rounded-xl transition-all flex items-center gap-3 touch-manipulation"
                                >
                                    <RefreshCw size={20} className="text-blue-400" />
                                    <div className="text-left">
                                        <p className="font-medium text-white">Restart Services</p>
                                        <p className="text-xs text-gray-500">Restart all backend services</p>
                                    </div>
                                </button>
                                <button
                                    onClick={handleBackupDatabase}
                                    className="p-4 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/50 rounded-xl transition-all flex items-center gap-3 touch-manipulation"
                                >
                                    <Database size={20} className="text-green-400" />
                                    <div className="text-left">
                                        <p className="font-medium text-white">Backup Now</p>
                                        <p className="text-xs text-gray-500">Create database backup</p>
                                    </div>
                                </button>
                                <button
                                    onClick={handleViewLogs}
                                    className="p-4 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/50 rounded-xl transition-all flex items-center gap-3 touch-manipulation"
                                >
                                    <Terminal size={20} className="text-purple-400" />
                                    <div className="text-left">
                                        <p className="font-medium text-white">View Logs</p>
                                        <p className="text-xs text-gray-500">Access system logs</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* MODALS */}

            {/* New Thread Modal */}
            {showNewThreadModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700/50 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white">New Conversation</h3>
                            <button
                                onClick={() => setShowNewThreadModal(false)}
                                className="p-2 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-3">
                            <button
                                onClick={() => handleCreateThread('ai')}
                                className="w-full flex items-center gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl transition-all text-left touch-manipulation"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                                    <Bot size={24} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-white">AI Assistant</h4>
                                    <p className="text-sm text-gray-400">Start a conversation with AI</p>
                                </div>
                            </button>

                            <button
                                onClick={() => handleCreateThread('group')}
                                className="w-full flex items-center gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl transition-all text-left touch-manipulation"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                                    <Users size={24} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-white">Group Chat</h4>
                                    <p className="text-sm text-gray-400">Create group with users & AI</p>
                                </div>
                            </button>

                            <button
                                onClick={() => handleCreateThread('dm')}
                                className="w-full flex items-center gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 rounded-xl transition-all text-left touch-manipulation"
                            >
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                                    <MessageCircle size={24} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-white">Direct Message</h4>
                                    <p className="text-sm text-gray-400">Message a specific user</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700/50 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white">
                                {selectedUser ? 'Edit User' : 'Add New User'}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowUserModal(false);
                                    setSelectedUser(null);
                                    setEditForm({ name: '', email: '', role: 'user' });
                                }}
                                className="p-2 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    placeholder="Enter full name"
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    placeholder="user@example.com"
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                                <select
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 transition-all"
                                >
                                    <option value="user">User</option>
                                    <option value="moderator">Moderator</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-6 border-t border-gray-800">
                            <button
                                onClick={() => {
                                    setShowUserModal(false);
                                    setSelectedUser(null);
                                    setEditForm({ name: '', email: '', role: 'user' });
                                }}
                                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-all touch-manipulation"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveUser}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-xl text-white font-medium shadow-lg shadow-purple-500/20 transition-all touch-manipulation"
                            >
                                {selectedUser ? 'Save Changes' : 'Add User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ping User Modal */}
            {showPingModal && pingTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700/50 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white">
                                Ping {pingTarget.name}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowPingModal(false);
                                    setPingTarget(null);
                                    setPingMessage('');
                                }}
                                className="p-2 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                                <textarea
                                    value={pingMessage}
                                    onChange={(e) => setPingMessage(e.target.value)}
                                    placeholder="Enter your message to the user..."
                                    rows={4}
                                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-6 border-t border-gray-800">
                            <button
                                onClick={() => {
                                    setShowPingModal(false);
                                    setPingTarget(null);
                                    setPingMessage('');
                                }}
                                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-all touch-manipulation"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendPing}
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl text-white font-medium shadow-lg shadow-blue-500/20 transition-all touch-manipulation"
                            >
                                <Bell size={16} className="inline mr-2" />
                                Send Ping
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Profile Modal */}
            {showProfileModal && profile && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-700/50 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h3 className="text-xl font-bold text-white">My Profile</h3>
                            <button
                                onClick={() => setShowProfileModal(false)}
                                className="p-2 hover:bg-gray-800 rounded-lg transition-all touch-manipulation"
                            >
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Avatar */}
                            <div className="flex justify-center">
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-3xl">
                                    {profile.name.split(' ').map(n => n[0]).join('')}
                                </div>
                            </div>

                            {/* Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white">
                                        {profile.name}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white">
                                        {profile.email}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3">
                                        <span className="px-3 py-1 rounded-lg text-sm font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                            {profile.role}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Handle</label>
                                    <div className="bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white">
                                        {profile.handle || '@user'}
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                        <div className="text-2xl font-bold text-purple-400">{profile.aiUsage || 0}</div>
                                        <div className="text-xs text-gray-500">AI Requests</div>
                                    </div>
                                    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                        <div className="text-2xl font-bold text-blue-400">{profile.storageUsed || 0} GB</div>
                                        <div className="text-xs text-gray-500">Storage Used</div>
                                    </div>
                                    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                        <div className="text-2xl font-bold text-green-400">{profile.devices || 0}</div>
                                        <div className="text-xs text-gray-500">Devices</div>
                                    </div>
                                    <div className="bg-gray-800/30 rounded-xl p-4 border border-gray-700/50">
                                        <div className="text-2xl font-bold text-yellow-400">{profile.status || 'online'}</div>
                                        <div className="text-xs text-gray-500">Status</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-6 border-t border-gray-800">
                            <button
                                onClick={() => setShowProfileModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-all touch-manipulation"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanelConnected;
