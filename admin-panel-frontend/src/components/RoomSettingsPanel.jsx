// admin-panel-frontend/src/components/RoomSettingsPanel.jsx
import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, AlertTriangle, Bot, Bell, Clock, Edit3 } from 'lucide-react';

/**
 * Phase 6 & 6B: Room Settings Panel
 * Allows owner/admin to:
 * - Rename room
 * - Toggle AI
 * - Toggle notifications
 * - Set self-destruct timer
 * - Delete room (owner OR global admin)
 */
export default function RoomSettingsPanel({
    room,
    isOpen,
    onClose,
    onRoomUpdated,
    onRoomDeleted,
    userRole, // "owner", "admin", or "member"
    userIsGlobalAdmin = false, // Phase 6B: Global admin can manage any room
}) {
    // Room settings state
    const [roomName, setRoomName] = useState(room?.name || '');
    const [aiEnabled, setAiEnabled] = useState(room?.ai_enabled ?? true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(room?.notifications_enabled ?? true);
    const [selfDestructDuration, setSelfDestructDuration] = useState('never');

    // UI state
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [error, setError] = useState('');

    // Permissions
    const canManageSettings = userIsGlobalAdmin || userRole === 'owner' || userRole === 'admin';
    const canDelete = userIsGlobalAdmin || userRole === 'owner';

    // Calculate current self-destruct status
    const [timeRemaining, setTimeRemaining] = useState(null);

    useEffect(() => {
        if (!room) return;

        // Update state when room changes
        setRoomName(room.name || '');
        setAiEnabled(room.ai_enabled ?? true);
        setNotificationsEnabled(room.notifications_enabled ?? true);

        // Calculate time remaining
        if (room.self_destruct_at) {
            const destruct = new Date(room.self_destruct_at);
            const now = new Date();
            const diff = destruct - now;

            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeRemaining({ days, hours, minutes, total_ms: diff });

                // Set dropdown to closest preset or "custom"
                if (days >= 85 && days <= 95) setSelfDestructDuration('90d');
                else if (days >= 28 && days <= 32) setSelfDestructDuration('30d');
                else if (days >= 5 && days <= 9) setSelfDestructDuration('7d');
                else setSelfDestructDuration('custom');
            } else {
                setTimeRemaining(null);
                setSelfDestructDuration('never');
            }
        } else {
            setTimeRemaining(null);
            setSelfDestructDuration('never');
        }
    }, [room]);

    const handleSaveSettings = async () => {
        if (!room || !canManageSettings) return;

        setError('');
        setSaving(true);

        try {
            // Update room name and basic settings via PATCH /api/rooms/{id}
            const updatePayload = {
                name: roomName.trim() || room.name, // Don't allow empty names
                ai_enabled: aiEnabled,
                notifications_enabled: notificationsEnabled,
            };

            const updateResponse = await fetch(`/api/rooms/${room.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatePayload),
            });

            if (!updateResponse.ok) {
                const errorData = await updateResponse.json();
                throw new Error(errorData.detail || 'Failed to update room settings');
            }

            const updatedRoom = await updateResponse.json();

            // If self-destruct changed, set it separately via POST /api/rooms/{id}/self-destruct
            if (selfDestructDuration !== 'custom') {
                const selfDestructResponse = await fetch(
                    `/api/rooms/${room.id}/self-destruct`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ duration: selfDestructDuration }),
                    }
                );

                if (!selfDestructResponse.ok) {
                    const errorData = await selfDestructResponse.json();
                    throw new Error(errorData.detail || 'Failed to set self-destruct timer');
                }

                const selfDestructData = await selfDestructResponse.json();
                updatedRoom.self_destruct_at = selfDestructData.self_destruct_at;
            }

            onRoomUpdated(updatedRoom);
            onClose();
        } catch (err) {
            console.error('Error saving settings:', err);
            setError(err.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRoom = async () => {
        if (!room || !canDelete) return;

        setError('');
        setDeleting(true);

        try {
            const response = await fetch(`/api/rooms/${room.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to delete room');
            }

            onRoomDeleted(room.id);
            onClose();
        } catch (err) {
            console.error('Error deleting room:', err);
            setError(err.message || 'Failed to delete room');
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (!isOpen || !room) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-slate-800 border border-cyan-500/30 rounded-lg shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-cyan-500/30">
                    <h2 className="text-xl font-semibold text-cyan-400">Room Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-2 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Room Name (Phase 6B) */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                            <Edit3 className="w-4 h-4 text-sky-400" />
                            Room Name
                        </label>
                        <input
                            type="text"
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            disabled={!canManageSettings}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="Enter room name..."
                        />
                    </div>

                    {/* Self-Destruct Timer (Phase 6B) */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-2">
                            <Clock className="w-4 h-4 text-amber-400" />
                            Self-Destruct Timer
                        </label>

                        {timeRemaining && (
                            <div className="mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                <div className="text-xs text-amber-400">
                                    Time Remaining: <span className="font-mono font-semibold">
                                        {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m
                                    </span>
                                </div>
                            </div>
                        )}

                        <select
                            value={selfDestructDuration}
                            onChange={(e) => setSelfDestructDuration(e.target.value)}
                            disabled={!canManageSettings}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="never">Never (No Auto-Delete)</option>
                            <option value="7d">7 Days</option>
                            <option value="30d">30 Days</option>
                            <option value="90d">90 Days</option>
                            {selfDestructDuration === 'custom' && (
                                <option value="custom">Custom (Modify to Change)</option>
                            )}
                        </select>

                        <p className="mt-1 text-xs text-slate-500">
                            Room will be automatically deleted after the selected time period of inactivity.
                        </p>
                    </div>

                    {/* AI Toggle (Phase 6) */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5 text-purple-400" />
                            <div>
                                <div className="text-sm font-medium text-slate-300">AI Chat</div>
                                <div className="text-xs text-slate-500">Enable AI responses in this room</div>
                            </div>
                        </div>
                        <button
                            onClick={() => canManageSettings && setAiEnabled(!aiEnabled)}
                            disabled={!canManageSettings}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiEnabled ? 'bg-purple-500' : 'bg-slate-700'
                                } ${!canManageSettings && 'opacity-50 cursor-not-allowed'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Notifications Toggle (Phase 6) */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Bell className="w-5 h-5 text-sky-400" />
                            <div>
                                <div className="text-sm font-medium text-slate-300">Notifications</div>
                                <div className="text-xs text-slate-500">Receive alerts for new messages</div>
                            </div>
                        </div>
                        <button
                            onClick={() => canManageSettings && setNotificationsEnabled(!notificationsEnabled)}
                            disabled={!canManageSettings}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-sky-500' : 'bg-slate-700'
                                } ${!canManageSettings && 'opacity-50 cursor-not-allowed'}`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Delete Room Section (Phase 6) */}
                    {canDelete && (
                        <div className="border-t border-slate-700 pt-6">
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
                                        <p className="text-xs text-slate-400 mb-3">
                                            Deleting this room will permanently remove all messages and members. This action cannot be undone.
                                        </p>

                                        {!showDeleteConfirm ? (
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Delete Room
                                            </button>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-sm text-red-300 font-medium">Are you sure?</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleDeleteRoom}
                                                        disabled={deleting}
                                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        {deleting ? 'Deleting...' : 'Yes, Delete'}
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(false)}
                                                        disabled={deleting}
                                                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!canManageSettings && (
                        <div className="text-xs text-slate-500 text-center">
                            Only room owners and admins can modify these settings.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t border-cyan-500/30">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    {canManageSettings && (
                        <button
                            onClick={handleSaveSettings}
                            disabled={saving || !roomName.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
