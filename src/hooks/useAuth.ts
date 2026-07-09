import { useState, useEffect, useRef } from 'react';
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
  const initialised = useRef(false);

  useEffect(() => {
    let mounted = true;

    // Read session from localStorage immediately — no network call
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        const appUser = await fetchAppUserById(session.user.id, session.user.email ?? '');
        if (!mounted) return;
        if (appUser) setUser(appUser);
      }
      initialised.current = true;
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // Skip INITIAL_SESSION — handled by getSession() above
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setAuthError(null);
          // Only set loading false if we somehow reach here before initialised
          if (!initialised.current) setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN') {
          const appUser = await fetchAppUserById(session.user.id, session.user.email ?? '');
          if (!mounted) return;
          if (appUser) {
            setAuthError(null);
            setUser(appUser);
          } else {
            setAuthError('Account not configured. Contact your administrator.');
            await supabase.auth.signOut();
            setUser(null);
          }
          // Set loading false only if not yet done
          if (!initialised.current) {
            initialised.current = true;
            setLoading(false);
          }
          return;
        }

        // TOKEN_REFRESHED / USER_UPDATED — silently refresh user, never touch loading
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const appUser = await fetchAppUserById(session.user.id, session.user.email ?? '');
          if (!mounted) return;
          if (appUser) {
            setAuthError(null);
            setUser(appUser);
          }
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
