import React, { useState, useEffect } from 'react';
import { Wifi, Server, RefreshCw, XCircle, MessageSquare, Users, Clock, Settings, Trash2 } from 'lucide-react';
import RoomSettingsPanel from './RoomSettingsPanel';

export function SystemPanel({
    tailnetStats,
    refreshTailnetStats,
    exitNodeChanging,
    setExitNodeChanging,
    currentUser  // Phase 6B: Pass current user to check admin status
}) {
    const [exitNodeInput, setExitNodeInput] = useState('');
    const [actionMessage, setActionMessage] = useState(null);

    // Phase 6B: Room Management for admins
    const [allRooms, setAllRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [showRoomSettings, setShowRoomSettings] = useState(false);
    const [roomFilter, setRoomFilter] = useState('all'); // 'all', 'not-member', 'member'
    const [myRoomIds, setMyRoomIds] = useState(new Set());

    const isAdmin = currentUser?.role === 'admin';

    // Load user's rooms to determine membership
    const loadMyRooms = async () => {
        try {
            const res = await fetch('/api/rooms');
            if (res.ok) {
                const rooms = await res.json();
                setMyRoomIds(new Set(rooms.map(r => r.id)));
            }
        } catch (err) {
            console.error('Failed to load my rooms:', err);
        }
    };

    // Load all rooms for admin
    const loadAllRooms = async () => {
        if (!isAdmin) return;

        setLoadingRooms(true);
        try {
            const res = await fetch('/api/admin/rooms/all');
            if (res.ok) {
                const rooms = await res.json();
                setAllRooms(rooms);
            }
        } catch (err) {
            console.error('Failed to load all rooms:', err);
        } finally {
            setLoadingRooms(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            loadMyRooms();
            loadAllRooms();
        }
    }, [isAdmin]);

    // Filter rooms based on selection
    const filteredRooms = allRooms.filter(room => {
        if (roomFilter === 'all') return true;
        if (roomFilter === 'not-member') return !myRoomIds.has(room.id);
        if (roomFilter === 'member') return myRoomIds.has(room.id);
        return true;
    });

    const applyExitNode = async (disable = false) => {
        setExitNodeChanging(true);
        setActionMessage(null);
        try {
            const body = disable ? { action: 'disable' } : { action: 'enable', nodeId: exitNodeInput.trim() };
            const res = await fetch('/api/system/tailscale/exitnode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await res.json();
            if (data.status === 'ok') {
                setActionMessage('Exit node updated');
                await refreshTailnetStats();
            } else {
                setActionMessage(data.error || 'Failed');
            }
        } catch (e) {
            setActionMessage(e.message);
        } finally {
            setExitNodeChanging(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                <h2 className="text-sm font-semibold flex items-center gap-2"><Wifi className="w-4 h-4" />Tailnet Controls</h2>
                <div className="grid sm:grid-cols-3 gap-3 text-[12px]">
                    <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                        <div className="text-slate-500">Status</div>
                        <div className="font-semibold text-slate-300">{tailnetStats?.status || 'unknown'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                        <div className="text-slate-500">Devices Online</div>
                        <div className="font-semibold text-slate-300">{tailnetStats?.devices_online ?? '--'}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                        <div className="text-slate-500">Exit Node</div>
                        <div className="font-semibold text-slate-300 truncate">{tailnetStats?.exit_node ?? 'none'}</div>
                    </div>
                </div>
                <div className="flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="block text-[10px] mb-1 text-slate-500">Exit Node (IP or name)</label>
                        <input value={exitNodeInput} onChange={e => setExitNodeInput(e.target.value)} placeholder="100.x.y.z or hostname" className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-[12px] focus:outline-none focus:border-violet-500/70" />
                    </div>
                    <button disabled={!exitNodeInput.trim() || exitNodeChanging} onClick={() => applyExitNode(false)} className="px-3 py-2 rounded-lg text-[12px] font-semibold bg-violet-600/80 hover:bg-violet-600 text-white disabled:opacity-40 flex items-center gap-1"><Server className="w-3.5 h-3.5" />Set</button>
                    <button disabled={exitNodeChanging} onClick={() => applyExitNode(true)} className="px-3 py-2 rounded-lg text-[12px] font-semibold bg-slate-800/70 border border-slate-700 hover:bg-slate-700/70 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Disable</button>
                </div>
                {actionMessage && <div className="text-[11px] text-slate-400">{actionMessage}</div>}
                <div className="pt-2 flex justify-end">
                    <button onClick={refreshTailnetStats} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-300 text-[12px] hover:bg-slate-700/70"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
                </div>
            </div>

            {/* Phase 6B: Room Management (Admin Only) */}
            {isAdmin && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Room Management (Admin)
                        </h2>
                        <button
                            onClick={() => { loadMyRooms(); loadAllRooms(); }}
                            disabled={loadingRooms}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-800/70 hover:bg-slate-700/70 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3 h-3 ${loadingRooms ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    <div className="text-xs text-slate-400 mb-2">
                        Manage all rooms including those you're not a member of. Settings only - no message access.
                    </div>

                    {/* Filter buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setRoomFilter('all')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${roomFilter === 'all'
                                    ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                                    : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-800'
                                }`}
                        >
                            All Rooms ({allRooms.length})
                        </button>
                        <button
                            onClick={() => setRoomFilter('not-member')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${roomFilter === 'not-member'
                                    ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                                    : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-800'
                                }`}
                        >
                            Not a Member ({allRooms.filter(r => !myRoomIds.has(r.id)).length})
                        </button>
                        <button
                            onClick={() => setRoomFilter('member')}
                            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${roomFilter === 'member'
                                    ? 'bg-violet-600/30 text-violet-300 border border-violet-500/50'
                                    : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:bg-slate-800'
                                }`}
                        >
                            I'm a Member ({allRooms.filter(r => myRoomIds.has(r.id)).length})
                        </button>
                    </div>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {loadingRooms ? (
                            <div className="text-sm text-slate-500 text-center py-4">Loading rooms...</div>
                        ) : filteredRooms.length === 0 ? (
                            <div className="text-sm text-slate-500 text-center py-4">
                                {roomFilter === 'not-member' ? 'No rooms where you are not a member' :
                                    roomFilter === 'member' ? 'No rooms where you are a member' :
                                        'No rooms found'}
                            </div>
                        ) : (
                            filteredRooms.map(room => {
                                const destructTime = room.self_destruct_at ? new Date(room.self_destruct_at) : null;
                                const timeRemaining = destructTime ? destructTime - new Date() : null;
                                const isExpired = timeRemaining && timeRemaining <= 0;
                                const isUrgent = timeRemaining && timeRemaining < (24 * 60 * 60 * 1000);

                                return (
                                    <div
                                        key={room.id}
                                        className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-slate-300">{room.name}</span>
                                                {destructTime && !isExpired && (
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${isUrgent
                                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                        }`}>
                                                        <Clock className="w-3 h-3 inline mr-1" />
                                                        {Math.floor(timeRemaining / (1000 * 60 * 60 * 24))}d
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1">
                                                ID: {room.id} • Messages: {room.total_messages || 0} • AI Requests: {room.total_ai_requests || 0}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedRoom(room);
                                                setShowRoomSettings(true);
                                            }}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-500/30"
                                        >
                                            <Settings className="w-3 h-3" />
                                            Manage
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Room Settings Modal for Admin Management */}
            {selectedRoom && (
                <RoomSettingsPanel
                    room={selectedRoom}
                    isOpen={showRoomSettings}
                    onClose={() => {
                        setShowRoomSettings(false);
                        setSelectedRoom(null);
                    }}
                    onRoomUpdated={(updatedRoom) => {
                        // Update room in list
                        setAllRooms(prev => prev.map(r => r.id === updatedRoom.id ? updatedRoom : r));
                    }}
                    onRoomDeleted={(roomId) => {
                        // Remove from list
                        setAllRooms(prev => prev.filter(r => r.id !== roomId));
                        setShowRoomSettings(false);
                        setSelectedRoom(null);
                    }}
                    userRole="member"
                    userIsGlobalAdmin={true}
                />
            )}
        </div>
    );
}

export default SystemPanel;
