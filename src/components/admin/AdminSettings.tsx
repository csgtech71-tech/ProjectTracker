import React, { useState, useEffect } from 'react';
import type { GlobalSettings, AppUser } from '../../types';
import { authService } from '../../services/authService';
import {
  Building, Users, Check, RefreshCw, ImageIcon, Database,
  Cloud, Mail, Phone, MapPin, Trash2, UserPlus, Edit2, X, ShieldCheck,
  Copy, CheckCircle2
} from 'lucide-react';

interface Props {
  settings: GlobalSettings;
  currentUser: AppUser;
  onUpdateSettings: (s: GlobalSettings) => void;
}

const SQL_SCHEMA = `-- Run this in your NEW Supabase project SQL editor

create extension if not exists "uuid-ossp";

create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role text not null default 'user' check (role in ('admin','user')),
  phone text,
  created_at timestamptz default now()
);
alter table app_users enable row level security;
create policy "users_own" on app_users for select using (auth.uid() = id);
create policy "admins_all" on app_users for all using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);

create table global_settings (
  id text primary key default 'singleton',
  sidebar_title text default 'Project Tracker',
  company_name text, address text, phone text,
  support_email text, sales_email text,
  sidebar_icon_base64 text, company_logo_base64 text,
  updated_at timestamptz default now()
);
alter table global_settings enable row level security;
create policy "read_settings" on global_settings for select using (auth.uid() is not null);
create policy "admin_write_settings" on global_settings for all using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);
insert into global_settings (id) values ('singleton') on conflict do nothing;

create table projects (
  id uuid primary key default uuid_generate_v4(),
  title text not null, customer_name text not null,
  project_overview text, deployment_type text,
  start_date date, end_date date, revision integer default 1,
  is_closed boolean default false, is_archived boolean default false,
  is_extended boolean default false, extension_reason text,
  extended_end_date date, customer_sentiment text,
  sow_cost numeric, costing_currency text default 'USD',
  logo_base64 text, ai_analysis_summary text,
  data jsonb default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table projects enable row level security;
create policy "auth_projects" on projects for all using (auth.uid() is not null);

create table hardware_nodes (
  id text primary key, project_id uuid references projects(id) on delete cascade,
  friendly_name text, serial_number text, mac_address text,
  location_id text, install_date date, status text default 'active',
  auth_type text, firmware text, ip_address text, wifi_ssid text,
  notes text, last_seen timestamptz, cert_expires timestamptz,
  created_at timestamptz default now()
);
alter table hardware_nodes enable row level security;
create policy "auth_nodes" on hardware_nodes for all using (auth.uid() is not null);

create table log_imports (
  id uuid primary key default uuid_generate_v4(),
  device_id text references hardware_nodes(id),
  project_id uuid references projects(id),
  filename text, imported_by uuid references auth.users(id),
  line_count integer, event_count integer,
  imported_at timestamptz default now()
);
alter table log_imports enable row level security;
create policy "auth_imports" on log_imports for all using (auth.uid() is not null);

create table access_events (
  id uuid primary key default uuid_generate_v4(),
  import_id uuid references log_imports(id) on delete cascade,
  device_id text references hardware_nodes(id),
  project_id uuid references projects(id),
  occurred_at timestamptz not null,
  auth_type text, result text, failure_reason text,
  user_id_raw text, card_bits integer, door_id integer,
  door_open_at timestamptz, door_close_at timestamptz, door_open_ms integer,
  created_at timestamptz default now()
);
create index ae_device on access_events(device_id);
create index ae_project on access_events(project_id);
create index ae_occurred on access_events(occurred_at);
alter table access_events enable row level security;
create policy "auth_ae" on access_events for all using (auth.uid() is not null);

create table system_events (
  id uuid primary key default uuid_generate_v4(),
  import_id uuid references log_imports(id) on delete cascade,
  device_id text references hardware_nodes(id),
  project_id uuid references projects(id),
  occurred_at timestamptz not null,
  event_type text not null, module text, details text, raw_line text,
  created_at timestamptz default now()
);
create index se_device on system_events(device_id);
create index se_occurred on system_events(occurred_at);
alter table system_events enable row level security;
create policy "auth_se" on system_events for all using (auth.uid() is not null);

create table analytics_display_settings (
  id text primary key default 'singleton',
  show_access_timeline boolean default true,
  show_auth_method_breakdown boolean default true,
  show_failed_attempts boolean default true,
  show_door_open_duration boolean default true,
  show_user_activity boolean default true,
  show_mqtt_events boolean default false,
  show_reboots boolean default false,
  show_health_checks boolean default false,
  show_firmware_info boolean default false,
  show_wifi_signal boolean default false,
  show_ip_address boolean default false,
  show_cert_expiry boolean default false,
  show_config_changes boolean default false,
  updated_at timestamptz default now()
);
alter table analytics_display_settings enable row level security;
create policy "read_ads" on analytics_display_settings for select using (auth.uid() is not null);
create policy "admin_ads" on analytics_display_settings for all using (
  exists (select 1 from app_users where id = auth.uid() and role = 'admin')
);
insert into analytics_display_settings (id) values ('singleton') on conflict do nothing;`;

