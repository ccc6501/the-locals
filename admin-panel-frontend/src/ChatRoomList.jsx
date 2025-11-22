// admin-panel-frontend/src/ChatRoomList.jsx
import React, { useEffect, useState } from "react";
import { MessageSquare, Plus, Loader2 } from "lucide-react";

// Auto-detect API base URL - use same host as frontend for remote access
const getApiBase = () => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return `http://${hostname}:8000`;
    }
    return "http://localhost:8000";
};

const API_BASE = getApiBase();

const ChatRoomList = ({ currentRoom, onSelectRoom }) => {
    const [rooms, setRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const loadRooms = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`${API_BASE}/chat/rooms`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled) return;
                setRooms(data);
                setError(null);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to load rooms", err);
                setError("Could not load rooms");
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadRooms();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSelect = (room) => {
        if (!onSelectRoom) return;
        onSelectRoom(room);
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

            {isLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading rooms…
                </div>
            )}

            {error && !isLoading && (
                <div className="text-xs text-rose-400 py-2">
                    {error}
                </div>
            )}

            {!isLoading && !error && rooms.length === 0 && (
                <div className="text-xs text-slate-500 py-2">
                    No rooms yet.
                </div>
            )}

            <div className="flex flex-col gap-1">
                {rooms.map((room) => {
                    const isActive = currentRoom && currentRoom.id === room.id;
                    return (
                        <button
                            key={room.id}
                            type="button"
                            onClick={() => handleSelect(room)}
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
