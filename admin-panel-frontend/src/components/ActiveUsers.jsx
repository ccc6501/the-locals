import React, { useState, useEffect } from 'react';
import { Users, Wifi, WifiOff, Smartphone, Monitor, Tablet, Shield, UserCog, User as UserIcon, Clock } from 'lucide-react';

const ActiveUsers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({ total: 0, online: 0 });

    const fetchActiveUsers = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/users/active/tailscale');
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
        }
    };

    useEffect(() => {
        fetchActiveUsers();
        // Refresh every 10 seconds
        const interval = setInterval(fetchActiveUsers, 10000);
        return () => clearInterval(interval);
    }, []);

    const getRoleIcon = (role) => {
        switch(role) {
            case 'admin': return <Shield className="w-4 h-4 text-rose-400" />;
            case 'moderator': return <UserCog className="w-4 h-4 text-sky-400" />;
            default: return <UserIcon className="w-4 h-4 text-slate-400" />;
        }
    };

    const getRoleBadgeColor = (role) => {
        switch(role) {
            case 'admin': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
            case 'moderator': return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
            default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch(deviceType) {
            case 'mobile': return <Smartphone className="w-4 h-4" />;
            case 'tablet': return <Tablet className="w-4 h-4" />;
            default: return <Monitor className="w-4 h-4" />;
        }
    };

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
                        onClick={fetchActiveUsers}
                        className="px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
                    >
                        Refresh
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
                            className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 hover:bg-slate-900/60 hover:border-slate-700/50 transition-all"
                        >
                            {/* User Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    {/* Avatar */}
                                    <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br ${
                                        user.role === 'admin' ? 'from-rose-600 to-pink-600' :
                                        user.role === 'moderator' ? 'from-sky-600 to-cyan-600' :
                                        'from-slate-600 to-slate-700'
                                    } flex items-center justify-center text-white font-semibold`}>
                                        {user.name.charAt(0).toUpperCase()}
                                        {/* Online Indicator */}
                                        {user.isOnline && (
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                                        )}
                                    </div>
                                    
                                    {/* User Info */}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-white">{user.name}</span>
                                            {user.isOnline ? (
                                                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                                            ) : (
                                                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400">{user.handle}</div>
                                    </div>
                                </div>

                                {/* Role Badge */}
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                                    {getRoleIcon(user.role)}
                                    <span>{user.role}</span>
                                </div>
                            </div>

                            {/* Device Info */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs">
                                    {getDeviceIcon(user.deviceType)}
                                    <span className="text-slate-400">{user.deviceName}</span>
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <code className="px-2 py-0.5 rounded bg-slate-950/50 font-mono text-[10px]">
                                        {user.tailscaleIp}
                                    </code>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{user.lastSeen}</span>
                                </div>
                            </div>
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