export const AdminSettings: React.FC<Props> = ({
  settings, currentUser, onUpdateSettings,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [local, setLocal] = useState<GlobalSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    setLocal({ ...settings });
  }, [settings]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    authService.listAppUsers().then(setAppUsers).finally(() => setLoadingUsers(false));
  }, [isAdmin]);

  const handleSave = async () => {
    setIsSaving(true);
    await onUpdateSettings(local);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'sidebarIconBase64' | 'companyLogoBase64'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image too large (max 2MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      if (b64) setLocal((prev) => ({ ...prev, [field]: b64 }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      alert("You can't delete your own account.");
      return;
    }
    if (!confirm('Remove this user from the app? Their Supabase Auth account will remain — delete that in the Supabase dashboard if needed.')) return;
    await authService.deleteAppUser(userId);
    setAppUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">
            System Config
          </h2>
          <p className="text-sm text-slate-500 font-medium italic">
            Global settings and operational configuration.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-10 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all shadow-xl flex items-center gap-3 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">

          {/* Database setup */}
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <Database size={20} className="text-brand" />
              <h4 className="text-xl font-black uppercase tracking-tighter text-slate-900">
                Database Setup SQL
              </h4>
            </div>
            <p className="text-sm text-slate-500">
              Run this SQL in your Supabase project's SQL editor to create all required tables
              with Row Level Security.
            </p>
            <div className="relative">
              <pre className="bg-slate-950 text-emerald-400 p-6 rounded-[2rem] text-[8px] font-mono leading-relaxed overflow-y-auto max-h-64 border border-white/5">
                {SQL_SCHEMA}
              </pre>
              <button
                onClick={handleCopySQL}
                className="absolute top-4 right-4 flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-700 font-medium">
              <strong>First user setup:</strong> Create your admin account in Supabase Dashboard →
              Authentication → Users → Add User. Then run:
              <code className="block mt-2 bg-amber-100 px-3 py-2 rounded-lg font-mono text-[10px]">
                {"insert into app_users (id, username, role) values ('<your-auth-uid>', 'admin', 'admin');"}
              </code>
            </div>
          </div>

          {/* Branding */}
          {isAdmin && (
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-10">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <Building size={20} className="text-brand" />
                <h4 className="text-xl font-black uppercase tracking-tighter text-slate-900">
                  Corporate Identity
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Platform Title
                    </label>
                    <input
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-brand transition-all"
                      value={local.sidebarTitle}
                      onChange={(e) =>
                        setLocal((p) => ({ ...p, sidebarTitle: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Company Name
                    </label>
                    <input
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-brand transition-all"
                      value={local.companyName ?? ''}
                      onChange={(e) =>
                        setLocal((p) => ({ ...p, companyName: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Support Email
                    </label>
                    <input
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-brand transition-all"
                      value={local.supportEmail ?? ''}
                      onChange={(e) =>
                        setLocal((p) => ({ ...p, supportEmail: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Address
                    </label>
                    <input
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-brand transition-all"
                      value={local.address ?? ''}
                      onChange={(e) =>
                        setLocal((p) => ({ ...p, address: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {(['sidebarIconBase64', 'companyLogoBase64'] as const).map((field) => (
                  <div key={field} className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      {field === 'sidebarIconBase64' ? 'Sidebar Icon' : 'Company Logo'}
                    </label>
                    <div className="flex flex-col items-center gap-4 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] hover:border-brand transition-all">
                      <div className="w-20 h-20 bg-white rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden">
                        {local[field] ? (
                          <img
                            src={local[field]}
                            alt="Preview"
                            className="max-h-full max-w-full object-contain p-2"
                          />
                        ) : (
                          <ImageIcon className="text-slate-200" size={32} />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id={`upload-${field}`}
                        onChange={(e) => handleFileUpload(e, field)}
                      />
                      <label
                        htmlFor={`upload-${field}`}
                        className="px-6 py-2 bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer hover:bg-brand transition-all"
                      >
                        Upload
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Management */}
          {isAdmin && (
            <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-brand" />
                  <h4 className="text-xl font-black uppercase tracking-tighter text-slate-900">
                    User Management
                  </h4>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-700">
                <strong>Adding users:</strong> Create their account in Supabase Dashboard →
                Authentication → Users → Invite User. Then insert a row into{' '}
                <code className="bg-blue-100 px-1 rounded">app_users</code> with their auth UUID
                and desired role.
              </div>

              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <RefreshCw size={20} className="animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-3">
                  {appUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-brand/10 rounded-xl flex items-center justify-center font-black text-brand">
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-sm">{u.username}</p>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">
                            {u.role}
                            {u.id === currentUser.id && ' · You'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                            u.role === 'admin'
                              ? 'bg-brand/10 text-brand'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {u.role}
                        </span>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {appUsers.length === 0 && (
                    <p className="text-sm text-slate-400 italic text-center py-4">
                      No user records found. Follow the setup instructions above.
                    </p>
                  )}
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
                <p className="font-black text-white text-sm uppercase tracking-tight">
                  {currentUser.username}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {currentUser.role}
                </p>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 space-y-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <div className="flex justify-between">
                <span>Session</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Active
                </span>
              </div>
              <div className="flex justify-between">
                <span>Auth</span>
                <span className="text-white">Supabase JWT</span>
              </div>
              <div className="flex justify-between">
                <span>Email</span>
                <span className="text-white">{currentUser.email || '—'}</span>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6">
              <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                <ShieldCheck size={14} />
                Secured by Supabase Auth
              </div>
              <p className="text-[9px] text-slate-600 mt-2">
                Sessions use rotating JWT tokens. Passwords are never stored in this application.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
