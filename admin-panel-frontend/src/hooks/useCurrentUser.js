import { useState, useEffect } from 'react';

/**
 * Hook to fetch and manage the current user
 * Fetches from /api/users/me
 */
export function useCurrentUser() {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;

        async function fetchCurrentUser() {
            try {
                setLoading(true);
                const res = await fetch('/api/users/me');

                if (!res.ok) {
                    const errorText = await res.text();
                    console.error('Failed to fetch current user:', res.status, errorText);
                    throw new Error(`Failed to fetch current user: ${res.status}`);
                }

                const data = await res.json();

                if (mounted) {
                    setCurrentUser(data);
                    setError(null);
                }
            } catch (err) {
                console.error('useCurrentUser error:', err);
                if (mounted) {
                    setError(err.message);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        fetchCurrentUser();

        return () => {
            mounted = false;
        };
    }, []);

    return { currentUser, loading, error };
}
