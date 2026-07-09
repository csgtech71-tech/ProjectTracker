import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import type { AppUser } from '../types';

async function fetchAppUserWithTimeout(userId: string, email: string): Promise<AppUser | null> {
  const profilePromise = authService.getAppUserById(userId, email);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
  return Promise.race([profilePromise, timeout]);
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          setUser(null);
          setAuthError(null);
          setLoading(false);
          return;
        }

        const appUser = await fetchAppUserWithTimeout(session.user.id, session.user.email ?? '');
        if (!mounted) return;

        if (!appUser) {
          if (event === 'SIGNED_IN') {
            setAuthError('Account not configured. Contact your administrator.');
            await supabase.auth.signOut();
            setUser(null);
          } else {
            setUser(null);
          }
        } else {
          setAuthError(null);
          setUser(appUser);
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
