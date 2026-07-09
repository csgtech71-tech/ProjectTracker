
import React, { useState } from 'react';
import { Project, SurveyQuestion } from '../../types';
import { 
  FileSignature, 
  Send, 
  CheckCircle2, 
  RefreshCw, 
  Star, 
  Calendar, 
  X, 
  Plus, 
  Trash2, 
  Trophy, 
  ArrowRight, 
  Archive, 
  Download,
  FileCheck2,
  Sparkles,
  ShieldCheck,
  ClipboardCheck,
  UserCheck,
  AlertCircle
} from 'lucide-react';

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
}

export const ProjectClosing: React.FC<Props> = ({ project, onUpdate }) => {
  const [signingAs, setSigningAs] = useState<'customer' | 'our' | null>(null);
  const [sigName, setSigName] = useState('');
  const [sentSurvey, setSentSurvey] = useState(false);
  const [closeMode, setCloseMode] = useState<'close' | 'extend'>(project.isExtended ? 'extend' : 'close');

  const handleSign = () => {
    if (!signingAs || !sigName) return;
    const isNowClosed = signingAs === 'our' 
      ? (project.customerSignature ? true : false) 
      : (project.ourSignature ? true : false);
      
    onUpdate({
      ...project,
      [signingAs === 'customer' ? 'customerSignature' : 'ourSignature']: sigName,
      isClosed: isNowClosed
    });
    setSigningAs(null);
    setSigName('');
  };

  const handleToggleExtend = () => {
    const isNowExtended = !project.isExtended;
    onUpdate({ 
      ...project, 
      isExtended: isNowExtended,
      extendedEndDate: isNowExtended ? (project.extendedEndDate || new Date(new Date(project.endDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) : project.extendedEndDate
    });
  };

  const handleExtensionDetailsUpdate = (field: 'extensionReason' | 'extendedEndDate', value: string) => {
    onUpdate({ ...project, [field]: value });
  };

  const handleAddQuestion = () => {
    const newQ: SurveyQuestion = {
      id: crypto.randomUUID(),
      question: '',
      type: 'rating'
    };
    onUpdate({ ...project, surveyQuestions: [...project.surveyQuestions, newQ] });
  };

  const handleUpdateQuestion = (id: string, text: string) => {
    onUpdate({
      ...project,
      surveyQuestions: project.surveyQuestions.map(q => q.id === id ? { ...q, question: text } : q)
    });
  };

  const handleUpdateQuestionType = (id: string, type: 'rating' | 'text' | 'boolean') => {
    onUpdate({
      ...project,
      surveyQuestions: project.surveyQuestions.map(q => q.id === id ? { ...q, type } : q)
    });
  };

  const handleRemoveQuestion = (id: string) => {
    onUpdate({
      ...project,
      surveyQuestions: project.surveyQuestions.filter(q => q.id !== id)
    });
  };

  const handleSendSurvey = () => {
    setSentSurvey(true);
    setTimeout(() => setSentSurvey(false), 3000);
  };

  if (project.isClosed) {
    return (
      <div className="max-w-4xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
        <div className="bg-emerald-600 rounded-[3rem] p-16 text-white text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none -rotate-12"><Trophy size={200} /></div>
          <div className="absolute bottom-0 left-0 p-12 opacity-10 pointer-events-none rotate-12"><Sparkles size={160} /></div>
          
          <div className="relative z-10 space-y-8">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto shadow-inner">
               <FileCheck2 size={48} />
            </div>
            <div className="space-y-4">
              <h2 className="text-5xl font-black uppercase tracking-tighter leading-none">Pilot Successfully Concluded</h2>
              <p className="text-xl font-medium text-emerald-100 italic">"The program objectives for {project.customerName} have been fully verified and signed off."</p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 pt-6">
              <button className="px-10 py-4 bg-white text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2">
                <Download size={18} /> Export Completion Report
              </button>
              <button className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2">
                <Archive size={18} /> Archive Project Folder
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                <FileSignature size={14}/> Client Verification
              </h4>
              <div className="space-y-2">
                {project.customerSignature?.startsWith('data:image')
                  ? <img src={project.customerSignature} alt="Signature" className="max-h-20 max-w-full object-contain" />
                  : <p className="text-4xl font-serif italic text-slate-900">{project.customerSignature}</p>}
                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Authorized & Synchronized</p>
              </div>
           </div>
           <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                <ShieldCheck size={14}/> Provider Release
              </h4>
              <div className="space-y-2">
                {project.ourSignature?.startsWith('data:image')
                    ? <img src={project.ourSignature} alt="Authorization Signature" className="max-h-20 max-w-full object-contain" />
                    : <p className="text-4xl font-serif italic text-slate-900">{project.ourSignature}</p>}
                <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Executive Authorization Verified</p>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">Pilot Conclusion Protocol</h2>
        <p className="text-slate-500 max-w-xl mx-auto font-medium leading-relaxed">
          Finalize the hardware pilot by executing a formal joint sign-off or initiating a technical extension for additional discovery.
        </p>
      </div>

      {/* Closure Mode Selector */}
      <div className="flex bg-slate-100 p-1.5 rounded-3xl max-w-md mx-auto shadow-inner border border-slate-200">
         <button 
          onClick={() => setCloseMode('close')}
          className={`flex-1 py-4 px-6 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${closeMode === 'close' ? 'bg-black text-white shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
         >
           <ClipboardCheck size={16} /> Final Close-Out
         </button>
         <button 
          onClick={() => setCloseMode('extend')}
          className={`flex-1 py-4 px-6 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${closeMode === 'extend' ? 'bg-brand text-white shadow-xl' : 'text-slate-500 hover:text-slate-800'}`}
         >
           <RefreshCw size={16} /> Pilot Extension
         </button>
      </div>

      {closeMode === 'close' ? (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Customer Sign-off */}
            <div className={`p-10 rounded-[2.5rem] border-2 transition-all ${project.customerSignature ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${project.customerSignature ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <UserCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Authorization</h3>
                    <p className="font-black text-slate-900 text-xl tracking-tight uppercase truncate">{project.customerName}</p>
                  </div>
                </div>
                {project.customerSignature && <CheckCircle2 className="text-emerald-500" size={24} />}
              </div>
              
              {project.customerSignature ? (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-black text-emerald-600 tracking-widest block">Signature Captured</span>
                  {project.customerSignature?.startsWith('data:image')
                    ? <img src={project.customerSignature} alt="Customer Signature" className="max-h-20 max-w-full object-contain" />
                    : <p className="text-4xl font-serif italic text-emerald-900 tracking-tighter leading-tight">{project.customerSignature}</p>}
                  <p className="text-[10px] text-emerald-500 font-bold uppercase border-t border-emerald-100 pt-3 inline-block">Authenticated: {new Date().toLocaleDateString()}</p>
                </div>
              ) : (
                <div className="space-y-6">
                   <p className="text-xs text-slate-500 leading-relaxed font-medium italic">
                     "Acceptance confirms that all hardware success criteria have been validated to the client's satisfaction."
                   </p>
                   <button 
                    onClick={() => setSigningAs('customer')}
                    className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3"
                  >
                    <FileSignature size={18} /> Execute Client Sign-off
                  </button>
                </div>
              )}
            </div>

            {/* Internal Sign-off */}
            <div className={`p-10 rounded-[2.5rem] border-2 transition-all ${project.ourSignature ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${project.ourSignature ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Provider Authorization</h3>
                    <p className="font-black text-slate-900 text-xl tracking-tight uppercase leading-none">Ops Command</p>
                  </div>
                </div>
                {project.ourSignature && <CheckCircle2 className="text-emerald-500" size={24} />}
              </div>
              
              {project.ourSignature ? (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-black text-emerald-600 tracking-widest block">Executive Release Logged</span>
                  {project.ourSignature?.startsWith('data:image')
                    ? <img src={project.ourSignature} alt="Authorization Signature" className="max-h-20 max-w-full object-contain" />
                    : <p className="text-4xl font-serif italic text-emerald-900 tracking-tighter leading-tight">{project.ourSignature}</p>}
                  <p className="text-[10px] text-emerald-500 font-bold uppercase border-t border-emerald-100 pt-3 inline-block">Authorized: {new Date().toLocaleDateString()}</p>
                </div>
              ) : (
                <div className="space-y-6">
                   <p className="text-xs text-slate-500 leading-relaxed font-medium italic">
                     "Authorizes the formal conclusion of technical resources and archival of project telemetry."
                   </p>
                   <button 
                    onClick={() => setSigningAs('our')}
                    className="w-full py-5 bg-brand text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-brand-dark transition-all shadow-xl shadow-brand/20 flex items-center justify-center gap-3"
                  >
                    <ShieldCheck size={18} /> Authorize Program Release
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {!project.customerSignature || !project.ourSignature ? (
             <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 flex gap-6 items-center">
                <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                   <AlertCircle size={24} />
                </div>
                <div>
                   <h4 className="font-black text-amber-900 uppercase text-xs tracking-widest">Dual-Party Authentication Required</h4>
                   <p className="text-[11px] text-amber-700 font-medium leading-relaxed mt-1">
                      Both parties must provide authenticated signatures to transition this pilot to "Completed" status.
                   </p>
                </div>
             </div>
          ) : null}
        </div>
      ) : (
        <div className={`rounded-[3rem] border transition-all overflow-hidden animate-in slide-in-from-top-4 duration-500 ${project.isExtended ? 'bg-brand/5 border-brand/20 shadow-2xl' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="p-12 flex items-center justify-between">
            <div className="flex gap-8 items-center">
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all ${project.isExtended ? 'bg-brand text-white shadow-xl shadow-brand/30' : 'bg-slate-100 text-slate-400'}`}>
                <RefreshCw size={40} className={project.isExtended ? 'animate-spin-slow' : ''} />
              </div>
              <div>
                <h4 className={`font-black uppercase tracking-tighter text-3xl ${project.isExtended ? 'text-brand' : 'text-slate-900'}`}>Extension Protocol</h4>
                <p className="text-sm text-slate-500 font-medium italic">Override termination and set a new discovery window.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer scale-150 mr-6">
              <input type="checkbox" className="sr-only peer" checked={project.isExtended} onChange={handleToggleExtend} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand"></div>
            </label>
          </div>

          {project.isExtended && (
            <div className="px-12 pb-16 pt-4 space-y-10">
              <div className="h-px bg-brand/10" />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                <div className="md:col-span-8 space-y-4">
                  <label className="block text-[10px] font-black text-brand uppercase tracking-[0.3em] ml-1">Extension Rationalization</label>
                  <textarea 
                    className="w-full px-8 py-6 bg-white border border-brand/20 rounded-[2rem] focus:ring-2 focus:ring-brand outline-none h-48 resize-none text-slate-800 text-sm font-medium shadow-inner placeholder:text-slate-300 leading-relaxed"
                    placeholder="Provide detailed technical or business reasons for extending the pilot beyond the original termination date..."
                    value={project.extensionReason || ''}
                    onChange={e => handleExtensionDetailsUpdate('extensionReason', e.target.value)}
                  />
                </div>
                <div className="md:col-span-4 space-y-8">
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-brand uppercase tracking-[0.3em] ml-1">New Terminal Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-brand" size={20} />
                      <input 
                        type="date"
                        className="w-full pl-14 pr-8 py-6 bg-white border border-brand/20 rounded-[2rem] focus:ring-2 focus:ring-brand outline-none text-sm font-black text-slate-900 shadow-sm"
                        value={project.extendedEndDate || ''}
                        onChange={e => handleExtensionDetailsUpdate('extendedEndDate', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="bg-white/50 p-6 rounded-[2rem] border border-brand/10 text-[11px] text-slate-500 leading-relaxed font-medium italic shadow-sm">
                    "Formal extension protocols modify the original project charter and require reallocation of field engineering resources."
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Survey Section */}
      <div className="bg-white rounded-[3rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-brand/10 text-brand rounded-2xl"><Star size={24}/></div>
             <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Exit Satisfaction Matrix</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Operational Feedback Collection</p>
            </div>
          </div>
          <button 
            onClick={handleAddQuestion}
            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl hover:bg-brand transition-all font-black text-[10px] uppercase tracking-widest shadow-xl"
          >
            <Plus size={16} /> New Survey Node
          </button>
        </div>

        <div className="p-10 space-y-6">
          {project.surveyQuestions.length === 0 ? (
            <div className="text-center py-20 text-slate-300">
              <Star className="mx-auto mb-4 opacity-5" size={80} />
              <p className="font-black uppercase text-xs tracking-[0.4em]">Survey Deck Uninitialized</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4">
                {project.surveyQuestions.map((q, i) => (
                  <div key={q.id} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6 group relative hover:border-brand/20 transition-all">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-black text-white rounded-lg flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Question Protocol</label>
                      </div>
                      <button 
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="text-slate-300 hover:text-brand transition-colors p-2"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <input 
                          className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand outline-none text-sm font-bold placeholder:italic"
                          placeholder="Describe the performance metric to evaluate..."
                          value={q.question}
                          onChange={(e) => handleUpdateQuestion(q.id, e.target.value)}
                        />
                      </div>
                      <div className="md:w-48">
                        <select 
                          className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand outline-none text-[10px] font-black uppercase tracking-widest text-slate-700 appearance-none cursor-pointer"
                          value={q.type}
                          onChange={(e) => handleUpdateQuestionType(q.id, e.target.value as any)}
                        >
                          <option value="rating">Numeric Rating</option>
                          <option value="boolean">Success Binary</option>
                          <option value="text">Narrative Response</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-10 flex justify-center">
                <button 
                  onClick={handleSendSurvey}
                  disabled={!project.isClosed || sentSurvey || project.surveyQuestions.length === 0}
                  className={`flex items-center gap-4 px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-2xl
                    ${sentSurvey ? 'bg-emerald-500 text-white' : 'bg-black text-white hover:bg-brand shadow-black/20'}
                    disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none
                  `}
                >
                  {sentSurvey ? <CheckCircle2 size={20} /> : <Send size={20} />} 
                  {sentSurvey ? 'Telemetry Transmitted' : 'Dispatch Client Survey'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Signature Modal */}
      {signingAs && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-brand/30">
            <div className="p-10 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Legal Authorization</h3>
                <p className="text-[10px] text-brand font-black uppercase tracking-widest mt-1">Hardware Project Conclusion Record</p>
              </div>
              <button onClick={() => setSigningAs(null)} className="text-slate-300 hover:text-black transition-colors"><X size={28}/></button>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Type Legal Signature</label>
                <input 
                  autoFocus
                  className="w-full px-8 py-6 border-2 border-slate-100 bg-slate-50 rounded-3xl focus:ring-4 focus:ring-brand/5 focus:border-brand outline-none text-4xl italic font-serif text-slate-900 shadow-inner"
                  placeholder="Full Name"
                  value={sigName}
                  onChange={e => setSigName(e.target.value)}
                />
              </div>
              <div className="p-6 bg-slate-950 rounded-2xl space-y-4 border border-white/5 shadow-xl">
                 <div className="flex gap-3 text-[10px] text-slate-400 leading-tight font-medium">
                    <ShieldCheck size={16} className="text-brand shrink-0" />
                    <p>Electronic signature is legally binding and acknowledges that all pilot deliverables have been fulfilled.</p>
                 </div>
              </div>
            </div>
            <div className="p-10 bg-slate-50 flex justify-end gap-6">
              <button onClick={() => setSigningAs(null)} className="px-6 py-3 text-xs font-black uppercase text-slate-400 hover:text-slate-800 transition-colors">Abort</button>
              <button 
                onClick={handleSign} 
                disabled={!sigName.trim()}
                className="px-10 py-4 bg-brand text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-brand/30 hover:bg-brand-dark disabled:opacity-30 disabled:hover:bg-brand"
              >
                Sync & Finalize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
