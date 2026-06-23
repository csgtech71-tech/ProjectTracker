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
    // Track in-flight fetchAppUser calls so concurrent events don't race
    let inflightRequest = 0;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // No session — clear user and stop loading
        if (!session) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
          return;
        }

        // Has session — fetch the app user profile
        // Use a counter to discard stale concurrent fetches
        const thisRequest = ++inflightRequest;
        const appUser = await fetchAppUser();

        if (!mounted || thisRequest !== inflightRequest) return;

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

  // Wrap signOut so the button can just call it safely
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
      // Force local state clear even if supabase call fails
      setUser(null);
      setAuthError(null);
      setLoading(false);
    }
  };

  return { user, loading, authError, isAdmin: user?.role === 'admin', signOut };
}
