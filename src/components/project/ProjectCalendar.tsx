
import React, { useState, useRef, useMemo } from 'react';
import { Project, Milestone, MilestoneType, TimelineItem } from '../../types';
import { 
  Calendar as CalIcon, 
  Flag, 
  Play, 
  Trophy, 
  Users, 
  Clock, 
  Pause, 
  Ban, 
  AlertTriangle, 
  CheckCircle, 
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  Mail,
  CalendarDays,
  Trash2,
  Repeat,
  Timer,
  UserCheck,
  ShieldCheck
} from 'lucide-react';

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
}

const TYPE_CONFIG: Record<MilestoneType, { icon: any, color: string, label: string, tooltip: string }> = {
  start: { 
    icon: Play, 
    color: 'bg-brand', 
    label: 'Program Start',
    tooltip: 'Official commencement of all hardware project activities and initial deployments.'
  },
  finish: { 
    icon: Trophy, 
    color: 'bg-emerald-600', 
    label: 'Completion',
    tooltip: 'Formal project conclusion, final sign-off, and wrap-up of all data collection.'
  },
  meeting: { 
    icon: Users, 
    color: 'bg-black', 
    label: 'Cadence Meeting',
    tooltip: 'Regularly scheduled synchronization session between client and internal stakeholders.'
  },
  delayed: { 
    icon: Clock, 
    color: 'bg-amber-500', 
    label: 'Delayed',
    tooltip: 'Timeline slippage or schedule adjustment due to resource or logistical constraints.'
  },
  onhold: { 
    icon: Pause, 
    color: 'bg-slate-400', 
    label: 'On Hold',
    tooltip: 'Project activities paused temporarily; awaiting further authorization or clarification.'
  },
  blocked: { 
    icon: Ban, 
    color: 'bg-brand', 
    label: 'Blocked',
    tooltip: 'Critical impediment or dependency preventing any further project progression.'
  },
  success: { 
    icon: CheckCircle, 
    color: 'bg-emerald-500', 
    label: 'Success',
    tooltip: 'Successful achievement of a major success criterion or key performance indicator.'
  },
  failure: { 
    icon: X, 
    color: 'bg-black', 
    label: 'Failure',
    tooltip: 'Missed objective, technical malfunction, or failed performance milestone.'
  },
  exception: { 
    icon: AlertTriangle, 
    color: 'bg-amber-600', 
    label: 'Exception',
    tooltip: 'An unplanned deviation from the standard project protocol or expected hardware behavior.'
  },
  milestone: { 
    icon: Flag, 
    color: 'bg-slate-600', 
    label: 'General Milestone',
    tooltip: 'A significant project checkpoint or noteworthy achievement not tied to a specific outcome.'
  },
  'internal-task': {
    icon: ShieldCheck,
    color: 'bg-[#d12913]',
    label: 'Internal Task',
    tooltip: 'Specific operational commitment from the internal team.'
  },
  'customer-task': {
    icon: UserCheck,
    color: 'bg-slate-900',
    label: 'Customer Task',
    tooltip: 'Specific operational commitment from the client team.'
  },
  touchpoint: {
    icon: Repeat,
    color: 'bg-brand',
    label: 'Touchpoint',
    tooltip: 'Regular touchpoint meeting for questions, feedback, and issues.'
  }
};

const WEEKDAYS = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 },
];

