import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import type { AppUser } from '../types';

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          setUser(null);
          setLoading(false);
          return;
        }

        const appUser = await authService.getAppUser();

        if (!appUser) {
          setAuthError(
            'Account not configured. Ask your administrator to add your UUID to the app_users table.'
          );
          await supabase.auth.signOut();
          setUser(null);
        } else {
          setAuthError(null);
          setUser(appUser);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, authError, isAdmin: user?.role === 'admin' };
}
