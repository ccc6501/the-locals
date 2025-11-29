// admin-panel-frontend/src/ChatRoomList.jsx
import React from "react";
import { MessageSquare, Plus, Loader2 } from "lucide-react";

/**
 * ChatRoomList - Display list of chat rooms (now prop-based, no internal fetch)
 * @param {Array} rooms - List of room objects from useRooms hook
 * @param {number} activeRoomId - Currently selected room ID
 * @param {Function} onSelectRoom - Callback when room is clicked
 * @param {boolean} loading - Loading state
 * @param {string} error - Error message if any
 */
const ChatRoomList = ({ rooms = [], activeRoomId, onSelectRoom, loading = false, error = null }) => {
    const handleSelect = (roomId) => {
        if (!onSelectRoom) return;
        onSelectRoom(roomId);
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Rooms
                </h3>
                <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px]
                     bg-slate-900/70 border border-slate-700/70 text-slate-500
                     cursor-not-allowed"
                >
                    <Plus className="w-3 h-3" />
                    New
                </button>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading rooms…
                </div>
            )}

            {error && !loading && (
                <div className="text-xs text-rose-400 py-2">
                    {error}
                </div>
            )}

            {!loading && !error && rooms.length === 0 && (
                <div className="text-xs text-slate-500 py-2">
                    No rooms yet.
                </div>
            )}

            <div className="flex flex-col gap-1">
                {rooms.map((room) => {
                    const isActive = activeRoomId && activeRoomId === room.id;
                    return (
                        <button
                            key={room.id}
                            type="button"
                            onClick={() => handleSelect(room.id)}
                            className={
                                "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all " +
                                (isActive
                                    ? "bg-slate-800 text-slate-50 border border-purple-500/60 shadow-[0_0_0_1px_rgba(168,85,247,0.5)]"
                                    : "bg-slate-900/60 text-slate-300 border border-slate-800 hover:bg-slate-800/80")
                            }
                        >
                            <span className="flex items-center gap-2">
                                <span
                                    className="flex items-center justify-center w-5 h-5 rounded-lg bg-slate-950/80 border border-slate-700"
                                >
                                    <MessageSquare className="w-3 h-3 text-slate-400" />
                                </span>
                                <span className="truncate">{room.name}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase">
                                {room.id}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ChatRoomList;
