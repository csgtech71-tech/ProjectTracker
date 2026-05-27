import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Upload, Activity, AlertTriangle, CheckCircle2, Users, RefreshCw, Clock,
  Trash2, ChevronDown, ChevronUp, X, Database, Cpu, Edit2, Save,
  Filter, FileText, Download, Wifi, WifiOff, RotateCcw, Heart,
  Settings2, ToggleLeft, ToggleRight, Zap, Cloud,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from 'recharts';
import { parseLogFile } from '../../parsers/logParser';
import type { AccessEvent, SystemEvent, AppUser, GlobalSettings } from '../../types';
import { exportPDF, exportCSV, type ExportToggles } from '../../services/exportReport';

interface Props {
  currentUser: AppUser;
  globalSettings: GlobalSettings;
}

interface LocalDevice {
  id: string;
  friendlyName: string;
  firmware?: string;
  ipAddress?: string;
  wifiSsid?: string;
}

interface ImportedFile {
  filename: string;
  deviceId: string;
  accessEvents: AccessEvent[];
  systemEvents: SystemEvent[];
  lineCount: number;
}

interface DisplayToggles {
  // Access
  showTimeline: boolean;
  showAuthBreakdown: boolean;
  showFailedAttempts: boolean;
  showUserActivity: boolean;
  showDoorDuration: boolean;
  // System
  showUptimeSummary: boolean;
  showMqttEvents: boolean;
  showReboots: boolean;
  showHealthchecks: boolean;
  showCloudSync: boolean;
  showConfigChanges: boolean;
}

const DEFAULT_TOGGLES: DisplayToggles = {
  showTimeline: true,
  showAuthBreakdown: true,
  showFailedAttempts: true,
  showUserActivity: true,
  showDoorDuration: true,
  showUptimeSummary: true,
  showMqttEvents: true,
  showReboots: true,
  showHealthchecks: false,
  showCloudSync: false,
  showConfigChanges: false,
};

const AUTH_COLORS: Record<string, string> = {
  'Card Only': '#3b82f6',
  'Card + Pin': '#8b5cf6',
  'Card/User Id/Fingerprint': '#10b981',
  'Card/User Id + Pin': '#f59e0b',
  'Card/User Id + Fingerprint': '#06b6d4',
  'Card/User Id + Fingerprint (Pin Fallback)': '#d12913',
  'Fingerprint Only': '#ec4899',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
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

// Compute uptime from MQTT connect/disconnect pairs
function computeUptime(systemEvents: SystemEvent[], deviceId: string) {
  const events = systemEvents
    .filter(e => e.device_id === deviceId && (e.event_type === 'mqtt_connect' || e.event_type === 'mqtt_disconnect'))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  if (events.length === 0) return null;

  const firstTs = new Date(events[0].occurred_at).getTime();
  const lastTs = new Date(events[events.length - 1].occurred_at).getTime();
  const spanMs = lastTs - firstTs;
  if (spanMs === 0) return null;

  let downtimeMs = 0;
  let disconnectAt: number | null = null;
  const gaps: { start: string; end: string; durationMs: number }[] = [];

  for (const e of events) {
    const ts = new Date(e.occurred_at).getTime();
    if (e.event_type === 'mqtt_disconnect') {
      disconnectAt = ts;
    } else if (e.event_type === 'mqtt_connect' && disconnectAt !== null) {
      const gapMs = ts - disconnectAt;
      downtimeMs += gapMs;
      gaps.push({ start: new Date(disconnectAt).toISOString(), end: e.occurred_at, durationMs: gapMs });
      disconnectAt = null;
    }
  }

  const uptimeMs = spanMs - downtimeMs;
  return {
    uptimePct: Math.max(0, Math.min(100, (uptimeMs / spanMs) * 100)).toFixed(1),
    uptimeMs,
    downtimeMs,
    spanMs,
    disconnects: events.filter(e => e.event_type === 'mqtt_disconnect').length,
    gaps,
  };
}

// ─── sub-components ───────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; icon: React.ReactNode; color?: string }> = ({ label, value, sub, icon, color = 'text-brand' }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
    <div className={`p-3 rounded-xl bg-slate-50 ${color}`}>{icon}</div>
    <div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-black text-slate-900 leading-none">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string; badgeColor?: string }> = ({ title, children, defaultOpen = true, badge, badgeColor = 'bg-slate-100 text-slate-600' }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center px-8 py-5 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">{title}</h3>
          {badge && <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${badgeColor}`}>{badge}</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-8 pb-8">{children}</div>}
    </div>
  );
};

const Toggle: React.FC<{ label: string; enabled: boolean; onChange: (v: boolean) => void }> = ({ label, enabled, onChange }) => (
  <label className="flex items-center gap-3 cursor-pointer select-none group py-1.5">
    <div onClick={() => onChange(!enabled)} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${enabled ? 'bg-brand' : 'bg-slate-200'}`}>
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-4' : ''}`} />
    </div>
    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{label}</span>
  </label>
);

