
import React, { useState, useRef } from 'react';
import { Project, Contact } from '../../types';
import { Plus, User, Mail, Phone, MapPin, Building, Info, Trash2, Edit3, X, Users, Upload, Download, FileSpreadsheet, Check } from 'lucide-react';

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
}

export const ProjectContacts: React.FC<Props> = ({ project, onUpdate }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Contact>>({
    side: 'customer',
    name: '',
    role: '',
    email: '',
    phone: '',
    location: '',
    address: '',
    notes: ''
  });

  const handleOpenAdd = (side: 'customer' | 'internal') => {
    setEditingId(null);
    setFormData({ side, name: '', role: '', email: '', phone: '', location: '', address: '', notes: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (contact: Contact) => {
    setEditingId(contact.id);
    setFormData(contact);
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.name) return;
    let updatedContacts: Contact[];
    if (editingId) {
      updatedContacts = project.contacts.map(c => c.id === editingId ? { ...c, ...formData } as Contact : c);
    } else {
      const newContact: Contact = { ...formData, id: crypto.randomUUID() } as Contact;
      updatedContacts = [...project.contacts, newContact];
    }
    onUpdate({ ...project, contacts: updatedContacts });
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Revoke this stakeholder's access record?")) {
      onUpdate({ ...project, contacts: project.contacts.filter(c => c.id !== id) });
    }
  };

  const handleDownloadTemplate = () => {
    const headers = "Name,Role,Email,Phone,Side(customer/internal),Location,Address,Notes";
    const example = "John Smith,Technical Lead,j.smith@client.com,555-0199,customer,Main Hub,123 West Dr,Primary onsite POC";
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + example;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "stakeholder_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const importedContacts: Contact[] = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const c: any = { id: crypto.randomUUID() };
          headers.forEach((header, i) => {
            const val = values[i] || '';
            if (header.includes('name')) c.name = val;
            else if (header.includes('role')) c.role = val;
            else if (header.includes('email')) c.email = val;
            else if (header.includes('phone')) c.phone = val;
            else if (header.includes('side')) c.side = val.toLowerCase().includes('internal') ? 'internal' : 'customer';
            else if (header.includes('location')) c.location = val;
            else if (header.includes('address')) c.address = val;
            else if (header.includes('notes')) c.notes = val;
          });
          return c as Contact;
        }).filter(c => c.name);

        if (importedContacts.length > 0) {
          onUpdate({ ...project, contacts: [...project.contacts, ...importedContacts] });
          setImportStatus('success');
          setTimeout(() => setImportStatus('idle'), 3000);
        }
      } catch (err) {
        console.error("Import error", err);
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderContactList = (side: 'customer' | 'internal', title: string) => {
    const contacts = project.contacts.filter(c => c.side === side);
    return (
      <div className="space-y-5">
        <div className="flex justify-between items-center px-4 bg-black/5 py-3 rounded-xl border border-black/5">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{title}</h3>
          <button onClick={() => handleOpenAdd(side)} className="flex items-center gap-2 text-[10px] font-black text-brand uppercase tracking-widest hover:text-brand-dark transition-colors">
            <Plus size={14} /> Add Stakeholder
          </button>
        </div>
        <div className="grid grid-cols-1 gap-5">
          {contacts.length === 0 && (
            <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-3xl text-slate-300 text-[10px] font-black uppercase tracking-[0.3em]">
              Directory Empty
            </div>
          )}
          {contacts.map(contact => (
            <div key={contact.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all group relative border-l-4 hover:border-l-brand">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg ${side === 'customer' ? 'bg-black' : 'bg-brand'}`}>
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-lg tracking-tighter uppercase leading-none mb-1">{contact.name}</h4>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{contact.role || 'Stakeholder'}</p>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenEdit(contact)} className="p-2.5 bg-slate-50 hover:bg-black hover:text-white rounded-xl text-slate-400 transition-all"><Edit3 size={16} /></button>
                  <button onClick={() => handleDelete(contact.id)} className="p-2.5 bg-slate-50 hover:bg-brand hover:text-white rounded-xl text-slate-400 transition-all"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                  <Mail size={14} className="text-slate-300"/> <span className="truncate">{contact.email || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                  <Phone size={14} className="text-slate-300"/> <span>{contact.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600 font-medium">
                  <MapPin size={14} className="text-slate-300"/> <span>{contact.location || 'N/A'}</span>
                </div>
                {contact.notes && (
                  <div className="flex items-center gap-3 text-xs text-slate-600 font-medium col-span-full">
                    <Info size={14} className="text-slate-300"/> <span>{contact.notes}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">Stakeholder Matrix</h2>
          <p className="text-sm text-slate-500 font-medium italic">Project command and internal operational team mapping.</p>
        </div>
        <div className="flex gap-3 no-print">
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            <Download size={14} /> Template
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
            accept=".csv"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${importStatus === 'success' ? 'bg-emerald-500 text-white' : importStatus === 'error' ? 'bg-red-500 text-white' : 'bg-black text-white hover:bg-brand shadow-black/20'}`}
          >
            {importStatus === 'success' ? <Check size={14} /> : <Upload size={14} />} 
            {importStatus === 'success' ? 'Imported' : importStatus === 'error' ? 'Import Failed' : 'Batch Import'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {renderContactList('customer', `Client: ${project.customerName}`)}
        {renderContactList('internal', 'Internal Operational Team')}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-brand/20">
            <div className="px-10 py-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Stakeholder Entry</h3>
              <button onClick={() => setShowModal(false)}><X size={24} className="text-slate-400"/></button>
            </div>
            <div className="p-10 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Basic Info</label>
                <input className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-bold" placeholder="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                <input className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-medium text-sm" placeholder="Role" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} />
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Details</label>
                <input className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-medium text-sm" placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                <input className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-medium text-sm" placeholder="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location & Assignment</label>
                <select 
                  className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-black text-[11px] uppercase mb-2" 
                  value={formData.locationId || ''} 
                  onChange={e => {
                    const loc = project.locations.find(l => l.id === e.target.value);
                    setFormData({ ...formData, locationId: e.target.value, location: loc?.name || '' });
                  }}
                >
                  <option value="">Select Project Location</option>
                  {project.locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
                <input className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-medium text-sm" placeholder="Custom Location / Dept" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                <input className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-medium text-sm" placeholder="Address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Additional Info</label>
                <select className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-black text-[11px] uppercase" value={formData.side} onChange={e => setFormData({ ...formData, side: e.target.value as any })}>
                  <option value="customer">Client Ops</option>
                  <option value="internal">Internal Team</option>
                </select>
                <textarea className="w-full px-5 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none font-medium text-sm min-h-[100px]" placeholder="Notes" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div className="px-10 py-8 bg-slate-50 border-t flex justify-end gap-5">
              <button onClick={() => setShowModal(false)} className="px-5 py-2 text-xs font-black uppercase text-slate-400">Abort</button>
              <button onClick={handleSave} className="px-10 py-4 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-brand transition-all">Save Stakeholder</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
