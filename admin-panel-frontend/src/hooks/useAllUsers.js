import { useState, useEffect } from 'react';

/**
 * Hook to fetch all users from the system.
 * Used for adding people to rooms.
 */
export function useAllUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/users');
      
      if (!res.ok) {
        const text = await res.text();
        console.error('Failed to fetch users:', res.status, text);
        throw new Error(`Failed to fetch users: ${res.status}`);
      }
      
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
  };
}
