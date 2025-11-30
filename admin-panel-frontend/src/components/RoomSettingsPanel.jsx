// admin-panel-frontend/src/components/RoomSettingsPanel.jsx
import React, { useState } from 'react';
import { Settings, Trash2, Bot, Bell, X, AlertTriangle } from 'lucide-react';

/**
 * RoomSettingsPanel - Manage room settings (AI, notifications, delete)
 * @param {Object} room - Current room object
 * @param {Function} onClose - Callback to close the panel
 * @param {Function} onRoomDeleted - Callback when room is deleted
 * @param {Function} onSettingsUpdated - Callback when settings are updated
 * @param {boolean} canManageSettings - Whether current user can manage settings (owner/admin)
 */
function RoomSettingsPanel({
    room,
    onClose,
    onRoomDeleted,
    onSettingsUpdated,
    canManageSettings = false
}) {
    const [aiEnabled, setAiEnabled] = useState(room?.ai_enabled ?? true);
    const [notificationsEnabled, setNotificationsEnabled] = useState(room?.notifications_enabled ?? true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);

    const handleSaveSettings = async () => {
        if (!room) return;

        setSaving(true);
        setError(null);

        try {
            const res = await fetch(`/api/rooms/${room.id}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ai_enabled: aiEnabled,
                    notifications_enabled: notificationsEnabled
                })
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('Failed to update settings:', res.status, errorText);

                if (res.status === 403) {
                    setError('Only room owners and admins can update settings.');
                } else {
                    setError('Failed to update room settings. Please try again.');
                }
                return;
            }

            const data = await res.json();

            // Notify parent component
            if (onSettingsUpdated) {
                onSettingsUpdated(data);
            }

            // Close panel after successful save
            if (onClose) {
                onClose();
            }

        } catch (err) {
            console.error('Error updating settings:', err);
            setError('Failed to update settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRoom = async () => {
        if (!room) return;

        setDeleting(true);
        setError(null);

        try {
            const res = await fetch(`/api/rooms/${room.id}`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('Failed to delete room:', res.status, errorText);

                if (res.status === 403) {
                    setError('Only the room owner can delete the room.');
                } else {
                    setError('Failed to delete room. Please try again.');
                }
                return;
            }

            // Notify parent component
            if (onRoomDeleted) {
                onRoomDeleted(room.id);
            }

            // Close panel
            if (onClose) {
                onClose();
            }

        } catch (err) {
            console.error('Error deleting room:', err);
            setError('Failed to delete room. Please try again.');
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (!room) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center">
                            <Settings className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-200">Room Settings</h2>
                            <p className="text-sm text-slate-400">{room.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-sm">
                            {error}
                        </div>
                    )}

                    {!canManageSettings && (
                        <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 text-sm">
                            Only room owners and admins can change settings.
                        </div>
                    )}

                    {/* AI Toggle */}
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-violet-400" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-200">AI Responses</div>
                                <div className="text-xs text-slate-400">Allow AI to respond in this room</div>
                            </div>
                        </div>
                        <button
                            onClick={() => canManageSettings && setAiEnabled(!aiEnabled)}
                            disabled={!canManageSettings}
                            className={`relative w-12 h-6 rounded-full transition-colors ${aiEnabled ? 'bg-violet-500' : 'bg-slate-600'
                                } ${canManageSettings ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        >
                            <div
                                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${aiEnabled ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Notifications Toggle */}
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-sky-500/20 flex items-center justify-center">
                                <Bell className="w-5 h-5 text-sky-400" />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-200">Notifications</div>
                                <div className="text-xs text-slate-400">Get notified of room activity</div>
                            </div>
                        </div>
                        <button
                            onClick={() => canManageSettings && setNotificationsEnabled(!notificationsEnabled)}
                            disabled={!canManageSettings}
                            className={`relative w-12 h-6 rounded-full transition-colors ${notificationsEnabled ? 'bg-sky-500' : 'bg-slate-600'
                                } ${canManageSettings ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                        >
                            <div
                                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Delete Room Section */}
                    {canManageSettings && (
                        <div className="pt-4 border-t border-slate-800">
                            {!showDeleteConfirm ? (
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-rose-300 font-medium transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Room
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3 p-3 bg-rose-500/20 border border-rose-500/30 rounded-lg">
                                        <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-rose-300">
                                            <div className="font-medium mb-1">Are you sure?</div>
                                            <div>This will permanently delete the room and all messages. This action cannot be undone.</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowDeleteConfirm(false)}
                                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDeleteRoom}
                                            disabled={deleting}
                                            className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {deleting ? 'Deleting...' : 'Delete Forever'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {canManageSettings && !showDeleteConfirm && (
                    <div className="flex gap-2 p-4 border-t border-slate-800">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveSettings}
                            disabled={saving}
                            className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-600 to-sky-600 hover:from-violet-500 hover:to-sky-500 rounded-lg text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default RoomSettingsPanel;
