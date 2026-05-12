
import React, { useState, useEffect } from 'react';
import { Project, GlobalSettings, SuccessCriterion, ProjectLocation } from '../../types';
import { 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Archive, 
  ArrowRight, 
  Save, 
  Edit3, 
  CheckCircle2, 
  Target, 
  Award, 
  Info, 
  Plus, 
  X,
  FileText,
  Activity,
  Check,
  MapPin,
  Building2,
  Users,
  Trophy,
  Zap
} from 'lucide-react';

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onNavigateToTab: (tab: any) => void;
  globalSettings: GlobalSettings;
}

export const ProjectSummary: React.FC<Props> = ({ 
  project, 
  onUpdate, 
  onDelete, 
  onArchive, 
  onNavigateToTab,
  globalSettings 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Project>(project);
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  
  useEffect(() => {
    setEditData(project);
  }, [project]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setEditData({ ...editData, logoBase64: base64 });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
    setShowSaveNotification(true);
    setTimeout(() => setShowSaveNotification(false), 3000);
  };

  // Success Criteria Logic
  const toggleCriterion = (id: string, type: 'customer' | 'our') => {
    const field = type === 'customer' ? 'customerSuccessCriteria' : 'ourSuccessCriteria';
    const updatedCriteria = project[field].map(c => 
      c.id === id ? { ...c, isMet: !c.isMet } : c
    );
    onUpdate({ ...project, [field]: updatedCriteria });
  };

  const addCriterion = (type: 'customer' | 'our') => {
    const field = type === 'customer' ? 'customerSuccessCriteria' : 'ourSuccessCriteria';
    const newCriterion: SuccessCriterion = { id: crypto.randomUUID(), text: 'New success goal...', isMet: false };
    onUpdate({ ...project, [field]: [...project[field], newCriterion] });
  };

  const removeCriterion = (id: string, type: 'customer' | 'our') => {
    const field = type === 'customer' ? 'customerSuccessCriteria' : 'ourSuccessCriteria';
    onUpdate({ ...project, [field]: project[field].filter(c => c.id !== id) });
  };

  const updateCriterionText = (id: string, type: 'customer' | 'our', text: string) => {
    const field = type === 'customer' ? 'customerSuccessCriteria' : 'ourSuccessCriteria';
    const updatedCriteria = project[field].map(c => 
      c.id === id ? { ...c, text } : c
    );
    onUpdate({ ...project, [field]: updatedCriteria });
  };

  // Accomplishments Logic (What was done)
  const addAccomplishment = () => {
    setEditData({
      ...editData,
      accomplishments: [...(editData.accomplishments || []), "New technical achievement logged..."]
    });
  };

  const updateAccomplishment = (index: number, val: string) => {
    const updated = [...(editData.accomplishments || [])];
    updated[index] = val;
    setEditData({ ...editData, accomplishments: updated });
  };

  const removeAccomplishment = (index: number) => {
    const updated = (editData.accomplishments || []).filter((_, i) => i !== index);
    setEditData({ ...editData, accomplishments: updated });
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Header with Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">Project Summary</h2>
          <p className="text-sm text-slate-500 font-medium italic">Strategic overview and mission success tracking.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {showSaveNotification && (
            <div className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-in slide-in-from-right-4">
              <Check size={14} /> Synchronized
            </div>
          )}
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${isEditing ? 'bg-slate-100 text-slate-600' : 'bg-black text-white shadow-xl shadow-black/10 hover:bg-brand'}`}
          >
            {isEditing ? <><X size={16} /> Cancel</> : <><Edit3 size={16} /> Edit Charter</>}
          </button>
          {!isEditing && (
             <>
               <button onClick={() => onArchive(project.id)} className="px-6 py-2.5 bg-slate-100 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 hover:text-slate-600 transition-all flex items-center gap-2">
                 <Archive size={16} /> Archive
               </button>
               <button onClick={() => onDelete(project.id)} className="px-6 py-2.5 bg-slate-100 text-red-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center gap-2">
                 <Trash2 size={16} /> Delete
               </button>
             </>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="bg-white rounded-[3rem] border-2 border-brand/20 shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
          <div className="p-10 bg-brand/5 border-b border-brand/10">
            <h3 className="text-xl font-black text-brand uppercase tracking-widest flex items-center gap-3">
              <Edit3 size={20} /> Charter Editor
            </h3>
          </div>
          <div className="p-10 space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Title</label>
                    <input className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-brand transition-all text-lg" value={editData.title} onChange={e => setEditData({...editData, title: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Account</label>
                    <input className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-brand transition-all" value={editData.customerName} onChange={e => setEditData({...editData, customerName: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mission Branding (Logo)</label>
                  <div className="flex flex-col items-center gap-4 p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] group hover:border-brand transition-all">
                    <div className="w-28 h-28 bg-white rounded-3xl border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner">
                      {editData.logoBase64 ? <img src={editData.logoBase64} className="max-h-full max-w-full object-contain p-2" alt="Preview" /> : <ImageIcon className="text-slate-200" size={40} />}
                    </div>
                    <input type="file" accept="image/*" className="hidden" id="project-logo-upload" onChange={handleLogoUpload} />
                    <label htmlFor="project-logo-upload" className="px-8 py-3 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-brand transition-all flex items-center gap-2">
                      <Upload size={14} /> Update Asset
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Overview / Executive Summary</label>
                <textarea 
                  className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-medium text-sm h-48 resize-none focus:border-brand transition-all outline-none leading-relaxed" 
                  placeholder="Describe the technical mission, hardware scope, and deliverables..." 
                  value={editData.projectOverview} 
                  onChange={e => setEditData({...editData, projectOverview: e.target.value})} 
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Accomplishments (What Was Done)</label>
                   <button onClick={addAccomplishment} className="text-[10px] font-black text-brand uppercase tracking-widest flex items-center gap-1 hover:underline"><Plus size={14}/> Add Achievement</button>
                </div>
                <div className="space-y-3">
                   {(editData.accomplishments || []).map((acc, idx) => (
                     <div key={idx} className="flex gap-3 items-center">
                        <input 
                          className="flex-1 px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl font-medium text-sm outline-none focus:border-brand"
                          value={acc}
                          onChange={e => updateAccomplishment(idx, e.target.value)}
                        />
                        <button onClick={() => removeAccomplishment(idx)} className="p-2 text-slate-300 hover:text-brand transition-colors"><Trash2 size={16}/></button>
                     </div>
                   ))}
                   {(editData.accomplishments || []).length === 0 && (
                     <p className="text-[10px] text-slate-400 italic">No accomplishments documented yet.</p>
                   )}
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-slate-100">
                <button 
                  onClick={handleSave}
                  className="px-12 py-5 bg-brand text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand-dark transition-all flex items-center gap-3 shadow-2xl shadow-brand/30 hover:-translate-y-1"
                >
                  <Save size={18} /> Synchronize Mission Charter
                </button>
              </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-12">
            
            {/* Overview Section */}
            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden p-12 relative">
               <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none -rotate-12"><FileText size={160} /></div>
               <div className="relative z-10 space-y-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center shadow-lg"><Info size={20} /></div>
                    <h3 className="text-[10px] font-black text-brand uppercase tracking-[0.4em]">Project Overview</h3>
                  </div>
                  <div className="text-base font-medium text-slate-800 leading-relaxed whitespace-pre-wrap italic opacity-80 border-l-4 border-slate-100 pl-6">
                    {project.projectOverview || 'No project overview has been defined for this mission yet.'}
                  </div>
               </div>
            </div>

            {/* Accomplishments Section - WHAT WAS DONE */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 px-4">
                <Trophy size={20} className="text-brand" />
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter">Program Accomplishments</h3>
              </div>
              <div className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none rotate-12"><Zap size={140} className="text-brand" /></div>
                <div className="relative z-10 space-y-6">
                   {project.accomplishments && project.accomplishments.length > 0 ? (
                     <div className="grid grid-cols-1 gap-6">
                       {project.accomplishments.map((acc, idx) => (
                         <div key={idx} className="flex items-start gap-4 group">
                           <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center shrink-0 mt-1">
                              <Check size={16} className="text-brand" />
                           </div>
                           <p className="text-slate-100 text-base font-medium leading-relaxed">{acc}</p>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="text-center py-10">
                        <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.4em]">No technical achievements logged for this period</p>
                     </div>
                   )}
                </div>
              </div>
            </div>

            {/* Success Criteria Section */}
            <div className="space-y-6">
              <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-3">
                  <Target size={20} className="text-brand" />
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter">Customer Success Criteria</h3>
                </div>
                <button onClick={() => addCriterion('customer')} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-brand hover:text-white transition-all"><Plus size={18}/></button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {project.customerSuccessCriteria.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-300">
                    <p className="font-black uppercase text-[10px] tracking-[0.3em]">No success goals defined</p>
                  </div>
                ) : project.customerSuccessCriteria.map(c => (
                  <div key={c.id} className={`p-8 rounded-[2rem] border-2 transition-all flex items-start justify-between group h-auto ${c.isMet ? 'bg-emerald-50 border-emerald-100 shadow-sm' : 'bg-white border-slate-100 hover:border-brand/20 shadow-sm'}`}>
                    <div className="flex items-start gap-6 flex-1 min-w-0">
                      <button 
                        onClick={() => toggleCriterion(c.id, 'customer')}
                        className={`w-8 h-8 mt-1 rounded-xl flex items-center justify-center transition-all shrink-0 ${c.isMet ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 text-slate-300 group-hover:bg-slate-200'}`}
                      >
                        <Check size={18} />
                      </button>
                      <textarea 
                        className={`flex-1 bg-transparent border-none outline-none font-bold text-sm leading-relaxed resize-none h-auto overflow-hidden py-1 whitespace-pre-wrap w-full block ${c.isMet ? 'text-emerald-900 line-through opacity-50' : 'text-slate-800'}`}
                        rows={1}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = target.scrollHeight + 'px';
                        }}
                        ref={(el) => {
                          if (el) {
                            el.style.height = 'auto';
                            el.style.height = el.scrollHeight + 'px';
                          }
                        }}
                        value={c.text}
                        onChange={e => updateCriterionText(c.id, 'customer', e.target.value)}
                      />
                    </div>
                    <button onClick={() => removeCriterion(c.id, 'customer')} className="p-2 mt-1 text-slate-200 hover:text-brand opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Info Card */}
          <div className="lg:col-span-4 space-y-10">
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl space-y-8 flex flex-col items-center text-center sticky top-8">
               <div className="w-32 h-32 bg-white rounded-[2rem] flex items-center justify-center overflow-hidden shadow-2xl p-4">
                  {project.logoBase64 ? <img src={project.logoBase64} className="max-h-full max-w-full object-contain" alt="Project Logo" /> : <ImageIcon className="text-slate-200" size={48} />}
               </div>
               <div className="space-y-2 w-full">
                 <p className="text-[10px] font-black text-brand uppercase tracking-[0.4em]">Hardware Mission</p>
                 <h4 className="text-2xl font-black uppercase tracking-tight leading-tight">{project.title}</h4>
                 <p className="text-sm font-medium text-slate-400 border-t border-white/10 pt-4 mt-4 uppercase tracking-widest">{project.customerName}</p>
               </div>
               <div className="w-full pt-6 border-t border-white/5 space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                     <span className="text-slate-500">Criteria Met</span>
                     <span className="text-brand">{project.customerSuccessCriteria.filter(c => c.isMet).length} / {project.customerSuccessCriteria.length}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand transition-all duration-1000" 
                      style={{ width: `${(project.customerSuccessCriteria.filter(c => c.isMet).length / (project.customerSuccessCriteria.length || 1)) * 100}%` }}
                    />
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
