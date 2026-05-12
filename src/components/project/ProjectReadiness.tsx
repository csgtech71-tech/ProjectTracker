
import React, { useState, useEffect } from 'react';
import { Project, ReadinessCategory, ReadinessItem } from '../../types';
import { 
  ShieldCheck, 
  Settings, 
  Wifi, 
  Box, 
  Monitor, 
  Users, 
  CheckCircle2, 
  Circle, 
  ClipboardCheck, 
  Lock, 
  Zap, 
  Cpu, 
  Truck, 
  Activity,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
  Printer,
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Save
} from 'lucide-react';

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
}

const DEFAULT_READINESS: ReadinessCategory[] = [
  {
    id: 'pre-install',
    name: 'Pre-Install Checks',
    items: [
      { id: 'pi-1', task: 'Retrofit Kits Shipped?', isComplete: false, type: 'checkbox' },
      { id: 'pi-2', task: 'Communicated Firewall Ports?', isComplete: false, type: 'checkbox' },
      { id: 'pi-3', task: 'Did you confirm Power and Ethernet have been run?', isComplete: false, type: 'checkbox' },
      { id: 'pi-4', task: 'Wiring Diagram printed and on hand for the installer?', isComplete: false, type: 'checkbox' },
      { id: 'pi-5', task: 'Confirm the customer knows what tools are needed', isComplete: false, type: 'checkbox' },
      { id: 'pi-6', task: 'Did you confirm Safe Type?', isComplete: false, type: 'checkbox' }
    ]
  },
  {
    id: 'remote-install',
    name: 'Remote Install Protocols',
    items: [
      { id: 'ri-1', task: 'Remote Install Only - Video Setup to Support Install', isComplete: false, type: 'checkbox' },
      { id: 'ri-2', task: 'Has a date been chosen to conduct remote install', isComplete: false, type: 'date', value: '' },
      { id: 'ri-3', task: 'Did we run them through the training deck?', isComplete: false, type: 'checkbox' },
      { id: 'ri-4', task: 'Did we share training deck?', isComplete: false, type: 'checkbox' }
    ]
  },
  {
    id: 'on-site',
    name: 'On-Site Execution',
    items: [
      { id: 'os-1', task: 'Personnel scheduled to be on-site to meet installer?', isComplete: false, type: 'checkbox' },
      { id: 'os-2', task: 'Personnel scheduled to be on-site to test solution?', isComplete: false, type: 'checkbox' },
      { id: 'os-3', task: 'Did we schedule a training date?', isComplete: false, type: 'date', value: '' },
      { id: 'os-4', task: 'Dates decided to be on-site?', isComplete: false, type: 'date', value: '' },
      { id: 'os-5', task: 'Did we complete training?', isComplete: false, type: 'checkbox' },
      { id: 'os-6', task: 'Did we share the training deck?', isComplete: false, type: 'checkbox' }
    ]
  },
  {
    id: 'networking',
    name: 'Networking & Connectivity',
    items: [
      { id: 'nt-1', task: 'Firewall Ports Opened?', isComplete: false, type: 'checkbox' },
      { id: 'nt-2', task: 'Network Configuration? (DHCP or Static)', isComplete: false, type: 'select', value: 'DHCP', options: ['DHCP', 'Static'] },
      { id: 'nt-3', task: 'Network Connection Type? (WiFi or Ethernet)', isComplete: false, type: 'select', value: 'Ethernet', options: ['WiFi', 'Ethernet'] }
    ]
  }
];

