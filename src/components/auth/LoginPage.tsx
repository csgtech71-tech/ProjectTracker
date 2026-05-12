import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import type { GlobalSettings } from '../../types';

interface Props {
  globalSettings: GlobalSettings;
}

export const LoginPage: React.FC<Props> = ({ globalSettings }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    setError('');
    try {
      await authService.signIn(email, password);
      // useAuth hook will pick up the new session automatically
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Check your credentials.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-96 h-96 bg-brand rounded-full blur-[150px] opacity-10 -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-slate-800 rounded-full blur-[150px] opacity-10 -ml-48 -mb-48" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10">
          <div className="p-10 bg-slate-50 border-b border-slate-100 text-center space-y-4">
            <div className="w-20 h-20 bg-black rounded-3xl mx-auto flex items-center justify-center text-white shadow-xl mb-4 overflow-hidden">
              {globalSettings.sidebarIconBase64 ? (
                <img
                  src={globalSettings.sidebarIconBase64}
                  alt="Logo"
                  className="w-full h-full object-contain p-3"
                />
              ) : (
                <ShieldCheck size={40} className="text-brand" />
              )}
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">
              {globalSettings.sidebarTitle || 'MedixSafe OPS'}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              Hardware Project Operations Center
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-10 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3 text-red-600 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-4">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  size={18}
                />
                <input
                  autoFocus
                  type="email"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-brand outline-none transition-all"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  size={18}
                />
                <input
                  type="password"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-brand outline-none transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-5 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-brand transition-all flex items-center justify-center gap-2 group shadow-xl shadow-black/10 disabled:opacity-30 disabled:hover:bg-black"
            >
              {isLoading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <>
                  Access Terminal{' '}
                  <ArrowRight
                    size={16}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-8">
          Account access is managed by your administrator
        </p>
      </div>
    </div>
  );
};
