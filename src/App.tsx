import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Project, Tab, GlobalSettings, DeploymentType, AppUser } from './types';
import { useAuth } from './hooks/useAuth';
import { projectService, settingsService } from './services/projectService';
import { authService } from './services/authService';
import { isSupabaseConfigured } from './services/supabaseClient';
import { LoginPage } from './components/auth/LoginPage';
import { ProjectSummary } from './components/project/ProjectSummary';
import { ProjectCalendar } from './components/project/ProjectCalendar';
import { ProjectTracking } from './components/tracking/ProjectTracking';
import { ProjectClosing } from './components/project/ProjectClosing';
import { ProjectContacts } from './components/project/ProjectContacts';
import { ProjectSOW } from './components/project/ProjectSOW';
import { ProjectDashboard } from './components/project/ProjectDashboard';
import { ProjectJobCosting } from './components/project/ProjectJobCosting';
import { ProjectReadiness, DEFAULT_READINESS } from './components/project/ProjectReadiness';
import { AdminSettings } from './components/admin/AdminSettings';
import { LogAnalyzer } from './components/tracking/LogAnalyzer';
import {
  Calendar as CalIcon,
  Activity,
  CheckCircle,
  Settings,
  Plus,
  Box,
  Menu,
  Users,
  X,
  LayoutGrid,
  FileText,
  RefreshCw,
  LogOut,
  Info,
  CloudCheck,
  CloudOff,
  Calculator,
  ClipboardList,
  ScanSearch,
} from 'lucide-react';

const DEFAULT_SETTINGS: GlobalSettings = {
  sidebarTitle: 'Project Tracker',
  companyName: 'MedixSafe',
};

