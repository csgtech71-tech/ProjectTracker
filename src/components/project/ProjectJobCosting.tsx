
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, CostingItem } from '../../types';
import { 
  Plus, 
  Trash2, 
  DollarSign, 
  RotateCcw, 
  Save, 
  Check, 
  Globe, 
  Briefcase, 
  Clock, 
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  ArrowRightLeft,
  Printer
} from 'lucide-react';

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
}

const DEFAULT_ITEMS: CostingItem[] = [
  { id: '1', service: 'Project Management', hours: 24, rate: 225 },
  { id: '2', service: 'Remote Installation', hours: 20, rate: 225 },
  { id: '3', service: 'On-Site Installation + Testing', hours: 80, rate: 275 },
  { id: '4', service: 'On-Site Installation + Testing (After Hours)', hours: 20, rate: 400 },
  { id: '5', service: 'Remote Creation of LMS Material', hours: 8, rate: 225 },
  { id: '6', service: 'Travel Time between locations', hours: 8, rate: 225 },
  { id: '7', service: 'One-time On-Site Training', hours: 2, rate: 225 },
  { id: '8', service: 'Remote Post Implementation Support Hours', hours: 20, rate: 225 },
];

export const ProjectJobCosting: React.FC<Props> = ({ project, onUpdate }) => {
  const [items, setItems] = useState<CostingItem[]>(project.costingItems || DEFAULT_ITEMS);
  const [currency, setCurrency] = useState<'USD' | 'CAD'>(project.costingCurrency || 'USD');
  const [showSaved, setShowSaved] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(project.costingItems || DEFAULT_ITEMS);
    setCurrency(project.costingCurrency || 'USD');
  }, [project.id]);

  const totals = useMemo(() => {
    const hours = items.reduce((acc, item) => acc + (Number(item.hours) || 0), 0);
    const cost = items.reduce((acc, item) => acc + ((Number(item.hours) || 0) * (Number(item.rate) || 0)), 0);
    return { hours, cost };
  }, [items]);

  const handleUpdateItem = (id: string, field: keyof CostingItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleAddRow = () => {
    const newItem: CostingItem = {
      id: crypto.randomUUID(),
      service: '',
      hours: 0,
      rate: 0
    };
    setItems([...items, newItem]);
  };

  const handleRemoveRow = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleReset = () => {
    if (confirm("Reset to default line items? Current changes will be lost.")) {
      setItems(DEFAULT_ITEMS);
    }
  };

  const handleSave = () => {
    onUpdate({
      ...project,
      costingItems: items,
      costingCurrency: currency,
      sowCost: totals.cost 
    });
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const toggleCurrency = () => {
    setCurrency(prev => prev === 'USD' ? 'CAD' : 'USD');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Job Costing - ${project.customerName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { padding: 40px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="mb-10 flex justify-between items-end border-b-4 border-black pb-8">
            <div>
              <h1 class="text-4xl font-black uppercase tracking-tighter">Job Costing Sheet</h1>
              <p class="text-slate-500 font-bold uppercase text-xs tracking-widest mt-1">Project: ${project.title}</p>
            </div>
            <div class="text-right">
              <p class="text-slate-900 font-black uppercase text-sm">${project.customerName}</p>
              <p class="text-slate-400 font-bold text-[10px] uppercase">${new Date().toLocaleDateString()} | ${currency}</p>
            </div>
          </div>

          <table class="w-full text-left border-collapse mb-12">
            <thead>
              <tr class="bg-slate-100 border-b-2 border-black">
                <th class="p-4 text-[10px] font-black uppercase">Service</th>
                <th class="p-4 text-[10px] font-black uppercase text-center">Hours</th>
                <th class="p-4 text-[10px] font-black uppercase text-center">Rate</th>
                <th class="p-4 text-[10px] font-black uppercase text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr class="border-b border-slate-100">
                  <td class="p-4 text-sm font-bold">${item.service}</td>
                  <td class="p-4 text-sm font-bold text-center">${item.hours}</td>
                  <td class="p-4 text-sm font-bold text-center">$${item.rate}</td>
                  <td class="p-4 text-sm font-black text-right">$${(item.hours * item.rate).toLocaleString()}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot class="bg-black text-white">
              <tr>
                <td class="p-6 font-black uppercase text-sm">Grand Total</td>
                <td class="p-6 font-black text-center text-lg">${totals.hours}</td>
                <td class="p-6"></td>
                <td class="p-6 font-black text-right text-2xl">$${totals.cost.toLocaleString()} ${currency}</td>
              </tr>
            </tfoot>
          </table>

          <div class="grid grid-cols-2 gap-20 mt-20">
            <div class="border-t border-slate-300 pt-4">
              <p class="text-[10px] font-black uppercase text-slate-400">Client Approval Signature</p>
            </div>
            <div class="border-t border-slate-300 pt-4">
              <p class="text-[10px] font-black uppercase text-slate-400">Internal Operations Approval</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">Job Costing</h2>
          <p className="text-sm text-slate-500 font-medium italic">Detailed service allocation and fiscal modeling.</p>
        </div>
        <div className="flex gap-3 no-print">
          <button 
            onClick={toggleCurrency}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <ArrowRightLeft size={16} className="text-brand" /> {currency} Preferred
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            <Printer size={16} /> Print Sheet
          </button>
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            <RotateCcw size={16} /> Reset
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-8 py-2.5 bg-black text-white rounded-2xl hover:bg-brand transition-all font-black text-[10px] uppercase tracking-widest shadow-xl shadow-black/20"
          >
            {showSaved ? <Check size={16} /> : <Save size={16} />} {showSaved ? 'Synchronized' : 'Save Sheet'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Receipt size={100} /></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Project Value</span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-slate-900 tracking-tighter">${totals.cost.toLocaleString()}</span>
            <span className="text-sm font-black text-slate-400 uppercase">{currency}</span>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Clock size={100} /></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Allocated Labor</span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-brand tracking-tighter">{totals.hours}</span>
            <span className="text-sm font-black text-slate-400 uppercase">Hours</span>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><TrendingUp size={100} /></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Average Blended Rate</span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black text-slate-900 tracking-tighter">${totals.hours > 0 ? Math.round(totals.cost / totals.hours) : 0}</span>
            <span className="text-sm font-black text-slate-400 uppercase">/{currency} Hr</span>
          </div>
        </div>
      </div>

      <div ref={tableRef} className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-12 py-8 bg-slate-900 text-white flex justify-between items-center no-print">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center shadow-lg"><FileSpreadsheet size={24}/></div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tighter">Line Item Specification</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Service Breakdown Ledger</p>
            </div>
          </div>
          <button 
            onClick={handleAddRow}
            className="px-6 py-2.5 bg-brand text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-dark transition-all flex items-center gap-2"
          >
            <Plus size={16} /> New Service Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-12 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Service Description</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-32">Hours</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-48">Rate ({currency})</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right w-48">Row Total</th>
                <th className="px-8 py-6 w-20 no-print"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-12 py-5">
                    <input 
                      className="w-full bg-transparent border-none outline-none font-bold text-slate-800 focus:text-brand transition-colors text-sm"
                      placeholder="e.g. System Calibration"
                      value={item.service}
                      onChange={e => handleUpdateItem(item.id, 'service', e.target.value)}
                    />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center">
                      <input 
                        type="number"
                        className="w-24 text-center bg-slate-50 border-2 border-slate-100 rounded-xl py-2 font-black text-slate-900 outline-none focus:border-brand transition-all"
                        value={item.hours}
                        onChange={e => handleUpdateItem(item.id, 'hours', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex justify-center">
                      <div className="relative w-full max-w-[140px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold">$</span>
                        <input 
                          type="number"
                          className="w-full pl-8 pr-3 bg-slate-50 border-2 border-slate-100 rounded-xl py-2 font-black text-slate-900 outline-none focus:border-brand transition-all"
                          value={item.rate}
                          onChange={e => handleUpdateItem(item.id, 'rate', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right font-black text-slate-900 whitespace-nowrap">
                    <span className="text-slate-300 mr-1">$</span>
                    {(item.hours * item.rate).toLocaleString()}
                  </td>
                  <td className="px-8 py-5 text-right no-print">
                    <button 
                      onClick={() => handleRemoveRow(item.id)}
                      className="p-2 text-slate-300 hover:text-brand transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">
                    Ledger Empty. Add a Service Line to Begin Costing.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950 text-white font-black">
                <td className="px-12 py-8 uppercase tracking-[0.2em] text-sm">Grand Operational Total</td>
                <td className="px-8 py-8 text-center text-xl text-brand">{totals.hours} <span className="text-[10px] text-slate-500">HRS</span></td>
                <td className="px-8 py-8" />
                <td className="px-8 py-8 text-right text-3xl tracking-tighter whitespace-nowrap">
                  <span className="text-slate-600 mr-2">$</span>
                  {totals.cost.toLocaleString()}
                  <span className="text-[10px] text-slate-500 ml-2 tracking-widest">{currency}</span>
                </td>
                <td className="no-print" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      <div className="flex justify-center pt-6 no-print">
        <div className="max-w-2xl bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex gap-6 items-center">
          <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-brand shrink-0">
            <Globe size={28} />
          </div>
          <div>
            <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest">Currency Sensitivity</h4>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium mt-1">
              Toggle between <span className="font-black text-slate-900">USD</span> and <span className="font-black text-slate-900">CAD</span> for regional fiscal alignment. 
              Note: This is a labeling override and does not perform real-time FX conversions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
