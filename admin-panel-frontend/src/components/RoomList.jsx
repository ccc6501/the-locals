// admin-panel-frontend/src/components/RoomList.jsx
// Room list sidebar with unread counts

import React from 'react';
import { Hash, Users, Lock, MessageSquare } from 'lucide-react';

export const RoomList = ({ rooms, currentRoomId, onRoomSelect, unreadCounts = {} }) => {
    const getRoomIcon = (room) => {
        if (room.type === 'dm') return MessageSquare;
        if (room.type === 'group') return Users;
        if (room.type === 'system') return Hash;
        return Hash;
    };

    const getRoomDisplay = (room) => {
        if (room.type === 'system') {
            return room.slug; // e.g., #general, #network
        }
        return room.name;
    };

    return (
        <div className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-slate-700">
                <h2 className="text-white font-semibold text-lg">Rooms</h2>
            </div>

            {/* Room List */}
            <div className="flex-1 overflow-y-auto">
                {rooms.length === 0 ? (
                    <div className="p-4 text-slate-400 text-sm text-center">
                        No rooms available
                    </div>
                ) : (
                    <div className="space-y-1 p-2">
                        {rooms.map((room) => {
                            const Icon = getRoomIcon(room);
                            const isActive = room.id === currentRoomId;
                            const unreadCount = unreadCounts[room.id] || 0;

                            return (
                                <button
                                    key={room.id}
                                    onClick={() => onRoomSelect(room)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive
                                            ? 'bg-violet-600 text-white'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    {/* Room Icon */}
                                    <div
                                        className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${isActive ? 'bg-violet-700' : 'bg-slate-800'
                                            }`}
                                        style={{
                                            backgroundColor: isActive ? undefined : room.color || '#475569'
                                        }}
                                    >
                                        <Icon className="w-4 h-4" />
                                    </div>

                                    {/* Room Name */}
                                    <div className="flex-1 text-left min-w-0">
                                        <div className="font-medium truncate">
                                            {getRoomDisplay(room)}
                                        </div>
                                        {room.type === 'system' && (
                                            <div className="text-xs opacity-70 truncate">
                                                {room.name}
                                            </div>
                                        )}
                                    </div>

                                    {/* Unread Badge */}
                                    {unreadCount > 0 && (
                                        <div className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${isActive
                                                ? 'bg-white text-violet-600'
                                                : 'bg-violet-600 text-white'
                                            }`}>
                                            {unreadCount > 99 ? '99+' : unreadCount}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
