import { supabase } from './supabaseClient';
import type { AppUser, UserRole } from '../types';
import type { Session, User } from '@supabase/supabase-js';

export const authService = {
  async signIn(email: string, password: string): Promise<{ user: User; session: Session }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user || !data.session) throw new Error('Authentication failed.');
    return { user: data.user, session: data.session };
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async getSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },

  async getAppUser(): Promise<AppUser | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('app_users')
      .select('id, username, role, phone')
      .eq('id', user.id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      email: user.email ?? '',
      username: data.username,
      role: data.role as UserRole,
      phone: data.phone,
    };
  },

  onAuthStateChange(callback: (user: AppUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        callback(null);
        return;
      }
      const appUser = await authService.getAppUser();
      callback(appUser);
    });
  },

  // Admin: create a new app user record after Supabase Auth user is created
  async createAppUser(
    authUserId: string,
    username: string,
    role: UserRole,
    phone?: string
  ): Promise<void> {
    const { error } = await supabase.from('app_users').insert({
      id: authUserId,
      username,
      role,
      phone,
    });
    if (error) throw new Error(error.message);
  },

  async updateAppUser(
    userId: string,
    updates: Partial<Pick<AppUser, 'username' | 'role' | 'phone'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', userId);
    if (error) throw new Error(error.message);
  },

  async listAppUsers(): Promise<AppUser[]> {
    const { data, error } = await supabase
      .from('app_users')
      .select('id, username, role, phone');
    if (error) throw new Error(error.message);

    // We need emails from auth — use the admin API if available, otherwise omit
    return (data ?? []).map((u) => ({
      id: u.id,
      email: '',
      username: u.username,
      role: u.role as UserRole,
      phone: u.phone,
    }));
  },

  async deleteAppUser(userId: string): Promise<void> {
    const { error } = await supabase.from('app_users').delete().eq('id', userId);
    if (error) throw new Error(error.message);
  },
};
