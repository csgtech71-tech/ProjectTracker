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
      async (event, session) => {
        // Token refresh failed or user signed out — clear immediately, don't hang
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
          return;
        }

        // No session at all
        if (!session) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Valid session — fetch app profile
        try {
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
        } catch (e) {
          // getAppUser failed (network issue, etc) — don't hang, show error
          setAuthError(e instanceof Error ? e.message : 'Failed to load user profile.');
          setUser(null);
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, authError, isAdmin: user?.role === 'admin' };
}
