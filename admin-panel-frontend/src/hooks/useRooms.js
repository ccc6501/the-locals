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
            setRooms(data || []);

            // Set default active room to first room if not already set
            if (!activeRoomId && data && data.length > 0) {
                setActiveRoomId(data[0].id);
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

            // Add to rooms list if not already present
            setRooms((prev) => {
                const existing = prev.find((r) => r.id === room.id);
                if (existing) return prev;
                return [room, ...prev]; // Add new room at top
            });

            // Switch to the new room
            setActiveRoomId(room.id);

            return room;
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
