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

    return {
        rooms,
        activeRoomId,
        setActiveRoomId,
        refreshRooms: loadRooms,
        loading,
    };
}

export default useRooms;
