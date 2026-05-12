import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Upload, Activity, AlertTriangle, CheckCircle2, Clock, Users,
  Fingerprint, CreditCard, Hash, Shield, Server, Wifi, RefreshCw,
  Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Settings2, Download,
  Calendar, Filter, X, Database, Zap, Lock, Edit2, MapPin, Save, Cpu
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  logIngestionService,
  type IngestionResult,
} from '../../services/logIngestionService';
import type {
  Project, AppUser, AccessEvent, SystemEvent, LogImport,
  AnalyticsDisplaySettings, HardwareNode, HardwareAuthType, ProjectLocation,
} from '../../types';
import { DEFAULT_ANALYTICS_SETTINGS } from '../../types';
import { supabase } from '../../services/supabaseClient';

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
  currentUser: AppUser;
}

// ─── colours ──────────────────────────────────────────────────────────────────
const AUTH_COLORS: Record<string, string> = {
  'Card Only': '#3b82f6',
  'Card + Pin': '#8b5cf6',
  'Card/User Id/Fingerprint': '#10b981',
  'Card/User Id + Pin': '#f59e0b',
  'Card/User Id + Fingerprint': '#06b6d4',
  'Card/User Id + Fingerprint (Pin Fallback)': '#d12913',
  'Fingerprint Only': '#ec4899',
};