export const ProjectReadiness: React.FC<Props> = ({ project, onUpdate }) => {
  const [categories, setCategories] = useState<ReadinessCategory[]>(project.readinessCategories || DEFAULT_READINESS);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (project.readinessCategories) {
      setCategories(project.readinessCategories);
    }
  }, [project.id, project.readinessCategories]);

  // Conditional Logic: Filter categories based on deploymentType
  // Pre-install and Networking are always shown as prerequisites
  const filteredCategories = categories.filter(cat => {
    if (project.deploymentType === 'remote' && cat.id === 'on-site') return false;
    if (project.deploymentType === 'onsite' && cat.id === 'remote-install') return false;
    return true;
  });

  const handleToggle = (categoryId: string, itemId: string) => {
    if (isEditMode) return;
    const updated = categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.map(item => {
          if (item.id !== itemId) return item;
          return { ...item, isComplete: !item.isComplete };
        })
      };
    });
    saveChanges(updated);
  };

  const handleValueChange = (categoryId: string, itemId: string, value: string) => {
    const updated = categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.map(item => {
          if (item.id !== itemId) return item;
          return { ...item, value, isComplete: value !== '' };
        })
      };
    });
    saveChanges(updated);
  };

  const handleUpdateItemTask = (categoryId: string, itemId: string, task: string) => {
    const updated = categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.map(item => item.id === itemId ? { ...item, task } : item)
      };
    });
    saveChanges(updated);
  };

  const handleAddItem = (categoryId: string) => {
    const updated = categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: [...cat.items, { id: crypto.randomUUID(), task: 'New Readiness Item', isComplete: false, type: 'checkbox' } as ReadinessItem]
      };
    });
    saveChanges(updated);
  };

  const handleRemoveItem = (categoryId: string, itemId: string) => {
    const updated = categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      return {
        ...cat,
        items: cat.items.filter(i => i.id !== itemId)
      };
    });
    saveChanges(updated);
  };

  const handleAddCategory = () => {
    const newCat: ReadinessCategory = {
      id: crypto.randomUUID(),
      name: 'New Category',
      items: []
    };
    saveChanges([...categories, newCat]);
  };

  const handleRemoveCategory = (categoryId: string) => {
    if (confirm("Permanently delete this readiness framework category?")) {
      saveChanges(categories.filter(c => c.id !== categoryId));
    }
  };

  const handleUpdateCategoryName = (categoryId: string, name: string) => {
    saveChanges(categories.map(c => c.id === categoryId ? { ...c, name } : c));
  };

  const saveChanges = (updated: ReadinessCategory[]) => {
    setCategories(updated);
    onUpdate({ ...project, readinessCategories: updated });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Readiness - ${project.customerName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { padding: 40px; color: #000; background: white !important; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="mb-10 flex justify-between items-end border-b-4 border-black pb-8">
            <div>
              <h1 class="text-4xl font-black uppercase tracking-tighter">Launch Readiness Report</h1>
              <p class="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">Project: ${project.title}</p>
            </div>
            <div class="text-right">
              <p class="text-slate-900 font-black uppercase text-sm">${project.customerName}</p>
              <p class="text-slate-400 font-bold text-[10px] uppercase">${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-12">
            ${filteredCategories.map(cat => `
              <div class="space-y-4">
                <h2 class="text-xl font-black uppercase tracking-widest border-b-2 border-slate-100 pb-2">${cat.name}</h2>
                <div class="space-y-3">
                  ${cat.items.map(item => `
                    <div class="flex items-center gap-4">
                      <div class="w-5 h-5 border-2 ${item.isComplete ? 'bg-black border-black' : 'border-slate-300'} rounded flex items-center justify-center">
                        ${item.isComplete ? '<span class="text-white text-[10px] font-bold">✓</span>' : ''}
                      </div>
                      <div class="flex-1">
                        <p class="text-sm ${item.isComplete ? 'text-slate-400 line-through' : 'font-bold text-slate-800'}">${item.task}</p>
                        ${item.value ? `<p class="text-[10px] text-slate-500 font-black uppercase mt-0.5">Value: ${item.value}</p>` : ''}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="mt-20 p-8 bg-slate-50 border-2 border-slate-100 rounded-3xl">
            <h3 class="text-xs font-black uppercase text-slate-400 mb-2">Operational Summary</h3>
            <p class="text-sm font-medium leading-relaxed">
              Overall Project Readiness Score: <span class="font-black text-black">${Math.round((filteredCategories.reduce((acc, c) => acc + c.items.filter(i => i.isComplete).length, 0) / filteredCategories.reduce((acc, c) => acc + (c.items.length || 1), 0)) * 100)}%</span>.
              Deployment Framework: <span class="uppercase font-black">${project.deploymentType}</span>
            </p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getCategoryProgress = (cat: ReadinessCategory) => {
    const total = cat.items.length;
    if (total === 0) return 0;
    const complete = cat.items.filter(i => i.isComplete).length;
    return Math.round((complete / total) * 100);
  };

  const totalItemsCount = filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);
  const totalCompleteCount = filteredCategories.reduce((acc, cat) => acc + cat.items.filter(i => i.isComplete).length, 0);
  const overallReadiness = totalItemsCount > 0 ? Math.round((totalCompleteCount / totalItemsCount) * 100) : 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">Readiness Checklist</h2>
          <p className="text-sm text-slate-500 font-medium italic">Protocol verification for <span className="text-brand font-black uppercase">{project.deploymentType}</span> mission.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${isEditMode ? 'bg-brand text-white shadow-xl shadow-brand/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {isEditMode ? <><Save size={16}/> Save Schema</> : <><Edit3 size={16}/> Edit Protocol</>}
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all shadow-xl shadow-black/20"
          >
            <Printer size={16} /> Print Status
          </button>
        </div>
      </div>

      <div className="bg-black p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center gap-10">
        <div className="relative">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle className="text-slate-800" strokeWidth="6" stroke="currentColor" fill="transparent" r="60" cx="64" cy="64" />
            <circle className="text-brand transition-all duration-1000 ease-out" strokeWidth="6" strokeDasharray={376.8} strokeDashoffset={376.8 - (376.8 * overallReadiness) / 100} strokeLinecap="round" stroke="currentColor" fill="transparent" r="60" cx="64" cy="64" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-black text-2xl">{overallReadiness}%</span>
          </div>
        </div>
        <div className="flex-1 space-y-2 text-center md:text-left">
          <span className="text-[10px] font-black text-brand uppercase tracking-[0.4em] block mb-1">Operational Readiness Status</span>
          <div className="text-white font-black text-4xl uppercase tracking-tighter">
            {overallReadiness === 100 ? 'Go for Mission' : overallReadiness > 80 ? 'Final Authorization' : 'Pre-Operational'}
          </div>
          <p className="text-slate-500 text-sm font-medium">Framework condition set to <span className="uppercase text-white font-black">{project.deploymentType}</span>. Total of {totalItemsCount} checkpoints identified.</p>
        </div>
        {isEditMode && (
          <button 
            onClick={handleAddCategory}
            className="px-8 py-4 bg-brand/10 text-brand border border-brand/20 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand hover:text-white transition-all flex items-center gap-2"
          >
            <Plus size={16}/> New Category
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredCategories.map((category) => {
          const progress = getCategoryProgress(category);
          return (
            <div key={category.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col group/card">
              <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4 flex-1">
                  {isEditMode ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input 
                        className="bg-transparent border-b-2 border-brand/20 font-black text-slate-800 uppercase text-sm tracking-tight outline-none focus:border-brand w-full"
                        value={category.name}
                        onChange={e => handleUpdateCategoryName(category.id, e.target.value)}
                      />
                      <button onClick={() => handleRemoveCategory(category.id)} className="p-2 text-slate-300 hover:text-brand transition-colors"><Trash2 size={16}/></button>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 bg-white rounded-2xl shadow-sm">
                        <ClipboardCheck className="text-brand" size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">{category.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{category.items.length} Task Nodes</p>
                      </div>
                    </>
                  )}
                </div>
                {!isEditMode && (
                  <div className="text-right ml-4">
                    <span className={`text-xs font-black uppercase ${progress === 100 ? 'text-emerald-500' : 'text-slate-400'}`}>{progress}%</span>
                    <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${progress === 100 ? 'bg-emerald-500' : 'bg-brand'}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-8 space-y-4 flex-1">
                {category.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                    {!isEditMode ? (
                      <button 
                        onClick={() => handleToggle(category.id, item.id)}
                        className="mt-0.5 shrink-0 transition-all hover:scale-110 active:scale-90"
                      >
                        {item.isComplete ? (
                          <CheckCircle2 className="text-emerald-500" size={24} />
                        ) : (
                          <Circle className="text-slate-200 group-hover:text-slate-300" size={24} />
                        )}
                      </button>
                    ) : (
                      <button onClick={() => handleRemoveItem(category.id, item.id)} className="mt-1 text-slate-300 hover:text-brand"><X size={20}/></button>
                    )}
                    
                    <div className="flex-1 space-y-2">
                      {isEditMode ? (
                        <div className="space-y-2">
                          <input 
                            className="w-full bg-transparent border-b border-slate-200 font-bold text-slate-700 text-sm outline-none focus:border-brand py-1"
                            value={item.task}
                            onChange={e => handleUpdateItemTask(category.id, item.id, e.target.value)}
                          />
                        </div>
                      ) : (
                        <p className={`text-sm font-bold transition-all ${item.isComplete ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                          {item.task}
                        </p>
                      )}
                      
                      {!isEditMode && item.type === 'date' && (
                        <input 
                          type="date"
                          className="w-full max-w-[200px] px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-brand"
                          value={item.value || ''}
                          onChange={(e) => handleValueChange(category.id, item.id, e.target.value)}
                        />
                      )}

                      {!isEditMode && item.type === 'select' && item.options && (
                        <div className="flex gap-2">
                          {item.options.map((opt) => (
                            <button
                              key={opt}
                              onClick={() => handleValueChange(category.id, item.id, opt)}
                              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${item.value === opt ? 'bg-black text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isEditMode && (
                  <button 
                    onClick={() => handleAddItem(category.id)}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-300 hover:text-brand hover:border-brand transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={16}/> <span className="text-[10px] font-black uppercase tracking-widest">Add Item</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredCategories.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-black uppercase tracking-widest">No protocol categories defined for this deployment framework.</p>
          </div>
        )}
      </div>
    </div>
  );
};
