import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import type { AppUser } from '../types';

async function fetchAppUserById(userId: string, email: string): Promise<AppUser | null> {
  try {
    return await authService.getAppUserById(userId, email);
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

    // Step 1: Check session immediately from localStorage — zero network calls.
    // This resolves loading fast so the UI shows login or app right away.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session) {
        setLoading(false);
        return;
      }
      // Session exists — fetch profile
      const appUser = await fetchAppUserById(session.user.id, session.user.email ?? '');
      if (!mounted) return;
      if (appUser) {
        setUser(appUser);
      }
      setLoading(false);
    });

    // Step 2: Subscribe to ongoing changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // INITIAL_SESSION is handled above by getSession() — skip to avoid double fetch
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const appUser = await fetchAppUserById(session.user.id, session.user.email ?? '');
          if (!mounted) return;
          if (appUser) {
            setAuthError(null);
            setUser(appUser);
          } else if (event === 'SIGNED_IN') {
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, authError, isAdmin: user?.role === 'admin', signOut };
}
