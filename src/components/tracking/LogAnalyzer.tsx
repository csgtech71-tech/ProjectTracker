import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Upload, Activity, AlertTriangle, CheckCircle2, Users, RefreshCw,
  Trash2, ChevronDown, ChevronUp, X, Database, Cpu, Edit2, Save,
  Filter, FileText, Download,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { parseLogFile } from '../../parsers/logParser';
import type { AccessEvent, SystemEvent, AppUser, GlobalSettings } from '../../types';
import { exportPDF, exportCSV } from '../../services/exportReport';

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
  lastSeen?: string;
  certExpires?: string;
}

interface ImportedFile {
  filename: string;
  deviceId: string;
  accessEvents: AccessEvent[];
  systemEvents: SystemEvent[];
  lineCount: number;
}

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
        <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">{title}</h3>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-8 pb-8">{children}</div>}
    </div>
  );
};

export const LogAnalyzer: React.FC<Props> = ({ currentUser, globalSettings }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── core data state ─────────────────────────────────────────────────────────
  const [imports, setImports] = useState<ImportedFile[]>([]);
  const [devices, setDevices] = useState<LocalDevice[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestResults, setIngestResults] = useState<{ filename: string; ok: boolean; msg: string }[]>([]);
  const [showResults, setShowResults] = useState(false);

  // ── filters ─────────────────────────────────────────────────────────────────
  const [filterDevice, setFilterDevice] = useState('all');
  const [filterResult, setFilterResult] = useState<'all' | 'success' | 'failure'>('all');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');

  // ── device name editing ─────────────────────────────────────────────────────
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // ── export modal ─────────────────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTitle, setExportTitle] = useState('Device Access & Analytics Report');
  const [exportAnalyst, setExportAnalyst] = useState(currentUser.username);
  const [exportNotes, setExportNotes] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // ── derived ─────────────────────────────────────────────────────────────────
  const allAccess = useMemo(() => imports.flatMap(i => i.accessEvents), [imports]);
  const allSystem = useMemo(() => imports.flatMap(i => i.systemEvents), [imports]);

  const filtered = useMemo(() => {
    return allAccess.filter(e => {
      if (filterDevice !== 'all' && e.device_id !== filterDevice) return false;
      if (filterResult !== 'all' && e.result !== filterResult) return false;
      if (filterStart && e.occurred_at < filterStart) return false;
      if (filterEnd && e.occurred_at > filterEnd + 'T23:59:59') return false;
      return true;
    });
  }, [allAccess, filterDevice, filterResult, filterStart, filterEnd]);

  const analytics = useMemo(() => {
    const total = filtered.length;
    const successes = filtered.filter(e => e.result === 'success').length;
    const failures = filtered.filter(e => e.result === 'failure').length;
    const successRate = total > 0 ? ((successes / total) * 100).toFixed(1) : '0';
    const durations = filtered.filter(e => e.door_open_ms && e.door_open_ms > 0).map(e => e.door_open_ms!);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const uniqueUsers = new Set(filtered.filter(e => e.user_id_raw).map(e => e.user_id_raw)).size;

    const methodCounts: Record<string, number> = {};
    for (const e of filtered) {
      const key = e.auth_type || 'Unknown';
      methodCounts[key] = (methodCounts[key] || 0) + 1;
    }
    const pieData = Object.entries(methodCounts).map(([name, value]) => ({
      name, value, color: AUTH_COLORS[name] || '#94a3b8',
    }));

    const timeline = groupByDay(filtered);

    const userMap: Record<string, { userId: string; total: number; success: number; failure: number; lastSeen: string }> = {};
    for (const e of filtered) {
      const uid = e.user_id_raw || 'Unknown';
      if (!userMap[uid]) userMap[uid] = { userId: uid, total: 0, success: 0, failure: 0, lastSeen: e.occurred_at };
      userMap[uid].total++;
      if (e.result === 'success') userMap[uid].success++;
      else userMap[uid].failure++;
      if (e.occurred_at > userMap[uid].lastSeen) userMap[uid].lastSeen = e.occurred_at;
    }
    const userActivity = Object.values(userMap).sort((a, b) => b.total - a.total);

    return { total, successes, failures, successRate, avgDuration, uniqueUsers, pieData, timeline, userActivity };
  }, [filtered]);

  const sysAnalytics = useMemo(() => ({
    reboots: allSystem.filter(e => ['reboot_normal', 'reboot_error', 'reboot_watchdog'].includes(e.event_type)),
    errorReboots: allSystem.filter(e => e.event_type === 'reboot_error'),
    mqttDrops: allSystem.filter(e => e.event_type === 'mqtt_disconnect'),
  }), [allSystem]);

  const deviceName = (id: string) => {
    const d = devices.find(d => d.id === id);
    return d?.friendlyName || id.slice(0, 8) + '…';
  };

  // ── file ingestion ───────────────────────────────────────────────────────────
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsIngesting(true);
    setShowResults(false);

    const results: { filename: string; ok: boolean; msg: string }[] = [];
    const newImports: ImportedFile[] = [];
    const newDevices: LocalDevice[] = [];

    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = parseLogFile(text);

        if (parsed.deviceIds.length === 0) {
          results.push({ filename: file.name, ok: false, msg: 'No device ID detected.' });
          continue;
        }

        const deviceId = parsed.deviceIds[0];
        newImports.push({
          filename: file.name,
          deviceId,
          accessEvents: parsed.accessEvents,
          systemEvents: parsed.systemEvents,
          lineCount: parsed.lineCount,
        });

        setDevices(prev => {
          const exists = prev.find(d => d.id === deviceId);
          if (exists) {
            return prev.map(d => d.id === deviceId ? {
              ...d,
              firmware: parsed.firmware || d.firmware,
              ipAddress: parsed.ipAddress || d.ipAddress,
              wifiSsid: parsed.wifiSsid || d.wifiSsid,
            } : d);
          }
          newDevices.push({ id: deviceId, friendlyName: '', firmware: parsed.firmware, ipAddress: parsed.ipAddress, wifiSsid: parsed.wifiSsid });
          return prev;
        });

        results.push({
          filename: file.name,
          ok: true,
          msg: `${parsed.accessEvents.length} access events, ${parsed.systemEvents.length} system events`,
        });
      } catch (e) {
        results.push({ filename: file.name, ok: false, msg: e instanceof Error ? e.message : 'Parse failed.' });
      }
    }

    setImports(prev => [...prev, ...newImports]);
    if (newDevices.length > 0) setDevices(prev => [...prev, ...newDevices]);
    setIngestResults(results);
    setShowResults(true);
    setIsIngesting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFiles(Array.from(e.target.files ?? []));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.txt') || f.name.endsWith('.log')));
  };

  const removeImport = (filename: string) => setImports(prev => prev.filter(i => i.filename !== filename));

  const clearAll = () => {
    setImports([]); setDevices([]); setIngestResults([]); setShowResults(false);
    setFilterDevice('all'); setFilterResult('all'); setFilterStart(''); setFilterEnd('');
  };

  // ── export handlers ──────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      exportPDF({
        accessEvents: allAccess,
        systemEvents: allSystem,
        devices,
        filenames: imports.map(i => i.filename),
        settings: globalSettings,
        analystName: exportAnalyst,
        reportTitle: exportTitle,
        notes: exportNotes,
      });
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setTimeout(() => setIsExporting(false), 1500);
    }
  };

  const handleExportCSV = () => {
    exportCSV(allAccess, allSystem, devices, globalSettings.companyName || 'MedixSafe');
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">Log Analyzer</h2>
          <p className="text-sm text-slate-500 font-medium italic">Standalone log analysis — no project required. Data stays in your browser session.</p>
        </div>
        <div className="flex gap-2">
          {imports.length > 0 && (
            <button onClick={clearAll} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all">
              <Trash2 size={14} /> Clear All
            </button>
          )}
          {imports.length > 0 && (
            <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all">
              <Download size={16} /> Export Report
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".txt,.log" multiple className="hidden" onChange={handleInputChange} />
          <button onClick={() => fileInputRef.current?.click()} disabled={isIngesting} className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all disabled:opacity-50">
            {isIngesting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
            {isIngesting ? 'Parsing...' : 'Import Logs'}
          </button>
        </div>
      </div>

      {/* Drop zone */}
      {imports.length === 0 && (
        <div
          onDrop={handleDrop} onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-all group"
        >
          <Database size={48} className="text-slate-200 group-hover:text-brand/30 mx-auto mb-4 transition-colors" />
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter mb-2">Drop Log Files Here</h3>
          <p className="text-sm text-slate-400">Or click to browse. Accepts <code className="bg-slate-100 px-1 rounded">.txt</code> and <code className="bg-slate-100 px-1 rounded">.log</code> files. Multiple files supported.</p>
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-4">Session only — nothing is saved to the database</p>
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

      {imports.length > 0 && (
        <>
          {/* Devices */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center"><Cpu size={16} className="text-white" /></div>
                <div>
                  <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Devices</h3>
                  <p className="text-[10px] text-slate-400 font-bold">Hover a device to give it a friendly name</p>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase">{devices.length} device{devices.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="px-8 pb-6 space-y-3">
              {devices.map(device => (
                <div key={device.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shrink-0" />
                    <div className="min-w-0">
                      {editingDeviceId === device.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            className="px-3 py-1.5 bg-white border-2 border-brand rounded-xl text-sm font-bold outline-none w-48"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { setDevices(prev => prev.map(d => d.id === device.id ? { ...d, friendlyName: editName } : d)); setEditingDeviceId(null); }
                              if (e.key === 'Escape') setEditingDeviceId(null);
                            }}
                            placeholder="e.g. Main Floor Safe"
                          />
                          <button onClick={() => { setDevices(prev => prev.map(d => d.id === device.id ? { ...d, friendlyName: editName } : d)); setEditingDeviceId(null); }} className="p-1.5 bg-brand text-white rounded-lg">
                            <Save size={13} />
                          </button>
                          <button onClick={() => setEditingDeviceId(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"><X size={13} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">{device.friendlyName || <span className="text-slate-400 italic font-medium">Unnamed</span>}</span>
                          <button onClick={() => { setEditingDeviceId(device.id); setEditName(device.friendlyName); }} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-brand transition-all">
                            <Edit2 size={13} />
                          </button>
                        </div>
                      )}
                      <p className="text-[10px] font-mono text-slate-400">{device.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-[10px] text-slate-400 shrink-0">
                    {device.firmware && <span>FW {device.firmware}</span>}
                    {device.ipAddress && <span className="font-mono">{device.ipAddress}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filters</span>
              </div>
              <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand" value={filterDevice} onChange={e => setFilterDevice(e.target.value)}>
                <option value="all">All Devices</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.friendlyName || d.id}</option>)}
              </select>
              <select className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand" value={filterResult} onChange={e => setFilterResult(e.target.value as 'all' | 'success' | 'failure')}>
                <option value="all">All Results</option>
                <option value="success">Successful Only</option>
                <option value="failure">Failed Only</option>
              </select>
              <input type="date" className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand" value={filterStart} onChange={e => setFilterStart(e.target.value)} />
              <span className="text-slate-300">→</span>
              <input type="date" className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} />
              {(filterDevice !== 'all' || filterResult !== 'all' || filterStart || filterEnd) && (
                <button onClick={() => { setFilterDevice('all'); setFilterResult('all'); setFilterStart(''); setFilterEnd(''); }} className="flex items-center gap-1 text-[10px] font-black text-brand uppercase tracking-widest">
                  <X size={12} /> Clear
                </button>
              )}
              <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">{filtered.length} events</span>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Entries" value={analytics.total} icon={<Activity size={20} />} />
            <StatCard label="Success Rate" value={`${analytics.successRate}%`} sub={`${analytics.successes} successful`} icon={<CheckCircle2 size={20} />} color="text-emerald-500" />
            <StatCard label="Failed Attempts" value={analytics.failures} sub={analytics.failures > 0 ? 'Review below' : 'None detected'} icon={<AlertTriangle size={20} />} color={analytics.failures > 0 ? 'text-red-500' : 'text-slate-400'} />
            <StatCard label="Unique Users" value={analytics.uniqueUsers} sub="by device user ID" icon={<Users size={20} />} color="text-blue-500" />
          </div>

          {/* Timeline */}
          {analytics.timeline.length > 0 && (
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

          {/* Auth Method Breakdown */}
          {analytics.pieData.length > 0 && (
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
                        <div className="w-3 h-3 rounded-full" style={{ background: entry.color }} />
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
          {analytics.failures > 0 && (
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
                    {filtered.filter(e => e.result === 'failure').slice(0, 100).map((e, i) => (
                      <tr key={i} className="hover:bg-red-50/50 transition-colors">
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{fmtDate(e.occurred_at)}</td>
                        <td className="py-2.5 pr-4 font-bold text-slate-700">{deviceName(e.device_id)}</td>
                        <td className="py-2.5 pr-4">
                          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase" style={{ background: (AUTH_COLORS[e.auth_type] || '#94a3b8') + '20', color: AUTH_COLORS[e.auth_type] || '#94a3b8' }}>
                            {e.auth_type}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{e.user_id_raw || '—'}</td>
                        <td className="py-2.5 text-slate-400">{e.failure_reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* User Activity */}
          {analytics.userActivity.length > 0 && (
            <Section title="User Activity">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">User ID</th>
                      <th className="pb-3 pr-4">Total</th>
                      <th className="pb-3 pr-4">Success</th>
                      <th className="pb-3 pr-4">Failures</th>
                      <th className="pb-3 pr-4">Rate</th>
                      <th className="pb-3">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analytics.userActivity.map((u, i) => {
                      const rate = ((u.success / u.total) * 100).toFixed(0);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pr-4 font-mono font-bold text-slate-700">{u.userId}</td>
                          <td className="py-2.5 pr-4 font-black">{u.total}</td>
                          <td className="py-2.5 pr-4 text-emerald-600 font-bold">{u.success}</td>
                          <td className="py-2.5 pr-4 text-red-500 font-bold">{u.failure}</td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${rate}%` }} />
                              </div>
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

          {/* Door Duration */}
          {filtered.some(e => e.door_open_ms) && (
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

          {/* MQTT */}
          {sysAnalytics.mqttDrops.length > 0 && (
            <Section title={`Network Events — ${sysAnalytics.mqttDrops.length} MQTT Disconnects`} defaultOpen={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Device</th><th className="pb-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.mqttDrops.map((e, i) => (
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

          {/* Reboots */}
          {sysAnalytics.reboots.length > 0 && (
            <Section title={`Reboots — ${sysAnalytics.reboots.length} total, ${sysAnalytics.errorReboots.length} error reboots`} defaultOpen={false}>
              {sysAnalytics.errorReboots.length > 0 && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
                  <AlertTriangle size={16} className="text-red-500" />
                  <span className="text-xs font-black text-red-700">{sysAnalytics.errorReboots.length} error-triggered reboots detected.</span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="pb-3 pr-4">Time</th><th className="pb-3 pr-4">Device</th><th className="pb-3 pr-4">Type</th><th className="pb-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sysAnalytics.reboots.map((e, i) => (
                      <tr key={i} className={e.event_type === 'reboot_error' ? 'bg-red-50/50' : ''}>
                        <td className="py-2.5 pr-4 font-mono text-slate-500">{fmtDate(e.occurred_at)}</td>
                        <td className="py-2.5 pr-4 font-bold text-slate-700">{deviceName(e.device_id)}</td>
                        <td className="py-2.5 pr-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${e.event_type === 'reboot_error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                            {e.event_type.replace('reboot_', '')}
                          </span>
                        </td>
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
                  <button onClick={() => removeImport(imp.filename)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                    <Trash2 size={14} />
                  </button>
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
                <p className="text-[10px] text-slate-400 mt-0.5">{allAccess.length} access events · {allSystem.length} system events · {devices.length} devices</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-black"><X size={22} /></button>
            </div>

            <div className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Title</label>
                <input className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all" value={exportTitle} onChange={e => setExportTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prepared By</label>
                <input className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold outline-none focus:border-brand transition-all" value={exportAnalyst} onChange={e => setExportAnalyst(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Notes (optional)</label>
                <textarea className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all resize-none h-24" placeholder="Add any context or observations..." value={exportNotes} onChange={e => setExportNotes(e.target.value)} />
              </div>
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">What's included</p>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" /> Cover page with KPI summary and device list</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" /> Daily access timeline chart</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" /> Authentication method distribution</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" /> Full user activity table</li>
                  {allAccess.filter(e => e.result === 'failure').length > 0 && (
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" /> Failed attempts ({allAccess.filter(e => e.result === 'failure').length} events)</li>
                  )}
                  {sysAnalytics.reboots.length > 0 && (
                    <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" /> System & network events</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="px-8 py-5 bg-slate-50 border-t flex items-center justify-between">
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                <FileText size={14} /> Export CSV
              </button>
              <div className="flex gap-3">
                <button onClick={() => setShowExportModal(false)} className="px-5 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
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
