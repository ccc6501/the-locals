import React, { useState, useEffect } from 'react';
import { Users, Wifi, WifiOff, Smartphone, Monitor, Tablet, Shield, UserCog, User as UserIcon, Clock, Edit2, Save, X, RefreshCw } from 'lucide-react';

const ActiveUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({ total: 0, online: 0 });
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [currentUser, setCurrentUser] = useState(null);

    // Fetch current user to determine admin status
    const fetchCurrentUser = async () => {
        try {
            const backendUrl = `http://${window.location.hostname}:8000/api/users/me`;
            const response = await fetch(backendUrl);
            if (response.ok) {
                const data = await response.json();
                setCurrentUser(data);
            }
        } catch (err) {
            console.error('Error fetching current user:', err);
        }
    };

    // Send heartbeat to update this device's last_active timestamp
    const sendHeartbeat = async () => {
        try {
            const backendUrl = `http://${window.location.hostname}:8000/api/users/heartbeat`;
            await fetch(backendUrl, { method: 'POST' });
        } catch (err) {
            console.error('Heartbeat failed:', err);
        }
    };

    const fetchActiveUsers = async (showRefreshing = false) => {
        if (showRefreshing) setRefreshing(true);
        try {
            const backendUrl = `http://${window.location.hostname}:8000/api/users/active/tailscale`;
            const response = await fetch(backendUrl);
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data.users || []);
            setStats({ total: data.total || 0, online: data.online || 0 });
            setError(null);
        } catch (err) {
            console.error('Error fetching active users:', err);
            setError(err.message);
        } finally {
            setLoading(false);
            if (showRefreshing) setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        fetchActiveUsers(true);
    };

    useEffect(() => {
        fetchCurrentUser();
        fetchActiveUsers();
        sendHeartbeat(); // Initial heartbeat

        // Refresh every 10 seconds
        const refreshInterval = setInterval(fetchActiveUsers, 10000);
        // Send heartbeat every 30 seconds to stay online
        const heartbeatInterval = setInterval(sendHeartbeat, 30000);

        return () => {
            clearInterval(refreshInterval);
            clearInterval(heartbeatInterval);
        };
    }, []);

    const startEdit = (user) => {
        setEditingUser(user.id);
        setEditForm({
            name: user.name,
            email: user.email,
            role: user.role
        });
    };

    const cancelEdit = () => {
        setEditingUser(null);
        setEditForm({});
    };

    const saveEdit = async (userId) => {
        try {
            const backendUrl = `http://${window.location.hostname}:8000/api/users/${userId}`;
            const response = await fetch(backendUrl, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });

            if (!response.ok) throw new Error('Failed to update user');

            // Refresh users list
            await fetchActiveUsers();
            setEditingUser(null);
            setEditForm({});
        } catch (err) {
            console.error('Error updating user:', err);
            alert('Failed to update user: ' + err.message);
        }
    };

    const getRoleIcon = (role) => {
        switch (role) {
            case 'admin': return <Shield className="w-4 h-4" />;
            case 'moderator': return <UserCog className="w-4 h-4" />;
            default: return <UserIcon className="w-4 h-4" />;
        }
    };

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'admin': return 'from-rose-600/30 to-pink-600/30 border-rose-500/40 text-rose-300';
            case 'moderator': return 'from-sky-600/30 to-cyan-600/30 border-sky-500/40 text-sky-300';
            default: return 'from-slate-600/30 to-slate-700/30 border-slate-500/40 text-slate-300';
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType) {
            case 'mobile': return <Smartphone className="w-4 h-4" />;
            case 'tablet': return <Tablet className="w-4 h-4" />;
            default: return <Monitor className="w-4 h-4" />;
        }
    };

    const isAdmin = currentUser && currentUser.role === 'admin';



    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-slate-400 flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                    <span className="text-sm">Loading users...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-rose-300 text-sm">
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-600/20 to-sky-600/20 border border-violet-500/20">
                            <Users className="w-5 h-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Active Users</h2>
                            <p className="text-xs text-slate-400">Tailscale Network</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-medium transition-colors flex items-center gap-2"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-3">
                        <div className="text-2xl font-bold text-white">{stats.total}</div>
                        <div className="text-xs text-slate-400">Total Devices</div>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                        <div className="text-2xl font-bold text-emerald-400">{stats.online}</div>
                        <div className="text-xs text-emerald-400/70">Online Now</div>
                    </div>
                </div>
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {users.length === 0 ? (
                    <div className="text-center text-slate-400 py-8">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No active users</p>
                    </div>
                ) : (
                    users.map((user) => (
                        <div
                            key={user.id}
                            className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-4 hover:bg-slate-900/80 hover:border-slate-700/60 transition-all"
                        >
                            {editingUser === user.id ? (
                                /* Edit Mode */
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-white">Edit User</h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => saveEdit(user.id)}
                                                className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="p-1.5 rounded-lg bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600/40 text-slate-400 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-sky-500/50"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-sky-500/50"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">Role</label>
                                        <select
                                            value={editForm.role}
                                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-sky-500/50"
                                        >
                                            <option value="user">User</option>
                                            <option value="moderator">Moderator</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                /* View Mode */
                                <>
                                    {/* User Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            {/* Avatar with Online Indicator */}
                                            <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${getRoleBadgeColor(user.role)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                                                {user.name.charAt(0).toUpperCase()}
                                                {user.isOnline && (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                                                )}
                                            </div>

                                            {/* User Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-sm font-semibold text-white truncate">{user.name}</span>
                                                    {user.isOnline ? (
                                                        <Wifi className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                    ) : (
                                                        <WifiOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 truncate">{user.handle}</div>
                                                <div className="text-xs text-slate-500 truncate">{user.email}</div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0 ml-2">
                                            {/* Role Badge */}
                                            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-br border text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                                {getRoleIcon(user.role)}
                                                <span className="capitalize">{user.role}</span>
                                            </div>

                                            {/* Edit Button (Admin Only) */}
                                            {isAdmin && (
                                                <button
                                                    onClick={() => startEdit(user)}
                                                    className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-400 hover:text-white transition-all"
                                                    title="Edit user"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Device Info */}
                                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800/50">
                                        <div className="flex items-center gap-2 text-xs">
                                            {getDeviceIcon(user.deviceType)}
                                            <span className="text-slate-400 truncate">{user.deviceName}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-xs justify-end">
                                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                            <span className="text-slate-400">{user.lastSeen}</span>
                                        </div>

                                        <div className="col-span-2 flex items-center gap-2 mt-1">
                                            <code className="px-2 py-1 rounded bg-slate-950/60 border border-slate-800/50 font-mono text-[10px] text-slate-400">
                                                {user.tailscaleIp}
                                            </code>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800/50 bg-slate-900/20">
                <p className="text-xs text-slate-500 text-center">
                    Auto-refreshes every 10 seconds
                </p>
            </div>
        </div>
    );
};

export default ActiveUsers;