export default function App() {
  const { user, loading: authLoading, authError, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataLoadError, setDataLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);

  const [newProject, setNewProject] = useState({
    title: '',
    customerName: '',
    projectOverview: '',
    deploymentType: 'both' as DeploymentType,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    sowCost: 7500,
  });

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const hasLoadedRef = useRef(false);

  // Reset load guard when user logs out so next login reloads fresh data
  useEffect(() => { if (!user) hasLoadedRef.current = false; }, [user]);

  useEffect(() => {
    // Only load once when user first logs in — ignore token refreshes
    if (!user || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    setIsDataLoading(true);
    Promise.all([projectService.list(), settingsService.load(), authService.listAppUsers()])
      .then(([projs, settings, users]) => {
        setAppUsers(users);
        setProjects(projs);
        if (projs.length > 0) setActiveProjectId(projs[0].id);
        setGlobalSettings(settings);
        setDataLoadError('');
      })
      .catch((e) => {
        console.error('Load error:', e);
        setDataLoadError(e instanceof Error ? e.message : 'Failed to load data from Supabase.');
      })
      .finally(() => setIsDataLoading(false));
  }, [user]);

  const handleUpdateProject = useCallback(async (updated: Project) => {
setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setIsSaving(true);
    try {
      await projectService.update(updated);
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setTimeout(() => setIsSaving(false), 800);
    }
  }, []);

  const handleCreateProject = async () => {
    setCreateError('');
    if (!newProject.title.trim() || !newProject.customerName.trim()) {
      setCreateError('Project title and customer name are required.');
      return;
    }
    const project: Project = {
      id: crypto.randomUUID(),
      title: newProject.title.trim(),
      customerName: newProject.customerName.trim(),
      projectOverview: newProject.projectOverview,
      deploymentType: newProject.deploymentType,
      locations: [],
      startDate: newProject.startDate,
      endDate: newProject.endDate,
      revision: 1,
      revisions: [
        {
          id: crypto.randomUUID(),
          version: 1,
          timestamp: new Date().toISOString(),
          author: user?.username || 'Admin',
          comment: 'Project initiated.',
        },
      ],
      customerSuccessCriteria: [],
      ourSuccessCriteria: [],
      accomplishments: [],
      milestones: [
        {
          id: crypto.randomUUID(),
          title: 'Kickoff',
          date: newProject.startDate,
          type: 'start',
          description: 'Project start date.',
        },
      ],
      readinessCategories: (globalSettings.defaultReadinessCategories ?? DEFAULT_READINESS).map(cat => ({
        ...cat,
        id: crypto.randomUUID(),
        items: cat.items.map(item => ({ ...item, id: crypto.randomUUID(), isComplete: false, value: item.type !== 'checkbox' ? (item.value ?? '') : undefined }))
      })),
      contacts: appUsers.map(u => ({
        id: crypto.randomUUID(),
        side: 'internal' as const,
        name: u.username,
        role: u.role === 'admin' ? 'Admin' : 'Team Member',
        email: u.email || '',
        phone: u.phone || '',
        location: '',
        address: '',
        notes: '',
      })),
      isClosed: false,
      isArchived: false,
      isExtended: false,
      surveyQuestions: [],
      sowCost: newProject.sowCost,
      hardwareNodes: [],
      customerSentiment: 'happy',
    };
    setIsCreating(true);
    try {
      // Race against a 15s timeout so we never spin forever
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your Supabase connection and RLS policies on the projects table.')), 15000)
      );
      const created = await Promise.race([projectService.create(project), timeoutPromise]);
      setProjects((prev) => [created, ...prev]);
      setActiveProjectId(created.id);
      setActiveTab('summary');
      setIsCreateModalOpen(false);
      setCreateError('');
      setNewProject({
        title: '',
        customerName: '',
        projectOverview: '',
        deploymentType: 'both',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        sowCost: 7500,
      });
    } catch (e) {
      console.error('Project create error:', e);
      setCreateError(e instanceof Error ? e.message : 'Failed to create project. Check your Supabase connection.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Permanently delete this project? This cannot be undone.')) return;
    await projectService.delete(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setActiveProjectId(null);
    setActiveTab('dashboard');
  };

  const handleArchiveProject = async (id: string) => {
    await projectService.patch(id, { is_archived: true });
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isArchived: true } : p))
    );
    setActiveTab('dashboard');
  };

  const handleUpdateSettings = async (settings: GlobalSettings) => {
    setGlobalSettings(settings);
    try {
      await settingsService.save(settings);
    } catch (e) {
      console.error('Settings save failed:', e);
    }
  };

  // All nav items always visible — tabs that need a project show a prompt if none selected
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'summary', label: 'Summary', icon: Info },
    { id: 'readiness', label: 'Readiness', icon: ClipboardList },
    { id: 'stakeholders', label: 'Stakeholders', icon: Users },
    { id: 'timeline', label: 'Timeline', icon: CalIcon },
    { id: 'tracking', label: 'Tracking', icon: Activity },
    { id: 'costing', label: 'Costing', icon: Calculator },
    { id: 'sow', label: 'SOW', icon: FileText },
    { id: 'closure', label: 'Closure', icon: CheckCircle },
    { id: 'analyzer', label: 'Analyzer', icon: ScanSearch },
  ];

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white">
        <RefreshCw size={48} className="text-brand animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Establishing Secure Link...</p>
      </div>
    );
  }

  if (!user) return <LoginPage globalSettings={globalSettings} authError={authError} />;

  const NoProjectSelected = () => (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <Box size={48} className="text-slate-200 mb-4" />
      <h3 className="text-xl font-black text-slate-400 uppercase tracking-tighter mb-2">No Project Selected</h3>
      <p className="text-sm text-slate-400 mb-6">Select a project from the sidebar or create a new one.</p>
      {user.role === 'admin' && (
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-8 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all"
        >
          <Plus size={16} className="inline mr-2" />
          New Project
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className={`no-print transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} bg-black text-slate-300 border-r border-slate-800 flex flex-col z-20`}>
        <div className="px-4 py-6 flex items-center gap-3 border-b border-slate-900 overflow-hidden">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white shrink-0 font-black shadow-lg">
            {globalSettings.sidebarIconBase64 ? (
              <img src={globalSettings.sidebarIconBase64} className="w-full h-full object-contain p-1" alt="Icon" />
            ) : 'MS'}
          </div>
          {isSidebarOpen && (
            <span className="font-black text-lg text-white tracking-tighter uppercase truncate">
              {globalSettings.sidebarTitle}
            </span>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-6 overflow-y-auto custom-scrollbar">
          {projects.filter((p) => !p.isArchived).map((p) => (
            <button
              key={p.id}
              onClick={() => { setActiveProjectId(p.id); setActiveTab('summary'); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                activeProjectId === p.id && activeTab !== 'dashboard' && activeTab !== 'settings'
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'hover:bg-slate-900 text-slate-500'
              }`}
            >
              <Box size={16} />
              {isSidebarOpen && <span className="text-xs truncate font-bold">{p.title}</span>}
            </button>
          ))}

          {user.role === 'admin' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-brand hover:text-white text-slate-500 transition-all mt-6 border border-dashed border-slate-800"
            >
              <Plus size={18} />
              {isSidebarOpen && <span className="text-[10px] font-black uppercase tracking-widest">New Project</span>}
            </button>
          )}
        </nav>

        <div className="p-4 mt-auto border-t border-slate-900 space-y-2">
          <div
            className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${
              isSupabaseConfigured()
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                : 'bg-slate-900 border-slate-800 text-slate-600'
            }`}
          >
            {isSupabaseConfigured() ? <CloudCheck size={18} /> : <CloudOff size={18} />}
            {isSidebarOpen && (
              <span className="text-[10px] font-black uppercase tracking-widest">
                DB: {isSupabaseConfigured() ? 'Online' : 'Offline'}
              </span>
            )}
          </div>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all w-full ${
              activeTab === 'settings' ? 'bg-brand text-white shadow-lg' : 'text-slate-600 hover:bg-slate-900'
            }`}
          >
            <Settings size={18} />
            {isSidebarOpen && <span className="text-xs font-bold">Settings</span>}
          </button>

          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-500/10 w-full text-slate-600 hover:text-red-500 transition-all"
          >
            <LogOut size={18} />
            {isSidebarOpen && <span className="text-xs font-bold">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center px-8 justify-between shadow-sm z-10">
          <div className="flex items-center gap-2 h-full overflow-x-auto no-scrollbar">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 shrink-0">
              <Menu size={20} />
            </button>
            <div className="ml-4 flex h-full items-center">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as Tab)}
                    className={`h-full px-3 flex items-center gap-1.5 text-[9px] uppercase tracking-tight font-black transition-all relative shrink-0 ${
                      activeTab === item.id ? 'text-brand' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{item.label}</span>
                    {activeTab === item.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isSaving && (
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <RefreshCw size={12} className="animate-spin" /> Saving...
              </div>
            )}
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.username}</p>
              <p className="text-[8px] font-black text-brand uppercase tracking-widest">{user.role}</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto">
            {isDataLoading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <RefreshCw size={32} className="text-brand animate-spin mb-4" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Projects...</p>
              </div>
            ) : dataLoadError ? (
              <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center">
                  <LogOut size={28} className="text-red-400" />
                </div>
                <div>
                  <p className="text-lg font-black text-slate-700 uppercase tracking-tighter mb-1">Failed to Load Data</p>
                  <p className="text-sm text-red-500 font-medium max-w-md">{dataLoadError}</p>
                </div>
                <button
                  onClick={() => { setDataLoadError(''); setIsDataLoading(true); Promise.all([projectService.list(), settingsService.load()]).then(([projs, settings]) => { setProjects(projs); if (projs.length > 0) setActiveProjectId(projs[0].id); setGlobalSettings(settings); setDataLoadError(''); }).catch((e) => setDataLoadError(e instanceof Error ? e.message : 'Failed to load.')).finally(() => setIsDataLoading(false)); }}
                  className="px-6 py-3 bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all flex items-center gap-2"
                >
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <ProjectDashboard
                    projects={projects}
                    onSelectProject={(id) => { setActiveProjectId(id); setActiveTab('summary'); }}
                    onRestore={(id) => {
                      projectService.patch(id, { is_archived: false });
                      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, isArchived: false } : p));
                    }}
                  />
                )}
                {activeTab === 'summary' && (activeProject
                  ? <ProjectSummary project={activeProject} onUpdate={handleUpdateProject} onDelete={handleDeleteProject} onArchive={handleArchiveProject} onNavigateToTab={(tab: Tab) => setActiveTab(tab)} globalSettings={globalSettings} />
                  : <NoProjectSelected />
                )}
                {activeTab === 'readiness' && (activeProject
                  ? <ProjectReadiness project={activeProject} onUpdate={handleUpdateProject} />
                  : <NoProjectSelected />
                )}
                {activeTab === 'stakeholders' && (activeProject
                  ? <ProjectContacts project={activeProject} onUpdate={handleUpdateProject} appUsers={appUsers} />
                  : <NoProjectSelected />
                )}
                {activeTab === 'timeline' && (activeProject
                  ? <ProjectCalendar project={activeProject} onUpdate={handleUpdateProject} />
                  : <NoProjectSelected />
                )}
                {activeTab === 'tracking' && (activeProject
                  ? <ProjectTracking project={activeProject} onUpdate={handleUpdateProject} currentUser={user} />
                  : <NoProjectSelected />
                )}
                {activeTab === 'costing' && (activeProject
                  ? <ProjectJobCosting project={activeProject} onUpdate={handleUpdateProject} />
                  : <NoProjectSelected />
                )}
                {activeTab === 'sow' && (activeProject
                  ? <ProjectSOW project={activeProject} onUpdate={handleUpdateProject} onUpdateGlobalSettings={handleUpdateSettings} globalSettings={globalSettings} />
                  : <NoProjectSelected />
                )}
                {activeTab === 'closure' && (activeProject
                  ? <ProjectClosing project={activeProject} onUpdate={handleUpdateProject} />
                  : <NoProjectSelected />
                )}
                {activeTab === 'analyzer' && (
                  <LogAnalyzer currentUser={user} globalSettings={globalSettings} />
                )}
                {activeTab === 'settings' && (
                  <AdminSettings settings={globalSettings} currentUser={user} onUpdateSettings={handleUpdateSettings} />
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Initiate Project</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-black"><X size={28} /></button>
            </div>

            <div className="p-10 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Title</label>
                <input
                  className="w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-brand transition-all"
                  placeholder="e.g. Safe-Core Gen 3 Deployment"
                  value={newProject.title}
                  onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Customer Account</label>
                <input
                  className="w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-brand transition-all"
                  placeholder="e.g. Northstar Logistics"
                  value={newProject.customerName}
                  onChange={(e) => setNewProject({ ...newProject, customerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Project Overview</label>
                <textarea
                  className="w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl font-medium text-sm h-32 resize-none outline-none focus:border-brand transition-all"
                  placeholder="Briefly describe the mission and deliverables..."
                  value={newProject.projectOverview}
                  onChange={(e) => setNewProject({ ...newProject, projectOverview: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                  <input type="date" className="w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-brand transition-all" value={newProject.startDate} onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target End Date</label>
                  <input type="date" className="w-full px-5 py-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-brand transition-all" value={newProject.endDate} onChange={(e) => setNewProject({ ...newProject, endDate: e.target.value })} />
                </div>
              </div>
            </div>

            {createError && (
              <div className="px-10 pb-0 shrink-0">
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 font-bold flex items-center gap-2">
                  <span>{createError}</span>
                </div>
              </div>
            )}
            <div className="p-10 bg-slate-50 border-t flex justify-end gap-4 shrink-0">
              <button onClick={() => { setIsCreateModalOpen(false); setCreateError(''); }} className="px-6 py-3 text-slate-400 font-black text-xs uppercase tracking-widest">Cancel</button>
              <button onClick={handleCreateProject} disabled={isCreating} className="px-10 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all flex items-center gap-2 disabled:opacity-50">
                {isCreating ? <><RefreshCw size={14} className="animate-spin" /> Creating...</> : 'Establish Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
