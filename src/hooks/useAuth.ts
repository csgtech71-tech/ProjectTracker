import { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import type { AppUser } from '../types';

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    authService.getAppUser().then((u) => {
      setUser(u);
      setLoading(false);
    });

    // Subscribe to auth state changes
    const { data: subscription } = authService.onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
    });

    return () => {
      subscription?.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, isAdmin: user?.role === 'admin' };
}
