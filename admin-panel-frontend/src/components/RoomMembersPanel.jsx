// admin-panel-frontend/src/components/RoomMembersPanel.jsx
import React, { useState } from 'react';
import { Users, Crown, Shield, User as UserIcon, Loader2, AlertCircle, UserPlus, Search, X } from 'lucide-react';
import { useAllUsers } from '../hooks/useAllUsers';

/**
 * RoomMembersPanel - Display room members with optional "Add people" functionality
 * @param {Array} members - List of member objects from useRoomMembers hook
 * @param {boolean} loading - Loading state
 * @param {string} error - Error message if any
 * @param {Function} onClose - Callback to close the panel (optional)
 * @param {boolean} canManageMembers - Whether current user can add members (owner/admin)
 * @param {number} roomId - Current room ID (required if canManageMembers is true)
 */
const RoomMembersPanel = ({ 
    members = [], 
    loading = false, 
    error = null, 
    onClose,
    canManageMembers = false,
    roomId = null
}) => {
    const [showAddPeople, setShowAddPeople] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [addingUserId, setAddingUserId] = useState(null);
    const [addError, setAddError] = useState(null);
    
    // Fetch all users only if we can manage members
    const { users, loading: usersLoading } = useAllUsers();

    // Helper to add a user to the room
    const handleAddUser = async (userId) => {
        if (!roomId) return;
        
        setAddingUserId(userId);
        setAddError(null);
        
        try {
            const res = await fetch(`/api/rooms/${roomId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            
            if (!res.ok) {
                const errorText = await res.text();
                console.error('Failed to add user:', res.status, errorText);
                
                if (res.status === 403) {
                    setAddError('Only owners and admins can add people to this room.');
                } else if (res.status === 400 || res.status === 409) {
                    setAddError('Could not add that user. They may already be a member.');
                } else {
                    setAddError('Failed to add user. Please try again.');
                }
                return;
            }
            
            // Success - close add people UI and refresh
            setShowAddPeople(false);
            setSearchQuery('');
            
            // Force refresh to update members list
            window.location.reload();
            
        } catch (err) {
            console.error('Error adding user:', err);
            setAddError('Failed to add user. Please try again.');
        } finally {
            setAddingUserId(null);
        }
    };

    // Filter users for add people UI
    const memberIds = new Set(members.map(m => m.user_id));
    const candidateUsers = users
        .filter(u => !memberIds.has(u.id))
        .filter(u => {
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase();
            return (
                u.name?.toLowerCase().includes(query) ||
                u.handle?.toLowerCase().includes(query)
            );
        });

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
                <div className="flex items-center gap-2">
                    {/* Add People Button - Only visible if user can manage members */}
                    {canManageMembers && !showAddPeople && (
                        <button
                            onClick={() => setShowAddPeople(true)}
                            className="p-1.5 rounded-lg hover:bg-violet-500/20 text-violet-400 hover:text-violet-300 transition-colors"
                            aria-label="Add people"
                            title="Add people"
                        >
                            <UserPlus className="w-4 h-4" />
                        </button>
                    )}
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
            </div>

            {/* Add People UI - Shown when button is clicked */}
            {canManageMembers && showAddPeople && (
                <div className="border-b border-slate-800/70 bg-slate-900/60 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-slate-200">Add People</h4>
                        <button
                            onClick={() => {
                                setShowAddPeople(false);
                                setSearchQuery('');
                                setAddError(null);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-slate-300"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Search Box */}
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name or handle..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700/60 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
                        />
                    </div>

                    {/* Error Message */}
                    {addError && (
                        <div className="mb-3 p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400">
                            {addError}
                        </div>
                    )}

                    {/* Candidate Users List */}
                    <div className="max-h-64 overflow-y-auto space-y-1">
                        {usersLoading ? (
                            <div className="flex items-center justify-center py-4 text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                <span className="text-xs">Loading users...</span>
                            </div>
                        ) : candidateUsers.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-4">
                                {searchQuery.trim() ? 'No users found' : 'All users are already members'}
                            </p>
                        ) : (
                            candidateUsers.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleAddUser(user.id)}
                                    disabled={addingUserId === user.id}
                                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60 hover:border-violet-500/50 hover:bg-slate-800/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {/* Avatar */}
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white font-semibold text-xs">
                                        {getInitials(user.name)}
                                    </div>
                                    
                                    {/* User Info */}
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="text-sm font-medium text-slate-200 truncate">
                                            {user.name}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {user.handle}
                                        </div>
                                    </div>

                                    {/* Adding Indicator */}
                                    {addingUserId === user.id && (
                                        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

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
