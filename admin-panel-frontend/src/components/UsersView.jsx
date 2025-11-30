// admin-panel-frontend/src/components/UsersView.jsx
import React, { useState, useEffect } from 'react';
import { Users, UserCircle, Shield, UserCog, Circle, Loader2, AlertCircle } from 'lucide-react';

/**
 * UsersView - Display list of all users in the system
 * Shows name, handle, email, role, and status for each user
 */
function UsersView() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/users');

            if (!res.ok) {
                throw new Error(`Failed to load users: ${res.status}`);
            }

            const data = await res.json();
            setUsers(data);
        } catch (err) {
            console.error('Error loading users:', err);
            setError(err.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    // Helper to get role badge styling
    const getRoleBadge = (role) => {
        switch (role?.toLowerCase()) {
            case 'admin':
                return {
                    icon: <Shield className="w-3 h-3" />,
                    className: 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                };
            case 'moderator':
                return {
                    icon: <UserCog className="w-3 h-3" />,
                    className: 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                };
            default:
                return {
                    icon: <UserCircle className="w-3 h-3" />,
                    className: 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                };
        }
    };

    // Helper to get status badge styling
    const getStatusBadge = (status) => {
        switch (status?.toLowerCase()) {
            case 'online':
                return {
                    icon: <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />,
                    text: 'Online',
                    className: 'text-emerald-400'
                };
            case 'away':
                return {
                    icon: <Circle className="w-2 h-2 fill-amber-400 text-amber-400" />,
                    text: 'Away',
                    className: 'text-amber-400'
                };
            case 'offline':
                return {
                    icon: <Circle className="w-2 h-2 fill-slate-500 text-slate-500" />,
                    text: 'Offline',
                    className: 'text-slate-500'
                };
            default:
                return {
                    icon: <Circle className="w-2 h-2 fill-slate-500 text-slate-500" />,
                    text: 'Unknown',
                    className: 'text-slate-500'
                };
        }
    };

    // Helper to get initials from name
    const getInitials = (name) => {
        if (!name) return '??';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="flex flex-col h-full bg-slate-950">
            {/* Header */}
            <div className="flex-none border-b border-slate-800/60 bg-slate-900/40 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-slate-200">Users</h1>
                        <p className="text-sm text-slate-400">
                            {loading ? 'Loading...' : `${users.length} total users`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin mb-3" />
                        <p className="text-sm">Loading users...</p>
                    </div>
                )}

                {error && !loading && (
                    <div className="flex flex-col items-center justify-center py-12 text-rose-400">
                        <AlertCircle className="w-8 h-8 mb-3" />
                        <p className="text-sm">{error}</p>
                        <button
                            onClick={loadUsers}
                            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && users.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <Users className="w-8 h-8 mb-3 opacity-50" />
                        <p className="text-sm">No users found</p>
                    </div>
                )}

                {!loading && !error && users.length > 0 && (
                    <div className="max-w-5xl mx-auto">
                        {/* Desktop Table View */}
                        <div className="hidden md:block bg-slate-900/40 border border-slate-800/60 rounded-xl overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-slate-800/40 border-b border-slate-800/60">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            User
                                        </th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            Handle
                                        </th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            Role
                                        </th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {users.map((user) => {
                                        const roleBadge = getRoleBadge(user.role);
                                        const statusBadge = getStatusBadge(user.status);

                                        return (
                                            <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white font-semibold text-sm">
                                                            {getInitials(user.name)}
                                                        </div>
                                                        <div className="font-medium text-slate-200">
                                                            {user.name}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-400">
                                                    {user.handle}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-400">
                                                    {user.email}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${roleBadge.className}`}>
                                                        {roleBadge.icon}
                                                        <span className="capitalize">{user.role}</span>
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusBadge.className}`}>
                                                        {statusBadge.icon}
                                                        <span>{statusBadge.text}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-3">
                            {users.map((user) => {
                                const roleBadge = getRoleBadge(user.role);
                                const statusBadge = getStatusBadge(user.status);

                                return (
                                    <div
                                        key={user.id}
                                        className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4"
                                    >
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white font-semibold">
                                                {getInitials(user.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-slate-200 mb-1">
                                                    {user.name}
                                                </div>
                                                <div className="text-sm text-slate-400">
                                                    {user.handle}
                                                </div>
                                            </div>
                                            <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusBadge.className}`}>
                                                {statusBadge.icon}
                                                <span className="hidden sm:inline">{statusBadge.text}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Email</span>
                                                <span className="text-slate-300">{user.email}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500">Role</span>
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${roleBadge.className}`}>
                                                    {roleBadge.icon}
                                                    <span className="capitalize">{user.role}</span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UsersView;
