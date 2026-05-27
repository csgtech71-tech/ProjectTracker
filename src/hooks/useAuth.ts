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

    // Check existing session immediately — don't wait for onAuthStateChange
    // INITIAL_SESSION which can lag during token refresh and cause spinning
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        setLoading(false);
        return;
      }
      const appUser = await fetchAppUser();
      if (!mounted) return;
      if (appUser) {
        setUser(appUser);
      } else {
        setAuthError('Account not configured. Contact your administrator.');
        await supabase.auth.signOut();
      }
      setLoading(false);
    });

    // Subscribe to ongoing auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Skip — handled above by getSession()
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
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
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, authError, isAdmin: user?.role === 'admin' };
}

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, authError, isAdmin: user?.role === 'admin' };
}
