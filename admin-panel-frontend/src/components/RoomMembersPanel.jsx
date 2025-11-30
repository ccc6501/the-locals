// admin-panel-frontend/src/components/RoomMembersPanel.jsx
import React from 'react';
import { Users, Crown, Shield, User as UserIcon, Loader2, AlertCircle } from 'lucide-react';

/**
 * RoomMembersPanel - Display room members in a read-only panel
 * @param {Array} members - List of member objects from useRoomMembers hook
 * @param {boolean} loading - Loading state
 * @param {string} error - Error message if any
 * @param {Function} onClose - Callback to close the panel (optional)
 */
const RoomMembersPanel = ({ members = [], loading = false, error = null, onClose }) => {
    // Helper to get initials from name
    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    // Helper to get role badge color and icon
    const getRoleBadge = (role) => {
        switch (role?.toLowerCase()) {
            case 'owner':
                return {
                    icon: Crown,
                    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                    label: 'Owner'
                };
            case 'admin':
                return {
                    icon: Shield,
                    color: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
                    label: 'Admin'
                };
            default:
                return {
                    icon: UserIcon,
                    color: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
                    label: 'Member'
                };
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800/70">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-slate-200">
                        Participants
                    </h3>
                    {!loading && !error && (
                        <span className="text-xs text-slate-500">
                            ({members.length})
                        </span>
                    )}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-slate-300 transition-colors"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin mb-2" />
                        <p className="text-xs">Loading members...</p>
                    </div>
                )}

                {/* Error State */}
                {error && !loading && (
                    <div className="flex flex-col items-center justify-center py-8 text-rose-400">
                        <AlertCircle className="w-6 h-6 mb-2" />
                        <p className="text-xs text-center">{error}</p>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && members.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                        <Users className="w-6 h-6 mb-2 opacity-50" />
                        <p className="text-xs">No members yet</p>
                    </div>
                )}

                {/* Members List */}
                {!loading && !error && members.length > 0 && (
                    <div className="space-y-2">
                        {members.map((member) => {
                            const roleBadge = getRoleBadge(member.role);
                            const RoleIcon = roleBadge.icon;

                            return (
                                <div
                                    key={member.user_id}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/60 hover:border-slate-700/60 transition-colors"
                                >
                                    {/* Avatar with Initials */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white font-semibold text-sm">
                                        {getInitials(member.name)}
                                    </div>

                                    {/* Member Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-200 truncate">
                                                {member.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-slate-500 truncate">
                                                {member.handle}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Role Badge */}
                                    <div className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${roleBadge.color}`}>
                                        <RoleIcon className="w-3 h-3" />
                                        {roleBadge.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoomMembersPanel;
