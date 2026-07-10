import React, { useState, useMemo, useRef } from 'react';
import {
  AlertTriangle, Plus, X, ChevronDown, ChevronUp, Edit3, Trash2,
  Save, Shield, TrendingUp, TrendingDown, Minus, CheckCircle2,
  Download, Filter, RefreshCw, BookOpen,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Project, AppUser } from '../../types';

// ─── types ────────────────────────────────────────────────────────────────────

type Probability = 'Low' | 'Medium' | 'High';
type Impact = 'Low' | 'Medium' | 'High';
type RiskStatus = 'Identified' | 'Under Review' | 'Mitigation In Progress' | 'Mitigated' | 'Accepted' | 'Closed';
type RiskCategory =
  | 'Project Management' | 'Customer Availability' | 'Facilities' | 'Training'
  | 'Technical' | 'Hardware' | 'Network / Security' | 'Configuration'
  | 'Data / Migration' | 'Scheduling' | 'Operational Adoption'
  | 'External Dependency' | 'Other';
type RiskOwner =
  | 'MedixSafe Project Manager' | 'Customer Project Manager' | 'Customer IT'
  | 'Customer Operations' | 'Vendor' | 'Other';

export interface Risk {
  id: string;
  riskId: string;
  dateIdentified: string;
  identifiedBy: 'MedixSafe' | 'Customer' | 'Automated';
  category: RiskCategory;
  description: string;
  potentialImpact: string;
  mitigationPlan: string;
  contingencyPlan: string;
  probability: Probability;
  impact: Impact;
  owner: RiskOwner;
  responsibleParty: string;
  status: RiskStatus;
  notes: string;
  closedDate?: string;
}

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
  currentUser: AppUser;
}

// ─── risk scoring ─────────────────────────────────────────────────────────────

const SCORE_MAP: Record<Probability, Record<Impact, { label: string; color: string; bg: string }>> = {
  Low:    { Low: { label: 'Low',      color: '#10b981', bg: '#d1fae5' }, Medium: { label: 'Low',      color: '#10b981', bg: '#d1fae5' }, High: { label: 'Medium',   color: '#f59e0b', bg: '#fef3c7' } },
  Medium: { Low: { label: 'Low',      color: '#10b981', bg: '#d1fae5' }, Medium: { label: 'Medium',   color: '#f59e0b', bg: '#fef3c7' }, High: { label: 'High',     color: '#ef4444', bg: '#fee2e2' } },
  High:   { Low: { label: 'Medium',   color: '#f59e0b', bg: '#fef3c7' }, Medium: { label: 'High',     color: '#ef4444', bg: '#fee2e2' }, High: { label: 'Critical', color: '#7c3aed', bg: '#ede9fe' } },
};

const STATUS_META: Record<RiskStatus, { color: string; dot: string }> = {
  'Identified':             { color: 'text-amber-600',  dot: 'bg-amber-400' },
  'Under Review':           { color: 'text-blue-600',   dot: 'bg-blue-400' },
  'Mitigation In Progress': { color: 'text-orange-600', dot: 'bg-orange-400' },
  'Mitigated':              { color: 'text-emerald-600',dot: 'bg-emerald-400' },
  'Accepted':               { color: 'text-slate-500',  dot: 'bg-slate-300' },
  'Closed':                 { color: 'text-slate-400',  dot: 'bg-slate-200' },
};

// ─── common risk templates ────────────────────────────────────────────────────

