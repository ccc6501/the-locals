// admin-panel-frontend/src/hooks/useRooms.js
import { useState, useEffect } from 'react';

/**
 * Custom hook for managing persistent chat rooms from /api/rooms
 * Returns rooms list, active room state, and refresh function
 */
export function useRooms() {
    const [rooms, setRooms] = useState([]);
    const [activeRoomId, setActiveRoomId] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadRooms = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/rooms');
            if (!res.ok) {
                console.error('Failed to load rooms', res.status);
                return;
            }
            const data = await res.json();

            // Fetch member counts for each room
            const roomsWithMembers = await Promise.all(
                (data || []).map(async (room) => {
                    try {
                        const membersRes = await fetch(`/api/rooms/${room.id}/members`);
                        if (membersRes.ok) {
                            const members = await membersRes.json();
                            return { ...room, memberCount: members.length };
                        }
                    } catch (err) {
                        console.error(`Failed to fetch members for room ${room.id}:`, err);
                    }
                    return { ...room, memberCount: 0 };
                })
            );

            setRooms(roomsWithMembers);

            // Set default active room to first room if not already set
            if (!activeRoomId && roomsWithMembers && roomsWithMembers.length > 0) {
                setActiveRoomId(roomsWithMembers[0].id);
            }
        } catch (err) {
            console.error('Failed to load rooms:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRooms();
    }, []);

    const createRoom = async (name, type = 'room') => {
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('createRoom failed:', res.status, errorText);
                throw new Error(`Failed to create room (${res.status}): ${errorText}`);
            }

            const room = await res.json();

            // Fetch member count for the new room
            let roomWithMembers = { ...room, memberCount: 1 }; // Default to 1 (the creator)
            try {
                const membersRes = await fetch(`/api/rooms/${room.id}/members`);
                if (membersRes.ok) {
                    const members = await membersRes.json();
                    roomWithMembers.memberCount = members.length;
                }
            } catch (err) {
                console.error('Failed to fetch members for new room:', err);
            }

            // Add to rooms list if not already present
            setRooms((prev) => {
                const existing = prev.find((r) => r.id === roomWithMembers.id);
                if (existing) return prev;
                return [roomWithMembers, ...prev]; // Add new room at top
            });

            // Switch to the new room
            setActiveRoomId(roomWithMembers.id);

            return roomWithMembers;
        } catch (err) {
            console.error('Failed to create room:', err);
            throw err;
        }
    };

    return {
        rooms,
        activeRoomId,
        setActiveRoomId,
        refreshRooms: loadRooms,
        createRoom,
        loading,
    };
}

export default useRooms;