export const ProjectCalendar: React.FC<Props> = ({ project, onUpdate }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Recurrence State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([]);
  const [repeatUntil, setRepeatUntil] = useState('');

  const [newEvent, setNewEvent] = useState<Partial<Milestone>>({
    title: '',
    description: '',
    type: 'meeting'
  });

  const monthName = viewDate.toLocaleString('default', { month: 'long' });
  const year = viewDate.getFullYear();

  // Unified Milestone List (Project Milestones + SOW Timeline Items)
  const unifiedMilestones = useMemo(() => {
    const milestones = [...project.milestones];
    
    // Pull from SOW Sections
    (project.sowSections || []).forEach(section => {
      (section.timelineItems || []).forEach(ti => {
        milestones.push({
          id: `sow-${ti.id}`,
          title: ti.text,
          date: ti.date,
          type: ti.assignee === 'internal' ? 'internal-task' : 'customer-task',
          description: `SOW Criteria: ${ti.text} (${ti.isEod ? 'EOD' : ''})`
        });
      });
    });

    return milestones;
  }, [project.milestones, project.sowSections]);

  const calendarDays = useMemo(() => {
    const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    
    const daysInMonth = endOfMonth.getDate();
    const startDayOfWeek = startOfMonth.getDay(); 
    
    const days = [];
    
    const prevMonthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0);
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, prevMonthEnd.getDate() - i),
        isCurrentMonth: false
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(viewDate.getFullYear(), viewDate.getMonth(), i),
        isCurrentMonth: true
      });
    }
    
    const remaining = 42 - days.length; 
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, i),
        isCurrentMonth: false
      });
    }
    
    return days;
  }, [viewDate]);

  const changeMonth = (offset: number) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1);
    setViewDate(next);
  };

  const getMilestonesForDate = (date: Date) => {
    return unifiedMilestones.filter(m => {
      const d = new Date(m.date);
      return d.getUTCFullYear() === date.getFullYear() && 
             d.getUTCMonth() === date.getMonth() && 
             d.getUTCDate() === date.getDate();
    });
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setNewEvent({ ...newEvent, date: date.toISOString().split('T')[0] });
    setIsRecurring(false);
    setRecurrenceDays([]);
    setRepeatUntil(new Date(date.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setShowAddModal(true);
  };

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    
    let newMilestones: Milestone[] = [];
    
    if (isRecurring && recurrenceDays.length > 0 && repeatUntil) {
      const startDate = new Date(newEvent.date);
      const endDate = new Date(repeatUntil);
      let current = new Date(startDate);
      
      while (current <= endDate) {
        if (recurrenceDays.includes(current.getDay())) {
          newMilestones.push({
            id: crypto.randomUUID(),
            title: newEvent.title!,
            description: newEvent.description || '',
            type: newEvent.type as MilestoneType,
            date: current.toISOString().split('T')[0]
          });
        }
        current.setDate(current.getDate() + 1);
      }
    } else {
      newMilestones.push({
        id: crypto.randomUUID(),
        title: newEvent.title!,
        description: newEvent.description || '',
        type: newEvent.type as MilestoneType,
        date: newEvent.date
      });
    }
    
    onUpdate({ ...project, milestones: [...project.milestones, ...newMilestones] });
    setShowAddModal(false);
    setNewEvent({ title: '', description: '', type: 'meeting' });
  };

  const handleDeleteMilestone = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id.startsWith('sow-')) {
       alert("This milestone is tied to a Statement of Work criteria. Please remove it from the SOW builder tab to maintain operational integrity.");
       return;
    }
    if (confirm("Permanently remove this milestone from the roadmap?")) {
      onUpdate({ ...project, milestones: project.milestones.filter(m => m.id !== id) });
    }
  };

  const toggleDay = (day: number) => {
    setRecurrenceDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handlePrint = () => {
    if (!calendarRef.current) return;
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    const content = calendarRef.current.innerHTML;
    printWindow.document.write(`
      <html>
        <head>
          <title>Timeline - ${monthName} ${year}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: landscape; margin: 0; }
            @media print {
              html, body { margin: 0; padding: 20mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
            body { font-family: sans-serif; }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 800)">
          <div class="mb-10 flex justify-between items-end border-b-2 border-slate-900 pb-6">
            <div>
              <h1 class="text-4xl font-black uppercase tracking-tighter">${project.title}</h1>
              <p class="text-brand font-bold uppercase text-xs tracking-widest">${monthName} ${year} Roadmap</p>
            </div>
            <div class="text-right">
              <p class="text-slate-400 font-black uppercase text-[10px]">Client: ${project.customerName}</p>
            </div>
          </div>
          <div class="scale-[0.85] transform-origin-top">
            ${content}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand/20">
            <CalendarDays size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                {monthName} <span className="text-brand">{year}</span>
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Temporal Roadmap Controller</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm">
            <button 
              onClick={() => changeMonth(-1)} 
              title="Previous Month"
              className="p-2.5 hover:bg-slate-50 text-slate-600 rounded-xl transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setViewDate(new Date())} 
              title="Return to Today"
              className="px-4 text-[10px] font-black uppercase tracking-widest hover:text-brand transition-colors"
            >
              Today
            </button>
            <button 
              onClick={() => changeMonth(1)} 
              title="Next Month"
              className="p-2.5 hover:bg-slate-50 text-slate-600 rounded-xl transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <button 
            onClick={handlePrint}
            title="Print Calendar"
            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all shadow-xl shadow-black/10"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 max-w-full no-print bg-white p-4 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar">
        {Object.entries(TYPE_CONFIG).map(([type, config]) => (
          <div 
            key={type} 
            title={config.tooltip}
            className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl cursor-help transition-all hover:bg-white hover:shadow-sm shrink-0"
          >
            <div className={`w-2 h-2 rounded-full ${config.color}`} />
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">{config.label}</span>
          </div>
        ))}
      </div>

      <div ref={calendarRef} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
            <div key={d} className="text-center py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {d}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-px bg-slate-100">
          {calendarDays.map((day, idx) => {
            const dayMilestones = getMilestonesForDate(day.date);
            const isToday = day.date.toDateString() === new Date().toDateString();

            return (
              <div 
                key={idx} 
                onClick={() => handleDayClick(day.date)}
                className={`bg-white min-h-[160px] p-4 relative hover:bg-brand/5 cursor-pointer transition-all group
                  ${!day.isCurrentMonth ? 'opacity-40 grayscale-[0.5]' : ''}
                  ${isToday ? 'bg-brand/5' : ''}
                `}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-sm font-black transition-colors ${isToday ? 'text-brand' : day.isCurrentMonth ? 'text-slate-900' : 'text-slate-400'}`}>
                    {day.date.getDate()}
                  </span>
                  {isToday && <span className="text-[8px] font-black text-brand bg-brand/10 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Current</span>}
                </div>
                
                <div className="space-y-1.5 overflow-y-auto max-h-[110px] no-scrollbar">
                  {dayMilestones.map(ms => {
                    const config = TYPE_CONFIG[ms.type] || TYPE_CONFIG.milestone;
                    const Icon = config.icon;
                    return (
                      <div 
                        key={ms.id} 
                        title={`${config.label}${ms.description ? `: ${ms.description}` : ''}`}
                        className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border shadow-sm text-[9px] leading-none transition-transform hover:scale-[1.03] font-black uppercase tracking-tight relative group/item
                          ${ms.type === 'blocked' || ms.type === 'internal-task' ? 'bg-[#d12913] text-white border-brand' : ''}
                          ${ms.type === 'meeting' || ms.type === 'customer-task' ? 'bg-slate-900 text-white border-slate-900' : ''}
                          ${ms.type === 'delayed' ? 'bg-amber-50 border-amber-200 text-amber-700' : ''}
                          ${ms.type === 'success' || ms.type === 'finish' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-slate-100 text-slate-700'}
                        `}
                      >
                        <Icon size={12} className="shrink-0" />
                        <span className="truncate pr-4">{ms.title}</span>
                        <button 
                          onClick={(e) => handleDeleteMilestone(e, ms.id)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 hover:text-red-500 transition-all p-0.5 no-print"
                          title="Delete Milestone"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                   <Plus size={16} className="text-brand" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Roadmap Entry</h3>
                <p className="text-[10px] text-brand font-black uppercase tracking-widest mt-1">
                  Target: {selectedDate?.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Event Title</label>
                    <input 
                      autoFocus
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand outline-none transition-all text-slate-900 font-bold"
                      placeholder="e.g. Sync Session"
                      value={newEvent.title}
                      onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Classification</label>
                    <div className="grid grid-cols-5 gap-3">
                      {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                        if (type === 'internal-task' || type === 'customer-task') return null;
                        const Icon = config.icon;
                        return (
                          <button
                            key={type}
                            title={config.label}
                            onClick={() => setNewEvent({...newEvent, type: type as MilestoneType})}
                            className={`group flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all
                              ${newEvent.type === type 
                                ? `border-brand bg-brand/5 scale-105 shadow-md` 
                                : 'border-transparent bg-slate-50 hover:bg-slate-100'
                              }
                            `}
                          >
                            <Icon size={20} className={newEvent.type === type ? 'text-brand' : 'text-slate-400'} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Repeat size={14} className="text-brand"/> Repeat Protocol
                    </h4>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} />
                      <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>

                  {isRecurring && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Occurrence Pattern</label>
                        <div className="flex justify-between">
                          {WEEKDAYS.map(day => (
                            <button
                              key={day.value}
                              onClick={() => toggleDay(day.value)}
                              className={`w-8 h-8 rounded-lg font-black text-[10px] flex items-center justify-center transition-all
                                ${recurrenceDays.includes(day.value) ? 'bg-brand text-white shadow-lg' : 'bg-white text-slate-300 hover:text-slate-900'}
                              `}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Repeat Until</label>
                        <input 
                          type="date"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-brand"
                          value={repeatUntil}
                          onChange={e => setRepeatUntil(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  {!isRecurring && (
                    <p className="text-[10px] font-medium text-slate-400 italic">One-time operational event.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Brief / Context</label>
                <textarea 
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-brand outline-none transition-all h-24 resize-none text-slate-700 font-medium text-sm"
                  placeholder="Additional operational details..."
                  value={newEvent.description}
                  onChange={e => setNewEvent({...newEvent, description: e.target.value})}
                />
              </div>
            </div>

            <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-5 shrink-0">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Abort</button>
              <button 
                onClick={handleAddEvent}
                className="px-10 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20 hover:bg-brand transition-all flex items-center gap-3"
              >
                {isRecurring ? <Repeat size={16} /> : <CheckCircle size={16} />}
                {isRecurring ? 'Batch Deploy' : 'Sync to Roadmap'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
