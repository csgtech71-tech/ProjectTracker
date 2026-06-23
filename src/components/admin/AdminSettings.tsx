import React, { useState, useEffect, useRef } from 'react';
import type { GlobalSettings, AppUser, UserRole } from '../../types';
import { authService } from '../../services/authService';
import { supabase } from '../../services/supabaseClient';
import {
  Building, Users, Check, RefreshCw, ImageIcon, Trash2,
  UserPlus, Edit2, X, ShieldCheck, Save, Mail, Info,
} from 'lucide-react';

interface Props {
  settings: GlobalSettings;
  currentUser: AppUser;
  onUpdateSettings: (s: GlobalSettings) => void;
}

type ModalMode = 'add' | 'invite' | 'edit';

interface UserModalState {
  open: boolean;
  mode: ModalMode;
  userId: string;
  username: string;
  email: string;
  role: UserRole;
  phone: string;
  password: string;
  isSelf: boolean;
}

const EMPTY_MODAL: UserModalState = {
  open: false,
  mode: 'add',
  userId: '',
  username: '',
  email: '',
  role: 'user',
  phone: '',
  password: '',
  isSelf: false,
};

export const AdminSettings: React.FC<Props> = ({
  settings, currentUser, onUpdateSettings,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [local, setLocal] = useState<GlobalSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  const [modal, setModal] = useState<UserModalState>(EMPTY_MODAL);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Sync local state when parent settings change (e.g. on first load)
  // but only if we're not in the middle of a save to avoid resetting edits
  const settingsRef = useRef(settings);
  useEffect(() => {
    if (!isSaving) {
      setLocal({ ...settings });
    }
    settingsRef.current = settings;
  }, [settings]);

  // Load users exactly once on mount
  useEffect(() => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    setUserError('');
    authService.listAppUsers()
      .then(setAppUsers)
      .catch((e) => setUserError(e.message || 'Failed to load users.'))
      .finally(() => setLoadingUsers(false));
  }, []); // intentionally empty — run once

  const loadUsers = () => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    setUserError('');
    authService.listAppUsers()
      .then(setAppUsers)
      .catch((e) => setUserError(e.message || 'Failed to load users.'))
      .finally(() => setLoadingUsers(false));
  };

  const handleSaveSettings = async () => {
    if (isSaving) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setIsSaving(true);
    setSaveOk(false);
    try {
      await onUpdateSettings(local);
      setSaveOk(true);
    } catch (e) {
      console.error('Settings save failed:', e);
    } finally {
      setIsSaving(false);
      saveTimerRef.current = setTimeout(() => setSaveOk(false), 1500);
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'sidebarIconBase64' | 'companyLogoBase64'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image too large (max 2MB).'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      if (b64) setLocal((prev) => ({ ...prev, [field]: b64 }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openAdd = () => {
    setModalError('');
    setModal({ ...EMPTY_MODAL, open: true, mode: 'add' });
  };

  const openInvite = () => {
    setModalError('');
    setModal({ ...EMPTY_MODAL, open: true, mode: 'invite' });
  };

  const openEdit = (u: AppUser) => {
    setModalError('');
    setModal({
      open: true,
      mode: 'edit',
      userId: u.id,
      username: u.username,
      email: u.email || '',
      role: u.role,
      phone: u.phone || '',
      password: '',
      isSelf: u.id === currentUser.id,
    });
  };

  const closeModal = () => { setModal(EMPTY_MODAL); setModalError(''); };

  const handleSaveUser = async () => {
    setModalError('');

    if (modal.mode === 'invite') {
      if (!modal.email.trim()) { setModalError('Email is required.'); return; }
      if (!modal.username.trim()) { setModalError('Username is required.'); return; }
      setModalSaving(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: modal.email.trim(),
          password: crypto.randomUUID(),
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: modal.username.trim() },
          },
        });
        if (error) throw new Error(error.message);
        if (!data.user) throw new Error('Invite failed.');
        await authService.createAppUser(data.user.id, modal.username.trim(), modal.role, modal.phone.trim() || undefined);
        setUserSuccess(`Invite sent to ${modal.email}. They'll receive a confirmation email with a link to set their password.`);
        setTimeout(() => setUserSuccess(''), 6000);
        closeModal();
        loadUsers();
      } catch (e) {
        setModalError(e instanceof Error ? e.message : 'Invite failed.');
      } finally {
        setModalSaving(false);
      }
      return;
    }

    if (modal.mode === 'add') {
      if (!modal.username.trim()) { setModalError('Username is required.'); return; }
      if (!modal.email.trim()) { setModalError('Email is required.'); return; }
      if (!modal.password.trim()) { setModalError('Password is required.'); return; }
      setModalSaving(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email: modal.email.trim(),
          password: modal.password,
        });
        if (error) throw new Error(error.message);
        if (!data.user) throw new Error('User creation failed.');
        await authService.createAppUser(data.user.id, modal.username.trim(), modal.role, modal.phone.trim() || undefined);
        setUserSuccess(`User "${modal.username}" created.`);
        setTimeout(() => setUserSuccess(''), 3000);
        closeModal();
        loadUsers();
      } catch (e) {
        setModalError(e instanceof Error ? e.message : 'Save failed.');
      } finally {
        setModalSaving(false);
      }
      return;
    }

    // Edit mode
    if (!modal.username.trim()) { setModalError('Username is required.'); return; }
    setModalSaving(true);
    try {
      await authService.updateAppUser(modal.userId, {
        username: modal.username.trim(),
        role: modal.role,
        phone: modal.phone.trim() || undefined,
      });

      if (modal.isSelf && (modal.email.trim() || modal.password.trim())) {
        const authUpdates: { email?: string; password?: string } = {};
        if (modal.email.trim()) authUpdates.email = modal.email.trim();
        if (modal.password.trim()) authUpdates.password = modal.password;
        await authService.updateOwnAuthCredentials(authUpdates);
      }

      setUserSuccess(`User "${modal.username}" updated.`);
      setTimeout(() => setUserSuccess(''), 3000);
      closeModal();
      loadUsers();
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteUser = async (u: AppUser) => {
    if (u.id === currentUser.id) { alert("You can't delete your own account."); return; }
    if (!confirm(`Remove "${u.username}" from the app? Their Supabase Auth account will remain — delete that in the Supabase dashboard if needed.`)) return;
    try {
      await authService.deleteAppUser(u.id);
      setAppUsers((prev) => prev.filter((x) => x.id !== u.id));
      setUserSuccess(`User "${u.username}" removed.`);
      setTimeout(() => setUserSuccess(''), 3000);
    } catch (e) {
      setUserError(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  const modalTitle = modal.mode === 'invite' ? 'Invite User' : modal.mode === 'add' ? 'Add User' : `Edit — ${modal.username}`;
  const modalSubmitLabel = modal.mode === 'invite' ? 'Send Invite' : modal.mode === 'add' ? 'Create User' : 'Save Changes';

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">System Config</h2>
          <p className="text-sm text-slate-500 font-medium italic">Global settings and operational configuration.</p>
        </div>
        {isAdmin && (
          <button onClick={handleSaveSettings} disabled={isSaving}
            className="px-10 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all shadow-xl flex items-center gap-3 disabled:opacity-50">
            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : saveOk ? <Check size={16} className="text-emerald-400" /> : <Save size={16} />}
            {isSaving ? 'Saving...' : saveOk ? 'Saved!' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">

          {/* Branding */}
          {isAdmin && (
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-10">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <Building size={20} className="text-brand" />
                <h4 className="text-xl font-black uppercase tracking-tighter text-slate-900">Corporate Identity</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {[
                    { label: 'Platform Title', field: 'sidebarTitle' as const, placeholder: 'Project Tracker' },
                    { label: 'Company Name', field: 'companyName' as const, placeholder: 'MedixSafe' },
                    { label: 'Support Email', field: 'supportEmail' as const, placeholder: 'support@company.com' },
                    { label: 'Address', field: 'address' as const, placeholder: '123 Main St' },
                  ].map(({ label, field, placeholder }) => (
                    <div key={field} className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
                      <input
                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-brand transition-all"
                        placeholder={placeholder}
                        value={(local[field] as string) ?? ''}
                        onChange={(e) => setLocal((p) => ({ ...p, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-6">
                  {(['sidebarIconBase64', 'companyLogoBase64'] as const).map((field) => (
                    <div key={field} className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        {field === 'sidebarIconBase64' ? 'Sidebar Icon' : 'Company Logo'}
                      </label>
                      <div className="flex items-center gap-4 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl hover:border-brand transition-all">
                        <div className="w-16 h-16 bg-white rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          {local[field] ? <img src={local[field]} alt="Preview" className="max-h-full max-w-full object-contain p-1" /> : <ImageIcon className="text-slate-200" size={24} />}
                        </div>
                        <input type="file" accept="image/*" className="hidden" id={`upload-${field}`} onChange={(e) => handleFileUpload(e, field)} />
                        <label htmlFor={`upload-${field}`} className="px-4 py-2 bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-brand transition-all">Upload</label>
                        {local[field] && (
                          <button onClick={() => setLocal((p) => ({ ...p, [field]: undefined }))} className="text-slate-300 hover:text-red-400 transition-colors"><X size={16} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* User Management */}
          {isAdmin && (
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-brand" />
                  <h4 className="text-xl font-black uppercase tracking-tighter text-slate-900">User Management</h4>
                </div>
                <div className="flex gap-2">
                  <button onClick={openInvite} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                    <Mail size={14} /> Invite
                  </button>
                  <button onClick={openAdd} className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all">
                    <UserPlus size={14} /> Add User
                  </button>
                </div>
              </div>

              {userError && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-bold">{userError}</div>}
              {userSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-bold flex items-start gap-2">
                  <Check size={14} className="shrink-0 mt-0.5" /> {userSuccess}
                </div>
              )}

              {loadingUsers ? (
                <div className="flex justify-center py-10"><RefreshCw size={24} className="animate-spin text-slate-300" /></div>
              ) : (
                <div className="space-y-3">
                  {appUsers.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                      <p className="text-sm text-slate-400 italic">No users found.</p>
                    </div>
                  ) : appUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl group hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-brand/10 rounded-xl flex items-center justify-center font-black text-brand text-lg">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 text-sm">{u.username}</p>
                            {u.id === currentUser.id && (
                              <span className="text-[8px] font-black bg-brand/10 text-brand px-2 py-0.5 rounded uppercase tracking-widest">You</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold">{u.email || 'No email on record'}</p>
                          {u.phone && <p className="text-[10px] text-slate-400">{u.phone}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-brand/10 text-brand' : 'bg-slate-200 text-slate-600'}`}>
                          {u.role}
                        </span>
                        <button onClick={() => openEdit(u)} className="p-2 text-slate-300 hover:text-brand hover:bg-brand/10 rounded-lg transition-all" title="Edit user">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => handleDeleteUser(u)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Remove user">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile sidebar */}
        <div className="lg:col-span-4">
          <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl space-y-6 sticky top-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center font-black text-xl">
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-black text-white text-sm uppercase tracking-tight">{currentUser.username}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentUser.role}</p>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 space-y-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <div className="flex justify-between">
                <span>Session</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Active
                </span>
              </div>
              <div className="flex justify-between">
                <span>Auth</span>
                <span className="text-white">Supabase JWT</span>
              </div>
              <div className="flex justify-between">
                <span>Email</span>
                <span className="text-white truncate ml-4">{currentUser.email || '—'}</span>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6">
              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                <ShieldCheck size={14} /> Secured by Supabase Auth
              </div>
              <p className="text-[9px] text-slate-600 mt-2">
                Sessions use rotating JWT tokens. Passwords are never stored in this application.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{modalTitle}</h3>
                {modal.mode === 'invite' && (
                  <p className="text-[10px] text-slate-400 mt-0.5">They'll receive an email with a link to set their password.</p>
                )}
              </div>
              <button onClick={closeModal} className="text-slate-400 hover:text-black transition-colors"><X size={22} /></button>
            </div>

            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-bold">{modalError}</div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all"
                  placeholder="john.smith"
                  value={modal.username}
                  onChange={(e) => setModal((m) => ({ ...m, username: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                {modal.mode === 'edit' && !modal.isSelf ? (
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 rounded-xl">
                    <span className="text-sm font-bold text-slate-500">{modal.email || '—'}</span>
                    <div className="ml-auto flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase">
                      <Info size={11} /> Own account only
                    </div>
                  </div>
                ) : (
                  <input
                    type="email"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all"
                    placeholder="john@company.com"
                    value={modal.email}
                    onChange={(e) => setModal((m) => ({ ...m, email: e.target.value }))}
                  />
                )}
              </div>

              {(modal.mode === 'add' || (modal.mode === 'edit' && modal.isSelf)) && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {modal.mode === 'edit' ? 'New Password' : 'Password'}
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all"
                    placeholder={modal.mode === 'edit' ? 'Leave blank to keep current' : 'Min 6 characters'}
                    value={modal.password}
                    onChange={(e) => setModal((m) => ({ ...m, password: e.target.value }))}
                  />
                </div>
              )}

              {modal.mode === 'edit' && !modal.isSelf && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 font-bold">
                    Passwords for other users must be reset via Supabase Dashboard → Authentication → Users.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone (optional)</label>
                <input
                  type="tel"
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all"
                  placeholder="555-0199"
                  value={modal.phone}
                  onChange={(e) => setModal((m) => ({ ...m, phone: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['user', 'admin'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => setModal((m) => ({ ...m, role: r }))}
                      className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest border-2 transition-all ${
                        modal.role === r ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {modal.mode === 'invite' && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                  A confirmation email will be sent. Once they click the link they'll have immediate access.
                </div>
              )}
            </div>

            <div className="px-8 py-5 bg-slate-50 border-t flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button
                onClick={handleSaveUser}
                disabled={modalSaving}
                className={`px-8 py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 ${
                  modal.mode === 'invite' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-black hover:bg-brand'
                }`}
              >
                {modalSaving ? <RefreshCw size={14} className="animate-spin" /> : modal.mode === 'invite' ? <Mail size={14} /> : <Check size={14} />}
                {modalSaving ? 'Saving...' : modalSubmitLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
