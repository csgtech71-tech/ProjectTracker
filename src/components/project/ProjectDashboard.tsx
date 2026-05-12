
import React from 'react';
import { Project, Tab } from '../../types';
import { BarChart3, Box, ChevronRight, LayoutGrid, Rocket, Archive, CheckCircle2, AlertTriangle, Users, Trophy } from 'lucide-react';

interface Props {
  projects: Project[];
  onSelectProject: (id: string) => void;
  onRestore: (id: string) => void;
}

export const ProjectDashboard: React.FC<Props> = ({ projects, onSelectProject, onRestore }) => {
  const activeProjects = projects.filter(p => !p.isArchived);
  const archivedProjects = projects.filter(p => p.isArchived);

  const totalActiveSites = activeProjects.reduce((acc, p) => acc + p.locations.length, 0);
  const totalAssets = activeProjects.reduce((acc, p) => 
    acc + p.locations.reduce((lAcc, l) => lAcc + (l.numSafes || 0), 0)
  , 0);

  const getProgress = (p: Project) => {
    const total = p.customerSuccessCriteria.length + p.ourSuccessCriteria.length;
    if (total === 0) return 0;
    const met = p.customerSuccessCriteria.filter(c => c.isMet).length + 
                p.ourSuccessCriteria.filter(c => c.isMet).length;
    return Math.round((met / total) * 100);
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">Dashboard</h1>
          <p className="text-lg text-slate-500 font-medium">Global oversight of all active MedixSafe hardware deployments.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl"><Box size={24}/></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Sites</p>
              <p className="text-2xl font-black text-slate-900 leading-none">{totalActiveSites}</p>
            </div>
          </div>
          <div className="bg-black text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4">
            <div className="p-3 bg-white/10 text-brand rounded-xl"><Rocket size={24}/></div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hardware Deployed</p>
              <p className="text-2xl font-black leading-none">{totalAssets}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
          <LayoutGrid size={16} /> Active Projects ({activeProjects.length})
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeProjects.map(project => {
            const progress = getProgress(project);
            const isHighRisk = project.milestones.some(m => m.type === 'blocked' || m.type === 'failure');
            const isSuccess = project.isClosed;
            
            return (
              <button 
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={`group bg-white rounded-3xl border-2 p-8 text-left hover:border-brand hover:shadow-2xl hover:shadow-brand/5 transition-all relative overflow-hidden flex flex-col h-full ${isSuccess ? 'border-emerald-100' : 'border-slate-100'}`}
              >
                {isHighRisk && !isSuccess && (
                  <div className="absolute top-0 right-0 p-3 bg-brand text-white rounded-bl-xl flex items-center gap-2">
                    <AlertTriangle size={12} />
                    <span className="text-[8px] font-black uppercase">High Risk</span>
                  </div>
                )}
                {isSuccess && (
                  <div className="absolute top-0 right-0 p-3 bg-emerald-500 text-white rounded-bl-xl flex items-center gap-2">
                    <Trophy size={12} />
                    <span className="text-[8px] font-black uppercase">Success</span>
                  </div>
                )}
                
                <div className="mb-6">
                  <span className={`text-[10px] font-black uppercase tracking-widest mb-1 block ${isSuccess ? 'text-emerald-500' : 'text-brand'}`}>
                    Project ID: {project.id.slice(0,8)}
                  </span>
                  <h4 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-brand transition-colors uppercase tracking-tight truncate">{project.title}</h4>
                  <p className="text-sm font-bold text-slate-400 truncate mt-1 uppercase">{project.customerName}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Sites</span>
                    <span className="text-sm font-black text-slate-900">{project.locations.length} Stations</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">End Date</span>
                    <span className="text-sm font-black text-slate-900">
                      {new Date(project.extendedEndDate || project.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                <div className="mt-auto space-y-3">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      {isSuccess ? 'Final Success Score' : 'Project Progress'}
                    </span>
                    <span className={`text-xs font-black ${isSuccess ? 'text-emerald-500' : 'text-slate-900'}`}>{progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 group-hover:shadow-lg ${isSuccess ? 'bg-emerald-500' : 'bg-brand'}`} 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="flex -space-x-2">
                      {project.contacts.slice(0, 3).map((c, i) => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-black text-slate-600">{c.name.charAt(0)}</div>
                      ))}
                      {project.contacts.length > 3 && (
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-400">+{project.contacts.length - 3}</div>
                      )}
                    </div>
                    <ChevronRight size={16} className={`transition-transform group-hover:translate-x-1 ${isSuccess ? 'text-emerald-500' : 'text-slate-300'}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {archivedProjects.length > 0 && (
        <section className="space-y-6 pt-10 border-t border-slate-200">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
            <Archive size={16} /> Archived Vault ({archivedProjects.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {archivedProjects.map(project => (
              <div key={project.id} className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex justify-between items-center grayscale hover:grayscale-0 transition-all">
                <div className="flex items-center gap-5">
                  <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400"><Archive size={20}/></div>
                  <div>
                    <h4 className="font-black text-slate-600 leading-tight uppercase text-sm">{project.title}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{project.customerName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onRestore(project.id)}
                  className="px-4 py-2 text-[10px] font-black uppercase text-brand hover:bg-brand hover:text-white rounded-lg transition-all border border-brand/20"
                >
                  Restore Project
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