const RESULT_COLORS = { success: '#10b981', failure: '#ef4444' };

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function fmtDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function groupByDay(events: AccessEvent[]) {
  const map: Record<string, { date: string; success: number; failure: number }> = {};
  for (const e of events) {
    const day = e.occurred_at.slice(0, 10);
    if (!map[day]) map[day] = { date: day, success: 0, failure: 0 };
    if (e.result === 'success') map[day].success++;
    else map[day].failure++;
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── toggle pill ──────────────────────────────────────────────────────────────
const TogglePill: React.FC<{
  label: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  adminOnly?: boolean;
  isAdmin?: boolean;
}> = ({ label, enabled, onChange, adminOnly, isAdmin }) => {
  if (adminOnly && !isAdmin) return null;
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none group">
      <div
        className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-brand' : 'bg-slate-200'}`}
        onClick={() => onChange(!enabled)}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`}
        />
      </div>
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors">
        {label}
      </span>
    </label>
  );
};

// ─── stat card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color?: string;
}> = ({ label, value, sub, icon, color = 'text-brand' }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex items-center gap-4">
    <div className={`p-3 rounded-xl bg-slate-50 ${color}`}>{icon}</div>
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── section wrapper ─────────────────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, children, defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center px-8 py-5 hover:bg-slate-50 transition-colors"
      >
        <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">
          {title}
        </h3>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-8 pb-8">{children}</div>}
    </div>
  );
};

// ─── main component ───────────────────────────────────────────────────────────
export const ProjectTracking: React.FC<Props> = ({
  project, onUpdate, currentUser,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accessEvents, setAccessEvents] = useState<AccessEvent[]>([]);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
  const [logImports, setLogImports] = useState<LogImport[]>([]);
  const [hardwareNodes, setHardwareNodes] = useState<HardwareNode[]>(
    project.hardwareNodes ?? []
  );
  const [displaySettings, setDisplaySettings] = useState<AnalyticsDisplaySettings>(
    DEFAULT_ANALYTICS_SETTINGS
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResults, setIngestResults] = useState<IngestionResult[]>([]);
  const [showIngestResults, setShowIngestResults] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingNode, setEditingNode] = useState<HardwareNode | null>(null);
  const [deviceForm, setDeviceForm] = useState<Partial<HardwareNode>>({});
  const [isSavingDevice, setIsSavingDevice] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(true);

  // Filters
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<'all' | 'success' | 'failure'>('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // Load everything on mount
  useEffect(() => {
    if (!project.id) return;
    setIsLoading(true);

    Promise.all([
      logIngestionService.getAccessEvents(project.id),
      logIngestionService.getSystemEvents(project.id),
      logIngestionService.getLogImports(project.id),
      logIngestionService.getAnalyticsSettings(project.id),
      supabase
        .from('hardware_nodes')
        .select('*')
        .eq('project_id', project.id),
    ])
      .then(([ae, se, li, ds, nodesRes]) => {
        setAccessEvents(ae);
        setSystemEvents(se);
        setLogImports(li);
        if (ds) setDisplaySettings({ ...DEFAULT_ANALYTICS_SETTINGS, ...ds });
        if (nodesRes.data) setHardwareNodes(nodesRes.data as HardwareNode[]);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [project.id]);

  // Filtered access events
  const filtered = useMemo(() => {
    return accessEvents.filter((e) => {
      if (filterDevice !== 'all' && e.device_id !== filterDevice) return false;
      if (filterResult !== 'all' && e.result !== filterResult) return false;
      if (filterStart && e.occurred_at < filterStart) return false;
      if (filterEnd && e.occurred_at > filterEnd + 'T23:59:59') return false;
      return true;
    });
  }, [accessEvents, filterDevice, filterResult, filterStart, filterEnd]);

  // Computed analytics
  const analytics = useMemo(() => {
    const total = filtered.length;
    const successes = filtered.filter((e) => e.result === 'success').length;
    const failures = filtered.filter((e) => e.result === 'failure').length;
    const successRate = total > 0 ? ((successes / total) * 100).toFixed(1) : '0';
    const durations = filtered
      .filter((e) => e.door_open_ms && e.door_open_ms > 0)
      .map((e) => e.door_open_ms!);
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    const uniqueUsers = new Set(
      filtered.filter((e) => e.user_id_raw).map((e) => e.user_id_raw)
    ).size;

    // Auth method breakdown
    const methodCounts: Record<string, number> = {};
    for (const e of filtered) {
      const key = e.auth_type || 'Unknown';
      methodCounts[key] = (methodCounts[key] || 0) + 1;
    }
    const pieData = Object.entries(methodCounts).map(([name, value]) => ({
      name,
      value,
      color: AUTH_COLORS[name] || '#94a3b8',
    }));

    // Timeline by day
    const timeline = groupByDay(filtered);

    // Per-user breakdown
    const userMap: Record<
      string,
      { userId: string; total: number; success: number; failure: number; lastSeen: string }
    > = {};
    for (const e of filtered) {
      const uid = e.user_id_raw || 'Unknown';
      if (!userMap[uid]) {
        userMap[uid] = { userId: uid, total: 0, success: 0, failure: 0, lastSeen: e.occurred_at };
      }
      userMap[uid].total++;
      if (e.result === 'success') userMap[uid].success++;
      else userMap[uid].failure++;
      if (e.occurred_at > userMap[uid].lastSeen) userMap[uid].lastSeen = e.occurred_at;
    }
    const userActivity = Object.values(userMap).sort((a, b) => b.total - a.total);

    return {
      total, successes, failures, successRate, avgDuration, uniqueUsers,
      pieData, timeline, userActivity,
    };
  }, [filtered]);

  // System event analytics
  const sysAnalytics = useMemo(() => {
    const reboots = systemEvents.filter((e) =>
      ['reboot_normal', 'reboot_error', 'reboot_watchdog'].includes(e.event_type)
    );
    const errorReboots = reboots.filter((e) => e.event_type === 'reboot_error');
    const mqttDrops = systemEvents.filter((e) => e.event_type === 'mqtt_disconnect');
    const healthchecks = systemEvents.filter((e) => e.event_type === 'healthcheck');
    const hwErrors = systemEvents.filter((e) => e.event_type === 'hardware_error');
    return { reboots, errorReboots, mqttDrops, healthchecks, hwErrors };
  }, [systemEvents]);

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setIsIngesting(true);
    setShowIngestResults(false);

    const results: IngestionResult[] = [];
    const knownIds = hardwareNodes.map((n) => n.id);

    for (const file of files) {
      const result = await logIngestionService.ingestFile(
        file, project.id, currentUser.id, knownIds
      );
      results.push(result);
      knownIds.push(result.deviceId);
    }

    setIngestResults(results);
    setShowIngestResults(true);

    // Refresh data
    const [ae, se, li] = await Promise.all([
      logIngestionService.getAccessEvents(project.id),
      logIngestionService.getSystemEvents(project.id),
      logIngestionService.getLogImports(project.id),
    ]);
    const nodesRes = await supabase
      .from('hardware_nodes')
      .select('*')
      .eq('project_id', project.id);
    setAccessEvents(ae);
    setSystemEvents(se);
    setLogImports(li);
    if (nodesRes.data) setHardwareNodes(nodesRes.data as HardwareNode[]);

    setIsIngesting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteImport = async (importId: string) => {
    if (!confirm('Delete this import and all its events? This cannot be undone.')) return;
    await logIngestionService.deleteImport(importId);
    setLogImports((prev) => prev.filter((i) => i.id !== importId));
    const ae = await logIngestionService.getAccessEvents(project.id);
    const se = await logIngestionService.getSystemEvents(project.id);
    setAccessEvents(ae);
    setSystemEvents(se);
  };

  const openEditDevice = (node: HardwareNode) => {
    setEditingNode(node);
    setDeviceForm({
      friendlyName: node.friendlyName || '',
      locationId: node.locationId || '',
      authType: node.authType,
      status: node.status,
      serialNumber: node.serialNumber || '',
      macAddress: node.macAddress || '',
      notes: node.notes || '',
    });
    setShowDeviceModal(true);
  };

  const [deviceSaveError, setDeviceSaveError] = useState('');

  const handleSaveDevice = async () => {
    if (!editingNode) return;
    setIsSavingDevice(true);
    setDeviceSaveError('');
    try {
      // Build update object with only defined values to avoid overwriting with undefined
      const updates: Record<string, unknown> = {
        status: deviceForm.status || 'active',
      };
      if (deviceForm.friendlyName !== undefined) updates.friendly_name = deviceForm.friendlyName;
      if (deviceForm.locationId !== undefined) updates.location_id = deviceForm.locationId || null;
      if (deviceForm.authType !== undefined) updates.auth_type = deviceForm.authType || null;
      if (deviceForm.serialNumber !== undefined) updates.serial_number = deviceForm.serialNumber || null;
      if (deviceForm.macAddress !== undefined) updates.mac_address = deviceForm.macAddress || null;
      if (deviceForm.notes !== undefined) updates.notes = deviceForm.notes || null;

      const { error } = await supabase
        .from('hardware_nodes')
        .update(updates)
        .eq('id', editingNode.id);

      if (error) throw new Error(error.message);

      // Update local state with camelCase fields
      setHardwareNodes(prev => prev.map(n => n.id === editingNode.id
        ? {
            ...n,
            friendlyName: deviceForm.friendlyName,
            locationId: deviceForm.locationId,
            authType: deviceForm.authType,
            status: deviceForm.status || 'active',
            serialNumber: deviceForm.serialNumber,
            macAddress: deviceForm.macAddress,
            notes: deviceForm.notes,
          }
        : n
      ));
      setShowDeviceModal(false);
    } catch (e) {
      console.error('Device save error:', e);
      setDeviceSaveError(e instanceof Error ? e.message : 'Save failed. Check console for details.');
    } finally {
      setIsSavingDevice(false);
    }
  };

  const handleSaveDisplaySettings = async () => {
    setIsSavingSettings(true);
    const settingsToSave: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(displaySettings)) {
      if (typeof v === 'boolean') settingsToSave[k] = v;
    }
    await logIngestionService.saveAnalyticsSettings(settingsToSave);
    setTimeout(() => setIsSavingSettings(false), 800);
  };

  const updateDisplaySetting = (key: keyof AnalyticsDisplaySettings, val: boolean) => {
    setDisplaySettings((prev) => ({ ...prev, [key]: val }));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <RefreshCw size={32} className="text-brand animate-spin mb-4" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Loading Analytics...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">
            Tracking
          </h2>
          <p className="text-sm text-slate-500 font-medium italic">
            Hardware access analytics and device telemetry for {project.title}.
          </p>
        </div>
        <div className="flex gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.log"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isIngesting}
            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50"
          >
            {isIngesting ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {isIngesting ? 'Processing...' : 'Import Logs'}
          </button>
        </div>
      </div>

      {/* Ingest results banner */}
      {showIngestResults && ingestResults.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-6 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">
              Import Results
            </h4>
            <button onClick={() => setShowIngestResults(false)}>
              <X size={16} className="text-slate-400" />
            </button>
          </div>
          {ingestResults.map((r, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-4 py-3 rounded-xl ${
                r.error ? 'bg-red-500/20' : 'bg-emerald-500/10'
              }`}
            >
              <span className="text-xs font-bold text-slate-300">{r.filename}</span>
              <div className="flex items-center gap-4 text-[10px] font-black uppercase">
                {r.error ? (
                  <span className="text-red-400">{r.error}</span>
                ) : (
                  <>
                    <span className="text-slate-400">Device: {r.deviceId.slice(0, 8)}…</span>
                    <span className="text-emerald-400">{r.accessEvents} access events</span>
                    <span className="text-blue-400">{r.systemEvents} system events</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Devices Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setDevicesOpen(!devicesOpen)}
          className="w-full flex items-center justify-between px-8 py-5 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center"><Cpu size={16} className="text-white" /></div>
            <div className="text-left">
              <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Registered Devices</h3>
              <p className="text-[10px] text-slate-400 font-bold">{hardwareNodes.length} device{hardwareNodes.length !== 1 ? 's' : ''} — click to name or assign to a location</p>
            </div>
          </div>
          {devicesOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {devicesOpen && (
          <div className="px-8 pb-6">
            {hardwareNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-100 rounded-2xl">
                <Cpu size={28} className="text-slate-200 mb-3" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No devices yet — import a log file to register devices automatically</p>
              </div>
            ) : (
              <div className="space-y-3">
                {hardwareNodes.map(node => {
                  const loc = project.locations.find(l => l.id === node.locationId);
                  return (
                    <div key={node.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${node.status === 'active' ? 'bg-emerald-400' : node.status === 'maintenance' ? 'bg-amber-400' : 'bg-slate-300'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-black text-slate-900 text-sm">{node.friendlyName || <span className="text-slate-400 italic font-medium">Unnamed device</span>}</p>
                            {node.authType && (
                              <span className="text-[8px] font-black bg-brand/10 text-brand px-2 py-0.5 rounded uppercase tracking-widest">{node.authType}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <p className="text-[10px] font-mono text-slate-400">{node.id}</p>
                            {loc && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                                <MapPin size={10} /> {loc.name}
                              </span>
                            )}
                            {!loc && node.locationId && <span className="text-[10px] text-amber-500 font-bold">Location not found</span>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => openEditDevice(node)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 size={13} /> Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* No data state */}
      {accessEvents.length === 0 && systemEvents.length === 0 && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-16 text-center">
          <Database size={48} className="text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter mb-2">
            No Log Data
          </h3>
          <p className="text-sm text-slate-400 mb-6">
            Import device log files to see access analytics and system telemetry.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-8 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all"
          >
            <Upload size={16} className="inline mr-2" />
            Import Your First Log
          </button>
        </div>
      )}

      {(accessEvents.length > 0 || systemEvents.length > 0) && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Filters
                </span>
              </div>

              <select
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand"
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
              >
                <option value="all">All Devices</option>
                {hardwareNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.friendlyName || n.id}
                  </option>
                ))}
              </select>

              <select
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand"
                value={filterResult}
                onChange={(e) =>
                  setFilterResult(e.target.value as 'all' | 'success' | 'failure')
                }
              >
                <option value="all">All Results</option>
                <option value="success">Successful Only</option>
                <option value="failure">Failed Only</option>
              </select>

              <input
                type="date"
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                placeholder="Start"
              />
              <span className="text-slate-300 text-sm">→</span>
              <input
                type="date"
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                placeholder="End"
              />

              {(filterDevice !== 'all' || filterResult !== 'all' || filterStart || filterEnd) && (
                <button
                  onClick={() => {
                    setFilterDevice('all');
                    setFilterResult('all');
                    setFilterStart('');
                    setFilterEnd('');
                  }}
                  className="flex items-center gap-1 text-[10px] font-black text-brand uppercase tracking-widest"
                >
                  <X size={12} /> Clear
                </button>
              )}

              <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {filtered.length} events
              </span>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Entries"
              value={analytics.total}
              icon={<Activity size={20} />}
            />
            <StatCard
              label="Success Rate"
              value={`${analytics.successRate}%`}
              sub={`${analytics.successes} successful`}
              icon={<CheckCircle2 size={20} />}
              color="text-emerald-500"
            />
            <StatCard
              label="Failed Attempts"
              value={analytics.failures}
              sub={analytics.failures > 0 ? 'Review below' : 'None detected'}
              icon={<AlertTriangle size={20} />}
              color={analytics.failures > 0 ? 'text-red-500' : 'text-slate-400'}
            />
            <StatCard
              label="Unique Users"
              value={analytics.uniqueUsers}
              sub="by device user ID"
              icon={<Users size={20} />}
              color="text-blue-500"
            />
          </div>

          {/* Access Timeline */}
          {displaySettings.show_access_timeline && analytics.timeline.length > 0 && (
            <Section title="Access Timeline">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analytics.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="success"
                    stackId="1"
                    stroke="#10b981"
                    fill="#d1fae5"
                    name="Success"
                  />
                  <Area
                    type="monotone"
                    dataKey="failure"
                    stackId="1"
                    stroke="#ef4444"
                    fill="#fee2e2"
                    name="Failure"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}

          {/* Auth Method Breakdown */}
          {displaySettings.show_auth_method_breakdown && analytics.pieData.length > 0 && (
            <Section title="Authentication Method Breakdown">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={analytics.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {analytics.pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 self-center">
                  {analytics.pieData.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ background: entry.color }}
                        />
                        <span className="text-xs font-bold text-slate-700">{entry.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* Failed Attempts */}
          {displaySettings.show_failed_attempts && analytics.failures > 0 && (
            <Section title={`Failed Attempts (${analytics.failures})`}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Time</th>
                      <th className="pb-3 pr-4">Device</th>
                      <th className="pb-3 pr-4">Auth Type</th>
                      <th className="pb-3 pr-4">User ID</th>
                      <th className="pb-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered
                      .filter((e) => e.result === 'failure')
                      .slice(0, 100)
                      .map((e, i) => {
                        const node = hardwareNodes.find((n) => n.id === e.device_id);
                        return (
                          <tr key={i} className="hover:bg-red-50/50 transition-colors">
                            <td className="py-2.5 pr-4 font-mono text-slate-500">
                              {fmtDate(e.occurred_at)}
                            </td>
                            <td className="py-2.5 pr-4 font-bold text-slate-700">
                              {node?.friendlyName || e.device_id.slice(0, 8) + '…'}
                            </td>
                            <td className="py-2.5 pr-4">
                              <span
                                className="px-2 py-1 rounded-lg text-[9px] font-black uppercase"
                                style={{
                                  background: AUTH_COLORS[e.auth_type] + '20',
                                  color: AUTH_COLORS[e.auth_type],
                                }}
                              >
                                {e.auth_type}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-slate-500">
                              {e.user_id_raw || '—'}
                            </td>
                            <td className="py-2.5 text-slate-400">
                              {e.failure_reason || '—'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {filtered.filter((e) => e.result === 'failure').length > 100 && (
                  <p className="text-[10px] text-slate-400 mt-3 text-center">
                    Showing first 100 failures. Use date filters to narrow the range.
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* User Activity */}
          {displaySettings.show_user_activity && analytics.userActivity.length > 0 && (
            <Section title="User Activity">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">User ID (Raw)</th>
                      <th className="pb-3 pr-4">Total Accesses</th>
                      <th className="pb-3 pr-4">Successes</th>
                      <th className="pb-3 pr-4">Failures</th>
                      <th className="pb-3 pr-4">Success Rate</th>
                      <th className="pb-3">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.userActivity.map((u, i) => {
                      const rate = ((u.success / u.total) * 100).toFixed(0);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pr-4 font-mono font-bold text-slate-700">
                            {u.userId}
                          </td>
                          <td className="py-2.5 pr-4 font-black">{u.total}</td>
                          <td className="py-2.5 pr-4 text-emerald-600 font-bold">
                            {u.success}
                          </td>
                          <td className="py-2.5 pr-4 text-red-500 font-bold">
                            {u.failure}
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${rate}%` }}
                                />
                              </div>
                              <span className="font-black text-slate-600">{rate}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-slate-400 font-mono">
                            {fmtDate(u.lastSeen)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Door Duration */}
          {displaySettings.show_door_open_duration && (
            <Section title="Door Open Duration">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Average', value: fmtDuration(analytics.avgDuration) },
                  {
                    label: 'Min',
                    value: fmtDuration(
                      Math.min(...filtered.filter((e) => e.door_open_ms).map((e) => e.door_open_ms!))
                    ),
                  },
                  {
                    label: 'Max',
                    value: fmtDuration(
                      Math.max(...filtered.filter((e) => e.door_open_ms).map((e) => e.door_open_ms!))
                    ),
                  },
                  {
                    label: 'Recorded',
                    value: filtered.filter((e) => e.door_open_ms).length,
                  },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {s.label}
                    </p>
                    <p className="text-xl font-black text-slate-900">{s.value}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Network / MQTT Events */}
          {displaySettings.show_mqtt_events && sysAnalytics.mqttDrops.length > 0 && (
            <Section title={`Network Events — ${sysAnalytics.mqttDrops.length} MQTT Disconnects`} defaultOpen={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Time</th>
                      <th className="pb-3 pr-4">Device</th>
                      <th className="pb-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.mqttDrops.map((e, i) => {
                      const node = hardwareNodes.find((n) => n.id === e.device_id);
                      return (
                        <tr key={i}>
                          <td className="py-2.5 pr-4 font-mono text-slate-500">
                            {fmtDate(e.occurred_at)}
                          </td>
                          <td className="py-2.5 pr-4 font-bold text-slate-700">
                            {node?.friendlyName || e.device_id.slice(0, 8) + '…'}
                          </td>
                          <td className="py-2.5 text-slate-400">{e.details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Reboots */}
          {displaySettings.show_reboots && sysAnalytics.reboots.length > 0 && (
            <Section
              title={`Reboots — ${sysAnalytics.reboots.length} total, ${sysAnalytics.errorReboots.length} error reboots`}
              defaultOpen={false}
            >
              {sysAnalytics.errorReboots.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                  <AlertTriangle size={16} className="text-red-500" />
                  <span className="text-xs font-black text-red-700">
                    {sysAnalytics.errorReboots.length} error-triggered reboots detected. Review device hardware.
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Time</th>
                      <th className="pb-3 pr-4">Device</th>
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.reboots.map((e, i) => {
                      const node = hardwareNodes.find((n) => n.id === e.device_id);
                      return (
                        <tr key={i} className={e.event_type === 'reboot_error' ? 'bg-red-50/50' : ''}>
                          <td className="py-2.5 pr-4 font-mono text-slate-500">
                            {fmtDate(e.occurred_at)}
                          </td>
                          <td className="py-2.5 pr-4 font-bold text-slate-700">
                            {node?.friendlyName || e.device_id.slice(0, 8) + '…'}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                e.event_type === 'reboot_error'
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {e.event_type.replace('reboot_', '')}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-400">{e.details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Device Diagnostics */}
          {(displaySettings.show_firmware_info ||
            displaySettings.show_wifi_signal ||
            displaySettings.show_ip_address) &&
            hardwareNodes.length > 0 && (
              <Section title="Device Diagnostics" defaultOpen={false}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {hardwareNodes.map((node) => (
                    <div
                      key={node.id}
                      className="bg-slate-50 rounded-2xl p-6 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-900 text-sm uppercase tracking-tight">
                          {node.friendlyName || node.id}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            node.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : node.status === 'maintenance'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {node.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-400">{node.id}</p>
                      <div className="space-y-2 text-xs">
                        {displaySettings.show_firmware_info && node.firmware && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Firmware</span>
                            <span className="font-mono font-bold">{node.firmware}</span>
                          </div>
                        )}
                        {displaySettings.show_ip_address && node.ipAddress && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">IP Address</span>
                            <span className="font-mono font-bold">{node.ipAddress}</span>
                          </div>
                        )}
                        {displaySettings.show_wifi_signal && node.wifiSsid && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Network</span>
                            <span className="font-bold">{node.wifiSsid}</span>
                          </div>
                        )}
                        {displaySettings.show_cert_expiry && node.certExpires && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Cert Expires</span>
                            <span
                              className={`font-bold ${
                                new Date(node.certExpires) < new Date(Date.now() + 90 * 86400000)
                                  ? 'text-amber-600'
                                  : 'text-slate-700'
                              }`}
                            >
                              {new Date(node.certExpires).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {node.lastSeen && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Last Seen</span>
                            <span className="font-bold">{fmtDate(node.lastSeen)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

          {/* Health Checks */}
          {displaySettings.show_health_checks && sysAnalytics.healthchecks.length > 0 && (
            <Section title={`Health Checks (${sysAnalytics.healthchecks.length})`} defaultOpen={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Time</th>
                      <th className="pb-3 pr-4">Device</th>
                      <th className="pb-3">Field Support Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.healthchecks.slice(0, 50).map((e, i) => {
                      const node = hardwareNodes.find((n) => n.id === e.device_id);
                      return (
                        <tr key={i}>
                          <td className="py-2.5 pr-4 font-mono text-slate-500">
                            {fmtDate(e.occurred_at)}
                          </td>
                          <td className="py-2.5 pr-4 font-bold text-slate-700">
                            {node?.friendlyName || e.device_id.slice(0, 8) + '…'}
                          </td>
                          <td className="py-2.5 font-mono text-slate-400">{e.details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Log Import Management */}
          <Section title={`Log Import History (${logImports.length} imports)`} defaultOpen={false}>
            {logImports.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No imports yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">File</th>
                      <th className="pb-3 pr-4">Device</th>
                      <th className="pb-3 pr-4">Events</th>
                      <th className="pb-3 pr-4">Imported</th>
                      {isAdmin && <th className="pb-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {logImports.map((imp) => {
                      const node = hardwareNodes.find((n) => n.id === imp.device_id);
                      return (
                        <tr key={imp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pr-4 font-mono text-slate-700">
                            {imp.filename}
                          </td>
                          <td className="py-2.5 pr-4 font-bold text-slate-700">
                            {node?.friendlyName || imp.device_id?.slice(0, 8) + '…'}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-500">
                            {imp.event_count}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-400 font-mono">
                            {imp.imported_at ? fmtDate(imp.imported_at) : '—'}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5">
                              <button
                                onClick={() => imp.id && handleDeleteImport(imp.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Admin: Display Settings */}
          {isAdmin && (
            <Section title="Analytics Display Settings — Admin" defaultOpen={false}>
              <p className="text-xs text-slate-500 mb-6 italic">
                Control which analytics sections are visible to non-admin users.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <TogglePill
                  label="Access Timeline"
                  enabled={displaySettings.show_access_timeline}
                  onChange={(v) => updateDisplaySetting('show_access_timeline', v)}
                />
                <TogglePill
                  label="Auth Method Breakdown"
                  enabled={displaySettings.show_auth_method_breakdown}
                  onChange={(v) => updateDisplaySetting('show_auth_method_breakdown', v)}
                />
                <TogglePill
                  label="Failed Attempts"
                  enabled={displaySettings.show_failed_attempts}
                  onChange={(v) => updateDisplaySetting('show_failed_attempts', v)}
                />
                <TogglePill
                  label="Door Duration"
                  enabled={displaySettings.show_door_open_duration}
                  onChange={(v) => updateDisplaySetting('show_door_open_duration', v)}
                />
                <TogglePill
                  label="User Activity"
                  enabled={displaySettings.show_user_activity}
                  onChange={(v) => updateDisplaySetting('show_user_activity', v)}
                />
                <TogglePill
                  label="MQTT / Network Events"
                  enabled={displaySettings.show_mqtt_events}
                  onChange={(v) => updateDisplaySetting('show_mqtt_events', v)}
                />
                <TogglePill
                  label="Reboots"
                  enabled={displaySettings.show_reboots}
                  onChange={(v) => updateDisplaySetting('show_reboots', v)}
                />
                <TogglePill
                  label="Health Checks"
                  enabled={displaySettings.show_health_checks}
                  onChange={(v) => updateDisplaySetting('show_health_checks', v)}
                />
                <TogglePill
                  label="Firmware Info"
                  enabled={displaySettings.show_firmware_info}
                  onChange={(v) => updateDisplaySetting('show_firmware_info', v)}
                />
                <TogglePill
                  label="WiFi Signal"
                  enabled={displaySettings.show_wifi_signal}
                  onChange={(v) => updateDisplaySetting('show_wifi_signal', v)}
                />
                <TogglePill
                  label="IP Address"
                  enabled={displaySettings.show_ip_address}
                  onChange={(v) => updateDisplaySetting('show_ip_address', v)}
                />
                <TogglePill
                  label="Cert Expiry"
                  enabled={displaySettings.show_cert_expiry}
                  onChange={(v) => updateDisplaySetting('show_cert_expiry', v)}
                />
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveDisplaySettings}
                  disabled={isSavingSettings}
                  className="px-8 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingSettings ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Settings2 size={14} />
                  )}
                  {isSavingSettings ? 'Saving...' : 'Save Display Settings'}
                </button>
              </div>
            </Section>
          )}
        </>
      )}

      {/* Device Edit Modal */}
      {showDeviceModal && editingNode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Edit Device</h3>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{editingNode.id}</p>
              </div>
              <button onClick={() => { setShowDeviceModal(false); setDeviceSaveError(''); }} className="text-slate-400 hover:text-black transition-colors"><X size={22} /></button>
            </div>

            <div className="p-8 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {deviceSaveError && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-bold">{deviceSaveError}</div>
              )}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Device Name</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all"
                  placeholder="e.g. Main Floor Safe, ICU Cabinet A"
                  value={deviceForm.friendlyName || ''}
                  onChange={e => setDeviceForm((f: Partial<HardwareNode>) => ({ ...f, friendlyName: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all"
                  value={deviceForm.locationId || ''}
                  onChange={e => setDeviceForm((f: Partial<HardwareNode>) => ({ ...f, locationId: e.target.value }))}
                >
                  <option value="">— Unassigned —</option>
                  {project.locations.map((loc: ProjectLocation) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                {project.locations.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-bold">No locations defined yet — add them on the Summary tab first.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Auth Method</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all"
                  value={deviceForm.authType || ''}
                  onChange={e => setDeviceForm((f: Partial<HardwareNode>) => ({ ...f, authType: e.target.value as HardwareAuthType }))}
                >
                  <option value="">— Unknown —</option>
                  {(['Card Only','Card + Pin','Card/User Id/Fingerprint','Card/User Id + Pin','Card/User Id + Fingerprint','Card/User Id + Fingerprint (Pin Fallback)','Fingerprint Only'] as HardwareAuthType[]).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['active', 'maintenance', 'offline'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setDeviceForm((f: Partial<HardwareNode>) => ({ ...f, status: s }))}
                      className={`py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${deviceForm.status === s ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial Number</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-mono outline-none focus:border-brand transition-all"
                  placeholder="Optional"
                  value={deviceForm.serialNumber || ''}
                  onChange={e => setDeviceForm((f: Partial<HardwareNode>) => ({ ...f, serialNumber: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
                <textarea
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all resize-none h-20"
                  placeholder="Any notes about this device..."
                  value={deviceForm.notes || ''}
                  onChange={e => setDeviceForm((f: Partial<HardwareNode>) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              {(editingNode.firmware || editingNode.ipAddress || editingNode.wifiSsid) && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">From Last Log Import</p>
                  {editingNode.firmware && <div className="flex justify-between text-xs"><span className="text-slate-500">Firmware</span><span className="font-mono font-bold">{editingNode.firmware}</span></div>}
                  {editingNode.ipAddress && <div className="flex justify-between text-xs"><span className="text-slate-500">IP Address</span><span className="font-mono font-bold">{editingNode.ipAddress}</span></div>}
                  {editingNode.wifiSsid && <div className="flex justify-between text-xs"><span className="text-slate-500">WiFi Network</span><span className="font-bold">{editingNode.wifiSsid}</span></div>}
                  {editingNode.lastSeen && <div className="flex justify-between text-xs"><span className="text-slate-500">Last Seen</span><span className="font-bold">{new Date(editingNode.lastSeen).toLocaleDateString()}</span></div>}
                </div>
              )}
            </div>

            <div className="px-8 py-5 bg-slate-50 border-t flex justify-end gap-3">
              <button onClick={() => { setShowDeviceModal(false); setDeviceSaveError(''); }} className="px-5 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
              <button
                onClick={handleSaveDevice}
                disabled={isSavingDevice}
                className="px-8 py-3 bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingDevice ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {isSavingDevice ? 'Saving...' : 'Save Device'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
