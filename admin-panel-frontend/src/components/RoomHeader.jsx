// admin-panel-frontend/src/components/RoomHeader.jsx
// Room header with AI assistant info

import React from 'react';
import { Hash, Users, MessageSquare, Bot } from 'lucide-react';

export const RoomHeader = ({ room, aiConfig = {} }) => {
    if (!room) return null;

    const getRoomIcon = (room) => {
        if (room.type === 'dm') return MessageSquare;
        if (room.type === 'group') return Users;
        if (room.type === 'system') return Hash;
        return Hash;
    };

    const Icon = getRoomIcon(room);
    const assistantName = aiConfig.assistant_name || 'The Local';
    const assistantInitials = aiConfig.assistant_initials || 'TL';

    return (
        <div className="bg-slate-900 border-b border-slate-700 px-4 py-3">
            <div className="flex items-center justify-between">
                {/* Room Info */}
                <div className="flex items-center gap-3">
                    {/* Room Icon */}
                    <div
                        className="w-10 h-10 rounded flex items-center justify-center text-white"
                        style={{ backgroundColor: room.color || '#6B7280' }}
                    >
                        <Icon className="w-5 h-5" />
                    </div>

                    {/* Room Name & Description */}
                    <div>
                        <h1 className="text-white font-semibold text-lg">
                            {room.type === 'system' ? room.slug : room.name}
                        </h1>
                        {room.type === 'system' && (
                            <p className="text-slate-400 text-sm">{room.name}</p>
                        )}
                    </div>
                </div>

                {/* AI Assistant Badge */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 border border-violet-500/30 rounded-full">
                    <Bot className="w-4 h-4 text-violet-400" />
                    <span className="text-violet-300 text-sm font-medium">{assistantName}</span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-sky-500 flex items-center justify-center text-white text-xs font-bold">
                        {assistantInitials}
                    </div>
                </div>
            </div>
        </div>
    );
};
