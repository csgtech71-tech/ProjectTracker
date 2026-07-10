import { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { authService } from '../services/authService';
import type { AppUser } from '../types';

const CACHE_KEY = 'medixsafe_user_cache';

function getCachedUser(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setCachedUser(u: AppUser | null) {
  try {
    if (u) sessionStorage.setItem(CACHE_KEY, JSON.stringify(u));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

async function fetchAppUserById(userId: string, email: string): Promise<AppUser | null> {
  try {
    return await authService.getAppUserById(userId, email);
  } catch { return null; }
}

export function useAuth() {
  // Initialise from cache immediately — zero network calls, zero flash
  const [user, setUser] = useState<AppUser | null>(getCachedUser);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initialised = useRef(false);

  const setUserAndCache = (u: AppUser | null) => {
    setCachedUser(u);
    setUser(u);
  };

  useEffect(() => {
    let mounted = true;

    // Verify the cached session is still valid — reads from localStorage, no network
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (!session) {
        // No session — clear cache and show login
        setUserAndCache(null);
        initialised.current = true;
        setLoading(false);
        return;
      }

      // Session exists — check if cached user matches
      const cached = getCachedUser();
      if (cached && cached.id === session.user.id) {
        // Cache hit — already set in useState initialiser, just mark done
        initialised.current = true;
        setLoading(false);
        // Refresh profile in background without blocking UI
        fetchAppUserById(session.user.id, session.user.email ?? '').then(fresh => {
          if (mounted && fresh) setUserAndCache(fresh);
        });
        return;
      }

      // Cache miss — fetch profile (new session or different user)
      const appUser = await fetchAppUserById(session.user.id, session.user.email ?? '');
      if (!mounted) return;
      setUserAndCache(appUser);
      initialised.current = true;
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT' || !session) {
          setUserAndCache(null);
          setAuthError(null);
          if (!initialised.current) { initialised.current = true; setLoading(false); }
          return;
        }

        if (event === 'SIGNED_IN') {
          const appUser = await fetchAppUserById(session.user.id, session.user.email ?? '');
          if (!mounted) return;
          if (appUser) { setAuthError(null); setUserAndCache(appUser); }
          else {
            setAuthError('Account not configured. Contact your administrator.');
            await supabase.auth.signOut();
            setUserAndCache(null);
          }
          if (!initialised.current) { initialised.current = true; setLoading(false); }
          return;
        }

        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          fetchAppUserById(session.user.id, session.user.email ?? '').then(appUser => {
            if (mounted && appUser) setUserAndCache(appUser);
          });
        }
      }
    );

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    setUserAndCache(null);
    await supabase.auth.signOut();
  };

  return { user, loading, authError, isAdmin: user?.role === 'admin', signOut };
}