const COMMON_RISKS: { category: RiskCategory; description: string; impact: Impact; probability: Probability }[] = [
  { category: 'Project Management',  description: 'Customer stakeholders unavailable during key project phases',          impact: 'High',   probability: 'Medium' },
  { category: 'Project Management',  description: 'Delayed approvals or decisions impacting project timeline',            impact: 'Medium', probability: 'Medium' },
  { category: 'Project Management',  description: 'Scope changes requested after kickoff',                               impact: 'High',   probability: 'Low'    },
  { category: 'Project Management',  description: 'Project timeline conflicts with customer operational calendar',        impact: 'Medium', probability: 'Low'    },
  { category: 'Facilities',          description: 'Site access unavailable at scheduled activation date',                impact: 'High',   probability: 'Low'    },
  { category: 'Facilities',          description: 'Safe installation location not ready or requires modification',       impact: 'Medium', probability: 'Low'    },
  { category: 'Customer Availability', description: 'Activation schedule conflicts with customer shift structure',        impact: 'Medium', probability: 'Medium' },
  { category: 'Customer Availability', description: 'Customer resources unavailable for onsite support',                 impact: 'Medium', probability: 'Medium' },
  { category: 'Training',            description: 'End users unavailable for scheduled training sessions',               impact: 'High',   probability: 'Medium' },
  { category: 'Training',            description: 'Additional training required beyond initial scope',                   impact: 'Medium', probability: 'Medium' },
  { category: 'Training',            description: 'Staff turnover impacts trained personnel before go-live',             impact: 'High',   probability: 'Low'    },
  { category: 'Network / Security',  description: 'Network connectivity issues at deployment site',                      impact: 'High',   probability: 'Low'    },
  { category: 'Network / Security',  description: 'Firewall or security restrictions block device communication',        impact: 'High',   probability: 'Low'    },
  { category: 'Technical',           description: 'Hardware communication failure during activation',                    impact: 'High',   probability: 'Low'    },
  { category: 'Technical',           description: 'Configuration requirements change after initial setup',               impact: 'Medium', probability: 'Low'    },
  { category: 'Operational Adoption', description: 'Users resistant to new workflow changes',                            impact: 'Medium', probability: 'Medium' },
  { category: 'Operational Adoption', description: 'Existing processes require significant adjustment',                  impact: 'Medium', probability: 'Low'    },
  { category: 'Operational Adoption', description: 'Additional operational support required post-deployment',            impact: 'Low',    probability: 'Medium' },
];

// ─── blank risk ───────────────────────────────────────────────────────────────

const newBlankRisk = (existingCount: number): Risk => ({
  id: crypto.randomUUID(),
  riskId: `RISK-${String(existingCount + 1).padStart(3, '0')}`,
  dateIdentified: new Date().toISOString().split('T')[0],
  identifiedBy: 'MedixSafe',
  category: 'Project Management',
  description: '',
  potentialImpact: '',
  mitigationPlan: '',
  contingencyPlan: '',
  probability: 'Low',
  impact: 'Low',
  owner: 'MedixSafe Project Manager',
  responsibleParty: '',
  status: 'Identified',
  notes: '',
});

// ─── sub-components ───────────────────────────────────────────────────────────

const ScoreBadge: React.FC<{ probability: Probability; impact: Impact }> = ({ probability, impact }) => {
  const score = SCORE_MAP[probability][impact];
  return (
    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest"
      style={{ color: score.color, background: score.bg }}>
      {score.label}
    </span>
  );
};

const StatusBadge: React.FC<{ status: RiskStatus }> = ({ status }) => {
  const meta = STATUS_META[status];
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest ${meta.color}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
      {status}
    </span>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    {children}
  </div>
);

// ─── main component ───────────────────────────────────────────────────────────

