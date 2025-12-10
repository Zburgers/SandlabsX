import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, fetchUserProfile, User } from '../lib/auth';

// Custom hook for authentication state
export function useAuth(): {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  logout: () => void;
} {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      setLoading(true);
      setError(null);

      if (isAuthenticated()) {
        try {
          const result = await fetchUserProfile();
          if (result.success && result.user) {
            setUser(result.user);
          } else {
            // Token might be invalid/expired
            setUser(null);
            setError(result.error || 'Authentication failed');
          }
        } catch (err) {
          setUser(null);
          setError(err instanceof Error ? err.message : 'Authentication error');
        }
      } else {
        // Not authenticated
        setUser(null);
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const logout = () => {
    // Clear authentication data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    setUser(null);
    router.push('/auth');
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    logout
  };
}