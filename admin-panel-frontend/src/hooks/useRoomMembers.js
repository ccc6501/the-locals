import { useState, useEffect } from 'react';

/**
 * Hook to fetch members for a specific room
 * @param {number} roomId - The room ID to fetch members for
 */
export function useRoomMembers(roomId) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!roomId) {
            setMembers([]);
            setLoading(false);
            return;
        }

        let mounted = true;

        async function fetchMembers() {
            try {
                setLoading(true);
                const res = await fetch(`/api/rooms/${roomId}/members`);

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error(`Failed to fetch members for room ${roomId}:`, res.status, errorText);
                    throw new Error(`Failed to fetch members: ${res.status}`);
                }

                const data = await res.json();

                if (mounted) {
                    setMembers(data);
                    setError(null);
                }
            } catch (err) {
                console.error('useRoomMembers error:', err);
                if (mounted) {
                    setError(err.message);
                    setMembers([]);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchMembers();

        return () => {
            mounted = false;
        };
    }, [roomId]);

    return { members, loading, error };
}
