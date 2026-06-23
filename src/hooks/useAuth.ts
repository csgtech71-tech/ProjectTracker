import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import type { AppUser } from '../types';

async function fetchAppUser(): Promise<AppUser | null> {
  try {
    return await authService.getAppUser();
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange is the single source of truth.
    // INITIAL_SESSION fires on mount with the existing session (or null),
    // so we no longer need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
          return;
        }

        // Handles INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED
        const appUser = await fetchAppUser();
        if (!mounted) return;
        if (appUser) {
          setAuthError(null);
          setUser(appUser);
        } else {
          setAuthError('Account not configured. Contact your administrator.');
          await supabase.auth.signOut();
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, authError, isAdmin: user?.role === 'admin' };
}
