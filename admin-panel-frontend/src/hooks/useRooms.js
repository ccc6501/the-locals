// admin-panel-frontend/src/hooks/useRooms.js
import { useState, useEffect } from 'react';

/**
 * Custom hook for managing persistent chat rooms from /api/rooms
 * Returns rooms list, active room state, and refresh function
 */
export const useRooms = (apiBase) => {
    const [rooms, setRooms] = useState([]);
    const [activeRoomId, setActiveRoomId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadRooms = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${apiBase}/api/rooms`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setRooms(data);
            
            // Set default active room to first room if not already set
            if (!activeRoomId && data.length > 0) {
                setActiveRoomId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to load rooms:', err);
            setError('Could not load rooms');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!apiBase) return;
        loadRooms();
    }, [apiBase]);

    return {
        rooms,
        activeRoomId,
        setActiveRoomId,
        loading,
        error,
        refreshRooms: loadRooms,
    };
};

export default useRooms;