export const ProjectRisk: React.FC<Props> = ({ project, onUpdate, currentUser }) => {
  const risks: Risk[] = (project as any).risks ?? [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Risk>(newBlankRisk(risks.length));
  const [showTemplates, setShowTemplates] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | RiskStatus>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | RiskCategory>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const saveRisks = (updated: Risk[]) => {
    onUpdate({ ...project, risks: updated } as any);
  };

  const handleOpenAdd = () => {
    setForm(newBlankRisk(risks.length));
    setEditingId(null);
    setShowForm(true);
    setShowTemplates(false);
  };

  const handleEdit = (risk: Risk) => {
    setForm({ ...risk });
    setEditingId(risk.id);
    setShowForm(true);
    setShowTemplates(false);
  };

  const handleSave = () => {
    if (!form.description.trim()) return;
    if (editingId) {
      saveRisks(risks.map(r => r.id === editingId ? form : r));
    } else {
      saveRisks([...risks, form]);
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this risk?')) return;
    saveRisks(risks.filter(r => r.id !== id));
  };

  const handleAddFromTemplate = (t: typeof COMMON_RISKS[0]) => {
    const risk: Risk = {
      ...newBlankRisk(risks.length),
      category: t.category,
      description: t.description,
      probability: t.probability,
      impact: t.impact,
      potentialImpact: '',
      mitigationPlan: '',
      contingencyPlan: '',
    };
    saveRisks([...risks, risk]);
  };

  const filtered = useMemo(() => risks.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    return true;
  }), [risks, filterStatus, filterCategory]);

  // Dashboard stats
  const stats = useMemo(() => ({
    total: risks.length,
    open: risks.filter(r => !['Mitigated', 'Accepted', 'Closed'].includes(r.status)).length,
    high: risks.filter(r => SCORE_MAP[r.probability][r.impact].label === 'High' || SCORE_MAP[r.probability][r.impact].label === 'Critical').length,
    closed: risks.filter(r => r.status === 'Closed').length,
    critical: risks.filter(r => SCORE_MAP[r.probability][r.impact].label === 'Critical').length,
  }), [risks]);

  // PDF export
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = 297; const margin = 15;

      // Header
      doc.setFillColor(15, 15, 15);
      doc.rect(0, 0, pageW, 18, 'F');
      doc.setFillColor(209, 41, 19);
      doc.rect(0, 18, pageW, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('MEDIXSAFE OPS', margin, 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Generated ${new Date().toLocaleDateString()}`, pageW - margin, 11, { align: 'right' });

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 15, 15);
      doc.text('Project Risk Register', margin, 32);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${project.customerName}  ·  ${project.title}  ·  Last Updated: ${new Date().toLocaleDateString()}`, margin, 39);

      // KPI row
      const kpis = [
        { label: 'Total Risks', value: stats.total.toString() },
        { label: 'Open', value: stats.open.toString() },
        { label: 'High / Critical', value: stats.high.toString() },
        { label: 'Closed', value: stats.closed.toString() },
      ];
      const kpiW = (pageW - margin * 2 - 9) / 4;
      kpis.forEach((k, i) => {
        const kx = margin + i * (kpiW + 3);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(kx, 44, kpiW, 16, 1.5, 1.5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(150, 150, 150);
        doc.text(k.label.toUpperCase(), kx + 4, 50);
        doc.setFontSize(14);
        doc.setTextColor(15, 15, 15);
        doc.text(k.value, kx + 4, 58);
      });

      // Risk table
      const exportRisks = filterStatus !== 'all' || filterCategory !== 'all' ? filtered : risks;
      autoTable(doc, {
        startY: 66,
        head: [['ID', 'Category', 'Risk Description', 'Probability', 'Impact', 'Rating', 'Mitigation Plan', 'Owner', 'Status']],
        body: exportRisks.map(r => [
          r.riskId,
          r.category,
          r.description,
          r.probability,
          r.impact,
          SCORE_MAP[r.probability][r.impact].label,
          r.mitigationPlan || '—',
          r.owner,
          r.status,
        ]),
        styles: { fontSize: 7.5, cellPadding: 3, font: 'helvetica', textColor: [51, 65, 85], lineColor: [241, 245, 249], lineWidth: 0.3 },
        headStyles: { fillColor: [15, 15, 15], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, cellPadding: 4 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 18, fontStyle: 'bold' },
          1: { cellWidth: 28 },
          2: { cellWidth: 58 },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 58 },
          7: { cellWidth: 35 },
          8: { cellWidth: 28 },
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.column.index === 5 && data.section === 'body') {
            const val = data.cell.raw as string;
            if (val === 'Critical') data.cell.styles.textColor = [124, 58, 237];
            else if (val === 'High') data.cell.styles.textColor = [239, 68, 68];
            else if (val === 'Medium') data.cell.styles.textColor = [245, 158, 11];
            else data.cell.styles.textColor = [16, 185, 129];
          }
        },
        didDrawPage: () => {
          doc.setFillColor(248, 250, 252);
          doc.rect(0, 200, pageW, 10, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(150, 150, 150);
          doc.text(`${project.customerName} · MedixSafe OPS · Risk Register · Confidential`, pageW / 2, 206, { align: 'center' });
        },
      });

      // Footer on last page
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 200, pageW, 10, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.text(`${project.customerName} · MedixSafe OPS · Risk Register · Confidential`, pageW / 2, 206, { align: 'center' });

      doc.save(`${project.customerName.replace(/\s+/g, '_')}_Risk_Register_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setTimeout(() => setIsExporting(false), 1000);
    }
  };

  const sel = (val: string, onChange: (v: string) => void, opts: string[], className = '') => (
    <select value={val} onChange={e => onChange(e.target.value)}
      className={`w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-brand transition-all ${className}`}>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">Risk Register</h2>
          <p className="text-sm text-slate-500 font-medium italic">Identify, assess and mitigate project risks.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplates(v => !v)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${showTemplates ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
            <BookOpen size={14} /> Templates
          </button>
          <button onClick={handleExportPDF} disabled={isExporting || risks.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-40">
            {isExporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            Export PDF
          </button>
          <button onClick={handleOpenAdd}
            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all">
            <Plus size={16} /> Add Risk
          </button>
        </div>
      </div>

      {/* Dashboard KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Risks', value: stats.total, icon: <Shield size={18} />, color: 'text-slate-600' },
          { label: 'Open', value: stats.open, icon: <AlertTriangle size={18} />, color: 'text-amber-500' },
          { label: 'High / Critical', value: stats.high, icon: <TrendingUp size={18} />, color: stats.high > 0 ? 'text-red-500' : 'text-slate-400' },
          { label: 'Mitigated', value: risks.filter(r => r.status === 'Mitigated').length, icon: <CheckCircle2 size={18} />, color: 'text-emerald-500' },
          { label: 'Closed', value: stats.closed, icon: <Minus size={18} />, color: 'text-slate-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-slate-50 ${kpi.color}`}>{kpi.icon}</div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
              <p className="text-2xl font-black text-slate-900 leading-none">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Common Risk Templates Panel */}
      {showTemplates && (
        <div className="bg-slate-900 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Common Risk Templates — Click to Add</h3>
            <button onClick={() => setShowTemplates(false)}><X size={16} className="text-slate-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {COMMON_RISKS.map((t, i) => {
              const alreadyAdded = risks.some(r => r.description === t.description);
              return (
                <button key={i} disabled={alreadyAdded}
                  onClick={() => handleAddFromTemplate(t)}
                  className={`text-left p-4 rounded-2xl border transition-all ${alreadyAdded ? 'border-emerald-500/30 bg-emerald-500/10 cursor-default' : 'border-slate-700 bg-slate-800 hover:border-brand hover:bg-slate-700'}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-brand mb-1">{t.category}</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{t.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded" style={{ background: SCORE_MAP[t.probability][t.impact].bg, color: SCORE_MAP[t.probability][t.impact].color }}>
                      {SCORE_MAP[t.probability][t.impact].label}
                    </span>
                    {alreadyAdded && <span className="text-[9px] font-black uppercase text-emerald-400">Added</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      {risks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex flex-wrap gap-4 items-center">
            <Filter size={14} className="text-slate-400" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand">
              <option value="all">All Statuses</option>
              {Object.keys(STATUS_META).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-brand">
              <option value="all">All Categories</option>
              {[...new Set(risks.map(r => r.category))].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filterStatus !== 'all' || filterCategory !== 'all') && (
              <button onClick={() => { setFilterStatus('all'); setFilterCategory('all'); }}
                className="flex items-center gap-1 text-[10px] font-black text-brand uppercase">
                <X size={12} /> Clear
              </button>
            )}
            <span className="ml-auto text-[10px] font-black text-slate-400 uppercase">{filtered.length} risk{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Risk List */}
      {risks.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center">
          <Shield size={48} className="text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter mb-2">No Risks Identified</h3>
          <p className="text-sm text-slate-400 mb-6">Add risks manually or use the Templates to quickly add common deployment risks.</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setShowTemplates(true)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
              <BookOpen size={14} className="inline mr-1.5" /> Browse Templates
            </button>
            <button onClick={handleOpenAdd} className="px-6 py-3 bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all">
              <Plus size={14} className="inline mr-1.5" /> Add Risk
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(risk => {
            const score = SCORE_MAP[risk.probability][risk.impact];
            const isExpanded = expandedId === risk.id;
            return (
              <div key={risk.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-8 py-5 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : risk.id)}>
                  <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className="text-center shrink-0">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ID</p>
                      <p className="text-sm font-black text-slate-700 font-mono">{risk.riskId}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-100 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 text-sm truncate">{risk.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{risk.category} · {risk.dateIdentified}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <ScoreBadge probability={risk.probability} impact={risk.impact} />
                    <StatusBadge status={risk.status} />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleEdit(risk)}
                        className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-brand hover:bg-brand/10 transition-all border border-slate-100">
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => handleDelete(risk.id)}
                        className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-slate-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-8 pb-8 border-t border-slate-50 pt-6 space-y-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: 'Probability', value: risk.probability },
                        { label: 'Impact', value: risk.impact },
                        { label: 'Owner', value: risk.owner },
                        { label: 'Identified By', value: risk.identifiedBy },
                      ].map(f => (
                        <div key={f.label} className="bg-slate-50 rounded-xl p-4">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{f.label}</p>
                          <p className="text-sm font-black text-slate-900">{f.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[
                        { label: 'Potential Impact', value: risk.potentialImpact },
                        { label: 'Mitigation Plan', value: risk.mitigationPlan },
                        { label: 'Contingency Plan', value: risk.contingencyPlan },
                        { label: 'Notes', value: risk.notes },
                      ].filter(f => f.value).map(f => (
                        <div key={f.label}>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{f.label}</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{f.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button onClick={() => handleEdit(risk)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all">
                        <Edit3 size={13} /> Edit Risk
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                  {editingId ? 'Edit Risk' : 'Add Risk'}
                </h3>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">{form.riskId}</p>
              </div>
              <button onClick={() => setShowForm(false)}><X size={22} className="text-slate-400 hover:text-black" /></button>
            </div>

            <div className="p-8 overflow-y-auto space-y-5 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  {sel(form.category, v => setForm(f => ({ ...f, category: v as RiskCategory })), [
                    'Project Management','Customer Availability','Facilities','Training',
                    'Technical','Hardware','Network / Security','Configuration',
                    'Data / Migration','Scheduling','Operational Adoption','External Dependency','Other',
                  ])}
                </Field>
                <Field label="Identified By">
                  {sel(form.identifiedBy, v => setForm(f => ({ ...f, identifiedBy: v as any })), ['MedixSafe', 'Customer', 'Automated'])}
                </Field>
              </div>

              <Field label="Risk Description *">
                <textarea className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all resize-none h-20 text-sm"
                  placeholder="Describe the potential risk..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </Field>

              <Field label="Potential Impact">
                <textarea className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all resize-none h-16 text-sm"
                  placeholder="What happens if this occurs?" value={form.potentialImpact}
                  onChange={e => setForm(f => ({ ...f, potentialImpact: e.target.value }))} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Probability">
                  {sel(form.probability, v => setForm(f => ({ ...f, probability: v as Probability })), ['Low', 'Medium', 'High'])}
                </Field>
                <Field label="Impact">
                  {sel(form.impact, v => setForm(f => ({ ...f, impact: v as Impact })), ['Low', 'Medium', 'High'])}
                </Field>
              </div>

              {/* Score preview */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk Rating:</span>
                <ScoreBadge probability={form.probability} impact={form.impact} />
              </div>

              <Field label="Mitigation Plan">
                <textarea className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all resize-none h-20 text-sm"
                  placeholder="What actions will reduce this risk?" value={form.mitigationPlan}
                  onChange={e => setForm(f => ({ ...f, mitigationPlan: e.target.value }))} />
              </Field>

              <Field label="Contingency Plan">
                <textarea className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all resize-none h-16 text-sm"
                  placeholder="What happens if the risk occurs?" value={form.contingencyPlan}
                  onChange={e => setForm(f => ({ ...f, contingencyPlan: e.target.value }))} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Risk Owner">
                  {sel(form.owner, v => setForm(f => ({ ...f, owner: v as RiskOwner })), [
                    'MedixSafe Project Manager','Customer Project Manager','Customer IT','Customer Operations','Vendor','Other',
                  ])}
                </Field>
                <Field label="Status">
                  {sel(form.status, v => setForm(f => ({ ...f, status: v as RiskStatus })), [
                    'Identified','Under Review','Mitigation In Progress','Mitigated','Accepted','Closed',
                  ])}
                </Field>
              </div>

              <Field label="Responsible Party">
                <input className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all text-sm"
                  placeholder="Specific person or team"
                  value={form.responsibleParty}
                  onChange={e => setForm(f => ({ ...f, responsibleParty: e.target.value }))} />
              </Field>

              <Field label="Notes">
                <textarea className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium outline-none focus:border-brand transition-all resize-none h-16 text-sm"
                  placeholder="Additional context..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </Field>
            </div>

            <div className="px-8 py-5 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 text-xs font-black uppercase text-slate-400 hover:text-slate-600">Cancel</button>
              <button onClick={handleSave} disabled={!form.description.trim()}
                className="flex items-center gap-2 px-8 py-3 bg-brand text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-40">
                <Save size={14} /> {editingId ? 'Save Changes' : 'Add Risk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