// ─── main component ───────────────────────────────────────────────────────────

export const LogAnalyzer: React.FC<Props> = ({ currentUser, globalSettings }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imports, setImports] = useState<ImportedFile[]>([]);
  const [devices, setDevices] = useState<LocalDevice[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResults, setIngestResults] = useState<{ filename: string; ok: boolean; msg: string }[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [filterDevice, setFilterDevice] = useState('all');
  const [filterResult, setFilterResult] = useState<'all' | 'success' | 'failure' | 'incomplete'>('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTogglePanel, setShowTogglePanel] = useState(false);
  const [exportTitle, setExportTitle] = useState('Device Access & Analytics Report');
  const [exportAnalyst, setExportAnalyst] = useState(currentUser.username);
  const [exportNotes, setExportNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [toggles, setToggles] = useState<DisplayToggles>(DEFAULT_TOGGLES);

  const setToggle = (key: keyof DisplayToggles) => (val: boolean) =>
    setToggles(prev => ({ ...prev, [key]: val }));

  const allAccess = useMemo(() => imports.flatMap(i => i.accessEvents), [imports]);
  const allSystem = useMemo(() => imports.flatMap(i => i.systemEvents), [imports]);

  const filtered = useMemo(() => allAccess.filter(e => {
    if (filterDevice !== 'all' && e.device_id !== filterDevice) return false;
    if (filterResult !== 'all' && e.result !== filterResult) return false;
    if (filterStart && e.occurred_at < filterStart) return false;
    if (filterEnd && e.occurred_at > filterEnd + 'T23:59:59') return false;
    return true;
  }), [allAccess, filterDevice, filterResult, filterStart, filterEnd]);

  const analytics = useMemo(() => {
    const total = filtered.length;
    const successes = filtered.filter(e => e.result === 'success').length;
    const failures = filtered.filter(e => e.result === 'failure').length;
    const incomplete = filtered.filter(e => e.result === 'incomplete').length;
    const successRate = total > 0 ? ((successes / total) * 100).toFixed(1) : '0';
    const durations = filtered.filter(e => e.door_open_ms && e.door_open_ms > 0).map(e => e.door_open_ms!);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const uniqueUsers = new Set(filtered.filter(e => e.user_id_raw).map(e => e.user_id_raw)).size;
    const methodCounts: Record<string, number> = {};
    for (const e of filtered) { const k = e.auth_type || 'Unknown'; methodCounts[k] = (methodCounts[k] || 0) + 1; }
    const pieData = Object.entries(methodCounts).map(([name, value]) => ({ name, value, color: AUTH_COLORS[name] || '#94a3b8' }));
    const timeline = groupByDay(filtered);
    const userMap: Record<string, { userId: string; total: number; success: number; failure: number; lastSeen: string }> = {};
    for (const e of filtered) {
      const uid = e.user_id_raw || 'Unknown';
      if (!userMap[uid]) userMap[uid] = { userId: uid, total: 0, success: 0, failure: 0, lastSeen: e.occurred_at };
      userMap[uid].total++;
      if (e.result === 'success') userMap[uid].success++; else userMap[uid].failure++;
      if (e.occurred_at > userMap[uid].lastSeen) userMap[uid].lastSeen = e.occurred_at;
    }
    return { total, successes, failures, incomplete, successRate, avgDuration, uniqueUsers, pieData, timeline, userActivity: Object.values(userMap).sort((a, b) => b.total - a.total) };
  }, [filtered]);

  const sysAnalytics = useMemo(() => {
    const reboots = allSystem.filter(e => ['reboot_normal', 'reboot_error', 'reboot_watchdog'].includes(e.event_type));
    const errorReboots = reboots.filter(e => e.event_type === 'reboot_error');
    const mqttEvents = allSystem.filter(e => ['mqtt_connect', 'mqtt_disconnect'].includes(e.event_type))
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const mqttDrops = mqttEvents.filter(e => e.event_type === 'mqtt_disconnect');
    const healthchecks = allSystem.filter(e => e.event_type === 'healthcheck');
    const cloudSyncs = allSystem.filter(e => e.event_type === 'cloud_sync');
    const syncSkips = allSystem.filter(e => e.event_type === 'sync_skipped');
    const configChanges = allSystem.filter(e => e.event_type === 'config_change');

    // Compute per-device uptime
    const uptimeByDevice: Record<string, ReturnType<typeof computeUptime>> = {};
    for (const d of devices) {
      const result = computeUptime(allSystem, d.id);
      if (result) uptimeByDevice[d.id] = result;
    }

    return { reboots, errorReboots, mqttDrops, mqttEvents, healthchecks, cloudSyncs, syncSkips, configChanges, uptimeByDevice };
  }, [allSystem, devices]);

  const deviceName = (id: string) => {
    const d = devices.find(d => d.id === id);
    return d?.friendlyName || id.slice(0, 8) + '…';
  };

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setIsIngesting(true);
    setShowResults(false);
    const results: { filename: string; ok: boolean; msg: string }[] = [];
    const newImports: ImportedFile[] = [];
    const newDeviceIds: string[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = parseLogFile(text, file.name);
        if (parsed.deviceIds.length === 0) { results.push({ filename: file.name, ok: false, msg: 'No device ID detected.' }); continue; }
        const deviceId = parsed.deviceIds[0];
        newImports.push({ filename: file.name, deviceId, accessEvents: parsed.accessEvents, systemEvents: parsed.systemEvents, lineCount: parsed.lineCount });
        if (!devices.find(d => d.id === deviceId) && !newDeviceIds.includes(deviceId)) {
          newDeviceIds.push(deviceId);
          setDevices(prev => [...prev, { id: deviceId, friendlyName: '', firmware: parsed.firmware, ipAddress: parsed.ipAddress, wifiSsid: parsed.wifiSsid }]);
        } else {
          setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, firmware: parsed.firmware || d.firmware, ipAddress: parsed.ipAddress || d.ipAddress, wifiSsid: parsed.wifiSsid || d.wifiSsid } : d));
        }
        results.push({ filename: file.name, ok: true, msg: `${parsed.accessEvents.length} access · ${parsed.systemEvents.length} system · ${parsed.lineCount} lines` });
      } catch (e) {
        results.push({ filename: file.name, ok: false, msg: e instanceof Error ? e.message : 'Parse failed.' });
      }
    }
    setImports(prev => [...prev, ...newImports]);
    setIngestResults(results);
    setShowResults(true);
    setIsIngesting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [devices]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFiles(Array.from(e.target.files ?? []));
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files).filter(f => /\.(txt|log|csv)$/i.test(f.name))); };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try { exportPDF({
        accessEvents: allAccess,
        systemEvents: allSystem,
        devices,
        filenames: imports.map(i => i.filename),
        settings: globalSettings,
        analystName: exportAnalyst,
        reportTitle: exportTitle,
        notes: exportNotes,
        toggles: {
          showTimeline:       toggles.showTimeline,
          showAuthBreakdown:  toggles.showAuthBreakdown,
          showFailedAttempts: toggles.showFailedAttempts,
          showUserActivity:   toggles.showUserActivity,
          showDoorDuration:   toggles.showDoorDuration,
          showUptimeSummary:  toggles.showUptimeSummary,
          showMqttEvents:     toggles.showMqttEvents,
          showReboots:        toggles.showReboots,
          showHealthchecks:   toggles.showHealthchecks,
          showCloudSync:      toggles.showCloudSync,
          showConfigChanges:  toggles.showConfigChanges,
        },
      }); }
    catch (e) { console.error('PDF export failed:', e); }
    finally { setTimeout(() => setIsExporting(false), 1500); }
  };
  const handleExportCSV = () => exportCSV(allAccess, allSystem, devices, globalSettings.companyName || 'MedixSafe');

  const clearAll = () => { setImports([]); setDevices([]); setIngestResults([]); setShowResults(false); setFilterDevice('all'); setFilterResult('all'); setFilterStart(''); setFilterEnd(''); };

  const hasData = imports.length > 0;
  const totalSystemEvents = allSystem.length;
  const overallUptime = useMemo(() => {
    if (sysAnalytics.mqttDrops.length === 0 && sysAnalytics.mqttEvents.length === 0) return null;
    const allUptimes = Object.values(sysAnalytics.uptimeByDevice).filter(Boolean);
    if (!allUptimes.length) return null;
    const avgPct = allUptimes.reduce((s, u) => s + parseFloat(u!.uptimePct), 0) / allUptimes.length;
    return avgPct.toFixed(1);
  }, [sysAnalytics]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">Log Analyzer</h2>
          <p className="text-sm text-slate-500 font-medium italic">Standalone analysis — no project required. Session only, nothing saved to the database.</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {hasData && (
            <>
              <button onClick={() => setShowTogglePanel(v => !v)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${showTogglePanel ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                <Settings2 size={14} /> Display
              </button>
              <button onClick={clearAll} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all">
                <Trash2 size={14} /> Clear All
              </button>
              <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all">
                <Download size={14} /> Export
              </button>
            </>
          )}
          <input ref={fileInputRef} type="file" accept=".txt,.log,.csv" multiple className="hidden" onChange={handleInputChange} />
          <button onClick={() => fileInputRef.current?.click()} disabled={isIngesting} className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50">
            {isIngesting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
            {isIngesting ? 'Parsing...' : 'Import Logs'}
          </button>
        </div>
      </div>

      {/* Display Toggle Panel */}
      {showTogglePanel && (
        <div className="bg-slate-900 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Display Settings — Choose what to show</h3>
            <button onClick={() => setShowTogglePanel(false)}><X size={16} className="text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-0">
            <div>
              <p className="text-[9px] font-black text-brand uppercase tracking-widest mb-3">Access Analytics</p>
              <Toggle label="Access Timeline" enabled={toggles.showTimeline} onChange={setToggle('showTimeline')} />
              <Toggle label="Auth Method Breakdown" enabled={toggles.showAuthBreakdown} onChange={setToggle('showAuthBreakdown')} />
              <Toggle label="Failed Attempts" enabled={toggles.showFailedAttempts} onChange={setToggle('showFailedAttempts')} />
              <Toggle label="User Activity" enabled={toggles.showUserActivity} onChange={setToggle('showUserActivity')} />
              <Toggle label="Door Open Duration" enabled={toggles.showDoorDuration} onChange={setToggle('showDoorDuration')} />
            </div>
            <div>
              <p className="text-[9px] font-black text-brand uppercase tracking-widest mb-3">System & Network</p>
              <Toggle label="Connection Uptime" enabled={toggles.showUptimeSummary} onChange={setToggle('showUptimeSummary')} />
              <Toggle label="MQTT Events" enabled={toggles.showMqttEvents} onChange={setToggle('showMqttEvents')} />
              <Toggle label="Reboots" enabled={toggles.showReboots} onChange={setToggle('showReboots')} />
              <Toggle label="Health Checks" enabled={toggles.showHealthchecks} onChange={setToggle('showHealthchecks')} />
              <Toggle label="Cloud Sync Events" enabled={toggles.showCloudSync} onChange={setToggle('showCloudSync')} />
              <Toggle label="Config Changes" enabled={toggles.showConfigChanges} onChange={setToggle('showConfigChanges')} />
            </div>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!hasData && (
        <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-all group">
          <Database size={48} className="text-slate-200 group-hover:text-brand/30 mx-auto mb-4 transition-colors" />
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter mb-2">Drop Log Files Here</h3>
          <p className="text-sm text-slate-400 mb-2">Or click to browse. Multiple files supported.</p>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Accepts .txt &nbsp;·&nbsp; .log &nbsp;·&nbsp; .csv</p>
        </div>
      )}

      {/* Ingest results */}
      {showResults && ingestResults.length > 0 && (
        <div className="bg-slate-900 rounded-2xl p-6 space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Parse Results</h4>
            <button onClick={() => setShowResults(false)}><X size={16} className="text-slate-400" /></button>
          </div>
          {ingestResults.map((r, i) => (
            <div key={i} className={`flex items-center justify-between px-4 py-3 rounded-xl ${r.ok ? 'bg-emerald-500/10' : 'bg-red-500/20'}`}>
              <span className="text-xs font-bold text-slate-300">{r.filename}</span>
              <span className={`text-[10px] font-black uppercase ${r.ok ? 'text-emerald-400' : 'text-red-400'}`}>{r.msg}</span>
            </div>
          ))}
        </div>
      )}

      {hasData && (
        <>
          {/* Devices */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center"><Cpu size={16} className="text-white" /></div>
                <div>
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Devices</h3>
                  <p className="text-[10px] text-slate-400 font-bold">Hover to set a friendly name</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase">{devices.length} device{devices.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="px-8 pb-6 space-y-3">
              {devices.map(device => {
                const uptime = sysAnalytics.uptimeByDevice[device.id];
                return (
                  <div key={device.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${uptime ? (parseFloat(uptime.uptimePct) > 95 ? 'bg-emerald-400' : parseFloat(uptime.uptimePct) > 80 ? 'bg-amber-400' : 'bg-red-400') : 'bg-slate-300'}`} />
                      <div className="min-w-0">
                        {editingDeviceId === device.id ? (
                          <div className="flex items-center gap-2">
                            <input autoFocus className="px-3 py-1.5 bg-white border-2 border-brand rounded-xl text-sm font-bold outline-none w-48" value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { setDevices(p => p.map(d => d.id === device.id ? { ...d, friendlyName: editName } : d)); setEditingDeviceId(null); } if (e.key === 'Escape') setEditingDeviceId(null); }}
                              placeholder="e.g. Main Floor Safe" />
                            <button onClick={() => { setDevices(p => p.map(d => d.id === device.id ? { ...d, friendlyName: editName } : d)); setEditingDeviceId(null); }} className="p-1.5 bg-brand text-white rounded-lg"><Save size={13} /></button>
                            <button onClick={() => setEditingDeviceId(null)} className="p-1.5 text-slate-400 rounded-lg"><X size={13} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">{device.friendlyName || <span className="text-slate-400 italic font-medium">Unnamed</span>}</span>
                            <button onClick={() => { setEditingDeviceId(device.id); setEditName(device.friendlyName); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-brand transition-all"><Edit2 size={13} /></button>
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-[10px] font-mono text-slate-400">{device.id}</p>
                          {uptime && <span className={`text-[9px] font-black ${parseFloat(uptime.uptimePct) > 95 ? 'text-emerald-500' : 'text-amber-500'}`}>{uptime.uptimePct}% uptime</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4 text-[10px] text-slate-400 shrink-0">
                      {device.firmware && <span>FW {device.firmware}</span>}
                      {device.ipAddress && <span className="font-mono">{device.ipAddress}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Access Events" value={analytics.total} sub={`${analytics.successes} granted · ${analytics.failures} failed${analytics.incomplete > 0 ? ` · ${analytics.incomplete} incomplete` : ''}`} icon={<Activity size={20} />} />
            <StatCard label="Success Rate" value={`${analytics.successRate}%`} icon={<CheckCircle2 size={20} />} color="text-emerald-500" />
            {analytics.incomplete > 0 && (
              <StatCard label="Incomplete" value={analytics.incomplete} sub="log truncated mid-auth" icon={<Clock size={20} />} color="text-amber-500" />
            )}
            {overallUptime !== null
              ? <StatCard label="Avg Uptime" value={`${overallUptime}%`} sub={`${sysAnalytics.mqttDrops.length} disconnects`} icon={<Wifi size={20} />} color={parseFloat(overallUptime) > 95 ? 'text-emerald-500' : 'text-amber-500'} />
              : <StatCard label="System Events" value={totalSystemEvents} sub="healthchecks, syncs, etc" icon={<Heart size={20} />} color="text-purple-500" />
            }
            <StatCard label="Unique Users" value={analytics.uniqueUsers} sub="by credential ID" icon={<Users size={20} />} color="text-blue-500" />
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2"><Filter size={14} className="text-slate-400" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filters</span></div>
              <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand" value={filterDevice} onChange={e => setFilterDevice(e.target.value)}>
                <option value="all">All Devices</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.friendlyName || d.id}</option>)}
              </select>
              <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand" value={filterResult} onChange={e => setFilterResult(e.target.value as 'all' | 'success' | 'failure' | 'incomplete')}>
                <option value="all">All Results</option>
                <option value="success">Successful Only</option>
                <option value="failure">Failed Only</option>
                <option value="incomplete">Incomplete Only</option>
              </select>
              <input type="date" className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
              <span className="text-slate-300">→</span>
              <input type="date" className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
              {(filterDevice !== 'all' || filterResult !== 'all' || filterStart || filterEnd) && (
                <button onClick={() => { setFilterDevice('all'); setFilterResult('all'); setFilterStart(''); setFilterEnd(''); }} className="flex items-center gap-1 text-[10px] font-black text-brand uppercase"><X size={12} /> Clear</button>
              )}
              <span className="ml-auto text-[10px] font-black text-slate-400 uppercase">{filtered.length} events</span>
            </div>
          </div>

          {/* ── ACCESS ANALYTICS ────────────────────────────────────────────── */}

          {toggles.showTimeline && analytics.timeline.length > 0 && (
            <Section title="Access Timeline">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analytics.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="success" stackId="1" stroke="#10b981" fill="#d1fae5" name="Success" />
                  <Area type="monotone" dataKey="failure" stackId="1" stroke="#ef4444" fill="#fee2e2" name="Failure" />
                </AreaChart>
              </ResponsiveContainer>
            </Section>
          )}

          {toggles.showAuthBreakdown && analytics.pieData.length > 0 && (
            <Section title="Authentication Method Breakdown">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={analytics.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                      {analytics.pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 self-center">
                  {analytics.pieData.map(entry => (
                    <div key={entry.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: entry.color }} />
                        <span className="text-xs font-bold text-slate-700">{entry.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {toggles.showFailedAttempts && analytics.failures > 0 && (
            <Section title={`Failed & Incomplete Attempts`} badge={`${analytics.failures + analytics.incomplete}`} badgeColor="bg-red-100 text-red-600">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Device</th><th className="pb-3 pr-4">Auth Type</th><th className="pb-3 pr-4">User ID</th><th className="pb-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.filter(e => e.result === 'failure' || e.result === 'incomplete').slice(0, 100).map((e, i) => (
                      <tr key={i} className="hover:bg-red-50/50 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{fmtDate(e.occurred_at)}</td>
                        <td className="py-2.5 pr-4 font-bold text-slate-700">{deviceName(e.device_id)}</td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase" style={{ background: (AUTH_COLORS[e.auth_type] || '#94a3b8') + '20', color: AUTH_COLORS[e.auth_type] || '#94a3b8' }}>{e.auth_type}</span>
                            {e.result === 'incomplete' && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-amber-100 text-amber-700">Incomplete</span>}
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{e.user_id_raw || '—'}</td>
                        <td className="py-2.5 text-slate-400">{e.result === 'incomplete' ? 'Log truncated mid-session' : (e.failure_reason || '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {toggles.showUserActivity && analytics.userActivity.length > 0 && (
            <Section title="User Activity">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">User ID</th><th className="pb-3 pr-4">Total</th><th className="pb-3 pr-4">Success</th><th className="pb-3 pr-4">Failed</th><th className="pb-3 pr-4">Rate</th><th className="pb-3">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.userActivity.map((u, i) => {
                      const rate = ((u.success / u.total) * 100).toFixed(0);
                      return (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-4 font-mono font-bold text-slate-700">{u.userId}</td>
                          <td className="py-2.5 pr-4 font-black">{u.total}</td>
                          <td className="py-2.5 pr-4 text-emerald-600 font-bold">{u.success}</td>
                          <td className="py-2.5 pr-4 text-red-500 font-bold">{u.failure}</td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rate}%` }} /></div>
                              <span className="font-black text-slate-600">{rate}%</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-slate-400 font-mono">{fmtDate(u.lastSeen)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {toggles.showDoorDuration && filtered.some(e => e.door_open_ms) && (
            <Section title="Door Open Duration">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Average', value: fmtDuration(analytics.avgDuration) },
                  { label: 'Min', value: fmtDuration(Math.min(...filtered.filter(e => e.door_open_ms).map(e => e.door_open_ms!))) },
                  { label: 'Max', value: fmtDuration(Math.max(...filtered.filter(e => e.door_open_ms).map(e => e.door_open_ms!))) },
                  { label: 'Recorded', value: filtered.filter(e => e.door_open_ms).length },
                ].map(s => (
                  <div key={s.label} className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                    <p className="text-xl font-black text-slate-900">{s.value}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* ── SYSTEM & NETWORK ────────────────────────────────────────────── */}

          {toggles.showUptimeSummary && Object.keys(sysAnalytics.uptimeByDevice).length > 0 && (
            <Section title="Connection Uptime" badge={overallUptime ? `${overallUptime}% avg` : undefined} badgeColor={overallUptime && parseFloat(overallUptime) > 95 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
              <div className="space-y-6">
                {devices.map(device => {
                  const uptime = sysAnalytics.uptimeByDevice[device.id];
                  if (!uptime) return null;
                  const pct = parseFloat(uptime.uptimePct);
                  return (
                    <div key={device.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-black text-slate-900 text-sm">{device.friendlyName || device.id}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{device.id}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-black ${pct > 95 ? 'text-emerald-500' : pct > 80 ? 'text-amber-500' : 'text-red-500'}`}>{uptime.uptimePct}%</p>
                          <p className="text-[10px] text-slate-400">{uptime.disconnects} disconnect{uptime.disconnects !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct > 95 ? 'bg-emerald-400' : pct > 80 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${uptime.uptimePct}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Uptime</p>
                          <p className="text-sm font-black text-slate-900">{fmtDuration(uptime.uptimeMs)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Downtime</p>
                          <p className="text-sm font-black text-red-500">{fmtDuration(uptime.downtimeMs)}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Log Span</p>
                          <p className="text-sm font-black text-slate-900">{fmtDuration(uptime.spanMs)}</p>
                        </div>
                      </div>
                      {uptime.gaps.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Outage Periods</p>
                          {uptime.gaps.map((gap, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs">
                              <span className="font-mono text-slate-500">{fmtDate(gap.start)}</span>
                              <span className="text-red-500 font-black">↓ {fmtDuration(gap.durationMs)}</span>
                              <span className="font-mono text-slate-500">{fmtDate(gap.end)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {toggles.showMqttEvents && sysAnalytics.mqttDrops.length > 0 && (
            <Section title="MQTT / Network Events" badge={`${sysAnalytics.mqttDrops.length} disconnects`} badgeColor="bg-amber-100 text-amber-700" defaultOpen={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Device</th><th className="pb-3 pr-4">Event</th><th className="pb-3">Details</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.mqttEvents.slice(0, 100).map((e, i) => (
                      <tr key={i} className={e.event_type === 'mqtt_disconnect' ? 'bg-red-50/40' : ''}>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{fmtDate(e.occurred_at)}</td>
                        <td className="py-2.5 pr-4 font-bold text-slate-700">{deviceName(e.device_id)}</td>
                        <td className="py-2.5 pr-4"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${e.event_type === 'mqtt_disconnect' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>{e.event_type === 'mqtt_disconnect' ? 'Disconnect' : 'Connect'}</span></td>
                        <td className="py-2.5 text-slate-400">{e.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {toggles.showReboots && sysAnalytics.reboots.length > 0 && (
            <Section title="Reboots" badge={`${sysAnalytics.reboots.length} total${sysAnalytics.errorReboots.length > 0 ? ` · ${sysAnalytics.errorReboots.length} errors` : ''}`} badgeColor={sysAnalytics.errorReboots.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'} defaultOpen={false}>
              {sysAnalytics.errorReboots.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                  <AlertTriangle size={16} className="text-red-500" /><span className="text-xs font-black text-red-700">{sysAnalytics.errorReboots.length} error-triggered reboots — hardware review recommended.</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Device</th><th className="pb-3 pr-4">Type</th><th className="pb-3">Details</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.reboots.map((e, i) => (
                      <tr key={i} className={e.event_type === 'reboot_error' ? 'bg-red-50/50' : ''}>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{fmtDate(e.occurred_at)}</td>
                        <td className="py-2.5 pr-4 font-bold text-slate-700">{deviceName(e.device_id)}</td>
                        <td className="py-2.5 pr-4"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${e.event_type === 'reboot_error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{e.event_type.replace('reboot_', '')}</span></td>
                        <td className="py-2.5 text-slate-400">{e.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {toggles.showHealthchecks && sysAnalytics.healthchecks.length > 0 && (
            <Section title="Health Checks" badge={`${sysAnalytics.healthchecks.length}`} defaultOpen={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Device</th><th className="pb-3">Field Support Data</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.healthchecks.map((e, i) => (
                      <tr key={i}>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{fmtDate(e.occurred_at)}</td>
                        <td className="py-2.5 pr-4 font-bold text-slate-700">{deviceName(e.device_id)}</td>
                        <td className="py-2.5 font-mono text-slate-400 text-[10px]">{e.details.replace('FIELD SUPPORT DATA: ', '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {toggles.showCloudSync && (sysAnalytics.cloudSyncs.length > 0 || sysAnalytics.syncSkips.length > 0) && (
            <Section title="Cloud Sync Events" badge={`${sysAnalytics.cloudSyncs.length} synced · ${sysAnalytics.syncSkips.length} skipped`} defaultOpen={false}>
              {sysAnalytics.syncSkips.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                  <span className="font-black">{sysAnalytics.syncSkips.length} sync{sysAnalytics.syncSkips.length !== 1 ? 's' : ''} skipped</span> — device opened too recently relative to syncAfterOpen threshold.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Device</th><th className="pb-3 pr-4">Type</th><th className="pb-3">Details</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...sysAnalytics.cloudSyncs, ...sysAnalytics.syncSkips].sort((a,b) => a.occurred_at.localeCompare(b.occurred_at)).map((e, i) => (
                      <tr key={i} className={e.event_type === 'sync_skipped' ? 'bg-amber-50/40' : ''}>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{fmtDate(e.occurred_at)}</td>
                        <td className="py-2.5 pr-4 font-bold text-slate-700">{deviceName(e.device_id)}</td>
                        <td className="py-2.5 pr-4"><span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${e.event_type === 'sync_skipped' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{e.event_type === 'sync_skipped' ? 'Skipped' : 'Synced'}</span></td>
                        <td className="py-2.5 text-slate-400">{e.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {toggles.showConfigChanges && sysAnalytics.configChanges.length > 0 && (
            <Section title="Config Changes" badge={`${sysAnalytics.configChanges.length}`} defaultOpen={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Device</th><th className="pb-3">Details</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.configChanges.map((e, i) => (
                      <tr key={i}>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{fmtDate(e.occurred_at)}</td>
                        <td className="py-2.5 pr-4 font-bold text-slate-700">{deviceName(e.device_id)}</td>
                        <td className="py-2.5 text-slate-400">{e.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Loaded Files */}
          <Section title={`Loaded Files (${imports.length})`} defaultOpen={false}>
            <div className="space-y-2">
              {imports.map(imp => (
                <div key={imp.filename} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-slate-400" />
                    <div>
                      <p className="font-mono font-bold text-slate-700 text-xs">{imp.filename}</p>
                      <p className="text-[10px] text-slate-400">{deviceName(imp.deviceId)} · {imp.accessEvents.length} access · {imp.systemEvents.length} system · {imp.lineCount} lines</p>
                    </div>
                  </div>
                  <button onClick={() => setImports(p => p.filter(i => i.filename !== imp.filename))} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Export Report</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{allAccess.length} access · {allSystem.length} system · {devices.length} devices</p>
              </div>
              <button onClick={() => setShowExportModal(false)}><X size={22} className="text-slate-400 hover:text-black" /></button>
            </div>
            <div className="p-8 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Title</label>
                <input className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all" value={exportTitle} onChange={e => setExportTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prepared By</label>
                <input className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all" value={exportAnalyst} onChange={e => setExportAnalyst(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes (optional)</label>
                <textarea className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all resize-none h-20" placeholder="Context or observations for the report..." value={exportNotes} onChange={e => setExportNotes(e.target.value)} />
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sections included in PDF</p>
                {[
                  { key: 'showTimeline', label: 'Access Timeline' },
                  { key: 'showAuthBreakdown', label: 'Auth Method Breakdown' },
                  { key: 'showUserActivity', label: 'User Activity' },
                  { key: 'showFailedAttempts', label: `Failed & Incomplete (${analytics.failures + analytics.incomplete})` },
                  { key: 'showUptimeSummary', label: 'Connection Uptime' },
                  { key: 'showMqttEvents', label: `MQTT Events (${sysAnalytics.mqttDrops.length} drops)` },
                  { key: 'showReboots', label: `Reboots (${sysAnalytics.reboots.length})` },
                  { key: 'showHealthchecks', label: `Health Checks (${sysAnalytics.healthchecks.length})` },
                  { key: 'showCloudSync', label: `Cloud Sync (${sysAnalytics.cloudSyncs.length + sysAnalytics.syncSkips.length} events)` },
                  { key: 'showConfigChanges', label: `Config Changes (${sysAnalytics.configChanges.length})` },
                ].filter(item => {
                  // only show items that have data
                  if (item.key === 'showMqttEvents' && sysAnalytics.mqttDrops.length === 0) return false;
                  if (item.key === 'showReboots' && sysAnalytics.reboots.length === 0) return false;
                  if (item.key === 'showHealthchecks' && sysAnalytics.healthchecks.length === 0) return false;
                  if (item.key === 'showCloudSync' && sysAnalytics.cloudSyncs.length === 0 && sysAnalytics.syncSkips.length === 0) return false;
                  if (item.key === 'showConfigChanges' && sysAnalytics.configChanges.length === 0) return false;
                  return true;
                }).map(item => (
                  <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-brand" checked={toggles[item.key as keyof DisplayToggles]} onChange={e => setToggle(item.key as keyof DisplayToggles)(e.target.checked)} />
                    <span className="text-xs text-slate-600">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-8 py-5 bg-slate-50 border-t flex items-center justify-between">
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                <FileText size={14} /> Export CSV
              </button>
              <div className="flex gap-3">
                <button onClick={() => setShowExportModal(false)} className="px-5 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Cancel</button>
                <button onClick={handleExportPDF} disabled={isExporting} className="flex items-center gap-2 px-8 py-3 bg-brand text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50">
                  {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                  {isExporting ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
