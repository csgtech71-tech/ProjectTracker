
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Project, GlobalSettings, SowSection } from '../../types';
import { FileText, Save, Printer, Plus, Trash2, Edit3, X, GripVertical, Eye, Download, List, Target, Calendar, Users, Calculator, CheckCircle, RotateCcw, PenLine, Eraser } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  project: Project;
  onUpdate: (updated: Project) => void;
  onUpdateGlobalSettings: (settings: GlobalSettings) => void;
  globalSettings: GlobalSettings;
}

/**
 * ProjectSOW Component
 * Manages the Statement of Work document sections and printing capabilities.
 */

// ─── Default template sections — all editable ─────────────────────────────────
// These load on first open. Titles and content are fully editable in the app.
// Section titles and content are fully editable per engagement.
const DEFAULT_SOW_SECTIONS = (customerName: string): SowSection[] => [
  {
    id: 'sow-1-1',
    title: '1.1 Activity Description',
    content: `MedixSafe will lead the remote activation, configuration and training for the customer. In addition, the MedixSafe team will be responsible for providing training materials for ${customerName}'s LMS.`,
  },
  {
    id: 'sow-1-2',
    title: '1.2 Service Exclusions',
    content: `The following services are excluded from this SOW:

- Any custom development / features / implementation`,
  },
  {
    id: 'sow-1-3',
    title: '1.3 Professional Services',
    content: `The Program Manager from the MedixSafe team is responsible for initiation, planning and controlling the services delivered, as well as rolling out and handing over the solution(s). These services may include the following activities:`,
  },
  {
    id: 'sow-planning',
    title: 'Planning',
    content: `- Collaborating to ensure a comprehensive understanding of business requirements and success criteria
- Defining the project scope and meticulously crafting a project plan or schedule to align with agreed-upon deadlines and deliverables
- Documenting and securing approval for requirement specifications to ensure clarity and alignment
- Identifying and establishing key project milestones for tracking progress
- Strategically planning and allocating resources to ensure timely achievement of project deliverables
- Confirming the availability of necessary resource capacity as outlined in the project plan to support successful outcomes`,
  },
  {
    id: 'sow-executing',
    title: 'Executing',
    content: `- Establishing and maintaining the structure mechanisms, guidelines, procedures and required facilities to deliver the project
- Execute plan with internal MedixSafe resources during delivery of items as specified in Section 1.1 Activity Description
- Providing regular progress updates as needed and working with the Customer team to remove any dependencies
- Provide any project plan updates`,
  },
  {
    id: 'sow-monitoring',
    title: 'Monitoring and Controlling',
    content: `- Overseeing day-to-day operations to ensure tasks are executed efficiently and deliverables are achieved on schedule.
- Maintaining comprehensive issue logs to track project challenges and resolutions.
- Engaging in escalation processes with stakeholders as necessary to facilitate timely decision-making.
- Collaborating effectively with MedixSafe project team members and leveraging internal resources to enhance project outcomes.
- Proactively managing changes in project scope through Integrated Change Control procedures to align with project goals.
- Ensuring that constraints and scope are effectively addressed to meet the established project objectives.
- Continuously monitoring, recording, and evaluating project deliverables against the project plan to guarantee success.`,
  },
  {
    id: 'sow-1-4',
    title: '1.4 Remote Activation',
    content: `Remote activation of safe(s) at project location(s). Once all safes are activated and ready for use and the training is completed the project will start.`,
  },
  {
    id: 'sow-1-5',
    title: '1.5 Training of Personnel',
    content: `MedixSafe has been training personnel on a per safe activation basis. Part of the kick-off prior to project launch is to verify everyone has been trained and is comfortable with the safes, their operations and the software administration (where applicable).`,
  },
  {
    id: 'sow-1-6',
    title: '1.6 Project Success Criteria (Customer)',
    content: `## 1. Security & Compliance
Safe maintains secure, locked storage with no unauthorized access or tampering events. Access controls (keypad, badge, biometric, code) function consistently. Audit logs or access attempt records are accessible and easy to read. Records meet DEA and state storage requirements. Remote accessibility and oversight is available.

## 2. Reliability & System Stability
The safe operates without mechanical or electronic failures that inhibit access. Locking mechanisms, alarms, and backup features work as intended throughout the project.

## 3. Workflow Integration & User Experience
Safe supports timely access with minimal workflow disruption. End-users report that the device is intuitive, easy to operate, and does not add burden to manual inventory tasks.

## 4. Operational Efficiency
Storage layout and capacity align with workflow needs. The safe supports existing manual inventory and daily processes without adding additional time.

## 5. Cost-Effectiveness & Scalability
Purchase, installation, and maintenance costs meet expectations. The device shows potential for broader deployment with minimal environmental or process changes.`,
  },
  {
    id: 'sow-1-7',
    title: '1.7 Project Start',
    content: `All pre-requisites (activation, training) have been completed and confirmed. The project formally begins. Both parties have reviewed and signed this Statement of Work.`,
  },
  {
    id: 'sow-1-8',
    title: '1.8 Project Conclusion',
    content: `Outgoing survey to stakeholders. Final meeting to recap the project, survey results, etc. Meeting notes and recap to be filed and provided to ${customerName} stakeholders.`,
  },
  {
    id: 'sow-closing',
    title: 'Closing and Documentation',
    content: `- Final project completion report
- Project plan updates
- Project reviews and lessons learned`,
  },
  {
    id: 'sow-communication',
    title: 'Communication Management',
    content: `All project communications will be managed through the designated project manager. Status updates will be provided on a schedule agreed upon during kickoff. Escalation paths are defined in the project plan.`,
  },
  {
    id: 'sow-2-0',
    title: '2.0 Customer Responsibilities',
    content: `The Customer agrees to:

- Provide timely access to facilities, systems, and personnel required for safe activation and training
- Designate a primary point of contact for the duration of this SOW
- Ensure all personnel complete required training sessions within the agreed timeline
- Provide prompt feedback and approvals to avoid project delays
- Notify MedixSafe immediately of any issues affecting project delivery`,
  },
  {
    id: 'sow-3-0',
    title: '3.0 Risk Management',
    content: `MedixSafe will proactively identify, assess, and mitigate project risks throughout the engagement. Identified risks will be documented in the project risk register and reviewed regularly with the Customer.`,
  },
  {
    id: 'sow-3-1',
    title: '3.1 Scope Change Management',
    content: `Any changes to the agreed scope of this SOW must be submitted in writing and approved by both parties before work begins. Scope changes may affect timeline and cost. MedixSafe will provide a written impact assessment for any requested change.`,
  },
];

export const ProjectSOW: React.FC<Props> = ({ project, onUpdate, onUpdateGlobalSettings, globalSettings }) => {
  // Local state for SOW sections, initialized from project or global defaults
  // Load saved sections, or fall back to global defaults, or generate from template
  const [sections, setSections] = useState<SowSection[]>(
    project.sowSections?.length
      ? project.sowSections
      : globalSettings.globalSowSections?.length
      ? globalSettings.globalSowSections
      : DEFAULT_SOW_SECTIONS(project.customerName)
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false); // Default to editor mode so users can work
  const docRef = useRef<HTMLDivElement>(null);

  // Signature capture
  const customerCanvasRef = useRef<HTMLCanvasElement>(null);
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const [customerSigning, setCustomerSigning] = useState(false);
  const [internalSigning, setInternalSigning] = useState(false);
  const [customerSigned, setCustomerSigned] = useState(!!project.customerSignature);
  const [internalSigned, setInternalSigned] = useState(!!project.ourSignature);

  useEffect(() => {
    if (project.customerSignature && customerCanvasRef.current) {
      const img = new Image();
      img.onload = () => customerCanvasRef.current?.getContext('2d')?.drawImage(img, 0, 0);
      img.src = project.customerSignature;
    }
    if (project.ourSignature && internalCanvasRef.current) {
      const img = new Image();
      img.onload = () => internalCanvasRef.current?.getContext('2d')?.drawImage(img, 0, 0);
      img.src = project.ourSignature;
    }
  }, []);

  const startDrawing = (canvasRef: React.RefObject<HTMLCanvasElement>, setDrawing: (v: boolean) => void) =>
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      setDrawing(true);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };

  const draw = (canvasRef: React.RefObject<HTMLCanvasElement>, isDrawing: boolean) =>
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    };

  const stopDrawing = (canvasRef: React.RefObject<HTMLCanvasElement>, setDrawing: (v: boolean) => void, side: 'customer' | 'internal') =>
    () => {
      setDrawing(false);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const sig = canvas.toDataURL();
      if (side === 'customer') {
        setCustomerSigned(true);
        onUpdate({ ...project, customerSignature: sig });
      } else {
        setInternalSigned(true);
        onUpdate({ ...project, ourSignature: sig });
      }
    };

  const clearSignature = (canvasRef: React.RefObject<HTMLCanvasElement>, side: 'customer' | 'internal') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    if (side === 'customer') {
      setCustomerSigned(false);
      onUpdate({ ...project, customerSignature: undefined });
    } else {
      setInternalSigned(false);
      onUpdate({ ...project, ourSignature: undefined });
    }
  };

  const primaryCustomer = project.contacts.find(c => c.side === 'customer') || null;
  const primaryInternal = project.contacts.find(c => c.side === 'internal') || null;

  // Generate TOC based on original design
  const toc = useMemo(() => {
    return [
      { id: 'purpose', title: '1.0 Purpose', page: 1 },
      { id: 'activity', title: '1.1 Activity Description', page: 2 },
      { id: 'exclusions', title: '1.2 Service Exclusions', page: 3 },
      { id: 'professional', title: '1.3 Professional Services', page: 4 },
      { id: 'planning', title: 'Planning', page: 5 },
      { id: 'executing', title: 'Executing', page: 6 },
      { id: 'monitoring', title: 'Monitoring and Controlling', page: 7 },
      { id: 'activation', title: '1.4 Remote Activation', page: 8 },
      { id: 'training', title: '1.5 Training of personnel', page: 9 },
      { id: 'success', title: '1.6 Project Success Criteria (Customer)', page: 10 },
      { id: 'starts', title: '1.7 Project Starts', page: 11 },
      { id: 'conclusion', title: '1.8 Project Conclusion', page: 12 },
      { id: 'closing', title: 'Closing and Documentation', page: 13 },
      { id: 'communication', title: 'Communication Management', page: 14 },
      { id: 'responsibilities', title: '2.0 Customer Responsibilities', page: 15 },
      { id: 'risk', title: '3.0 Risk Management', page: 16 },
      { id: 'scope', title: '3.1 Scope Change Management', page: 17 },
      { id: 'locations', title: 'Deployment Locations', page: 18 },
      { id: 'auth', title: 'Authorization', page: 19 },
      { id: 'stakeholders', title: 'Key Stakeholders', page: 20 },
      { id: 'roadmap', title: 'Project Roadmap', page: 21 },
    ];
  }, []);

  // Persist SOW changes to the project state
  const handleSave = () => {
    onUpdate({ ...project, sowSections: sections });
    setIsEditing(false);
  };

  const handleAddSection = () => {
    const newSection: SowSection = {
      id: crypto.randomUUID(),
      title: 'New Section',
      content: 'Enter section content here...'
    };
    setSections([...sections, newSection]);
  };

  const handleRemoveSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const handleUpdateSection = (id: string, field: keyof SowSection, value: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  /**
   * Generates a printable version of the SOW with branding and stakeholder info.
   */
  const handlePrint = () => {
    if (!docRef.current) return;
    const printWindow = window.open('', '_blank', 'width=1100,height=850');
    if (!printWindow) return;
    
    const companyName = globalSettings.companyName || 'MedixSafe';
    const internalPM = project.contacts.find(c => c.side === 'internal' && (c.role.toLowerCase().includes('manager') || c.role.toLowerCase().includes('lead'))) || project.contacts.find(c => c.side === 'internal');
    const customerLead = project.contacts.find(c => c.side === 'customer' && (c.role.toLowerCase().includes('manager') || c.role.toLowerCase().includes('lead'))) || project.contacts.find(c => c.side === 'customer');

    const renderMarkdownToHtml = (md: string) => {
      // Simple markdown to HTML conversion for print window
      return md
        .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-3">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n/gim, '<br/>');
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>SOW - ${project.customerName}</title>
          <script src="https://cdn.tailwindcss.com?plugins=typography"></script>
          <style>
            @page { size: A4; margin: 0; }
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .sow-print-page { height: 297mm; width: 210mm; page-break-after: always; padding: 25mm; position: relative; box-sizing: border-box; display: flex; flex-direction: column; background: white !important; color: #000; }
              .no-print { display: none !important; }
              .bg-black { background-color: #000000 !important; }
              .text-white { color: #ffffff !important; }
              .bg-slate-50 { background-color: #f8fafc !important; }
              .border-brand { border-color: #d12913 !important; }
              .text-brand { color: #d12913 !important; }
            }
            body { font-family: 'Inter', sans-serif; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #cbd5e1; padding: 12px; font-size: 13px; }
            th { background-color: #f8fafc; font-weight: 900; text-align: left; color: #d12913; text-transform: uppercase; font-size: 10px; letter-spacing: 0.1em; }
            ul { list-style-type: disc; margin-left: 20px; }
            ol { list-style-type: decimal; margin-left: 20px; }
            p { margin-bottom: 10px; }
            .commitment-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 2rem; margin-top: 2rem; }
            .red-bar { border-left: 4px solid #d12913; padding-left: 1.5rem; }
          </style>
        </head>
        <body onload="setTimeout(() => { window.print(); window.close(); }, 800);">
          <!-- COVER PAGE -->
          <div class="sow-print-page bg-white flex flex-col justify-between border-t-[20px] border-[#d12913]">
            <div class="space-y-12">
              <div class="bg-black -mx-[25mm] px-[25mm] py-12 flex justify-between items-center">
                 <h1 class="text-6xl font-black text-white uppercase tracking-tighter leading-none">Statement<br/>Of Work</h1>
                 ${globalSettings.companyLogoBase64 ? `<img src="${globalSettings.companyLogoBase64}" class="h-14 object-contain ml-8 max-w-[220px]" alt="Logo" />` : ''}
              </div>
              <div class="h-2 w-32 bg-black"></div>
              <div>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">Operational Project Charter</p>
                <h2 class="text-4xl font-black text-slate-900 uppercase tracking-tighter">${project.title}</h2>
                <p class="text-xl font-bold text-slate-500 mt-2">Prepared for: ${project.customerName}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-20 border-t border-slate-100 pt-10">
               <div>
                 <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Customer Contact</p>
                 <p class="text-sm font-black uppercase text-slate-900">${customerLead?.name || 'Primary Stakeholder'}</p>
                 <p class="text-xs text-slate-500">${customerLead?.email || 'N/A'}</p>
               </div>
               <div>
                 <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">${companyName} Lead</p>
                 <p class="text-sm font-black uppercase text-slate-900">${internalPM?.name || 'Project Manager'}</p>
                 <p class="text-xs text-slate-500">${internalPM?.email || 'N/A'}</p>
               </div>
            </div>
          </div>

          <!-- TABLE OF CONTENTS -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="flex items-center gap-3 border-b-2 border-slate-100 pb-4">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Table of Contents</h3>
              </div>
              <div class="space-y-4">
                ${toc.map(item => `
                  <div class="flex justify-between items-end border-b border-dotted border-slate-300 pb-1">
                    <span class="text-sm font-bold uppercase tracking-widest text-slate-700">${item.title}</span>
                    <span class="text-sm font-black text-slate-900">${item.page < 10 ? '0' : ''}${item.page}</span>
                  </div>
                `).join('')}
              </div>
            </section>
          </div>

          <!-- 1.0 PURPOSE -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.0 Purpose</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800">
                <p>MedixSafe will complete, with reasonable guidance and support from the Customer project team, the initiatives listed in this SOW. MedixSafe will design, plan, and implement solutions for the defined deliverables. The purpose of this project is to plan and deliver the items defined below as well as make available custom training materials for ${project.customerName}'s Learning Management System (LMS).</p>
                <ul class="mt-4 space-y-2 list-none">
                  <li>a. Safe activation at Durham and Connecticut location(s)</li>
                  <li>b. Training of personnel (administration and end users)</li>
                  <li>c. Provide Training collateral</li>
                  <li>d. Provide 2 (15 minute) touchpoints per week to cover off questions, feedback, issues, etc.</li>
                </ul>
              </div>
            </section>
          </div>

          ${sections.map(s => {
            const body = s.content.split('\n').map(line => {
              if (line.startsWith('## ')) return '<h4 class="text-lg font-black uppercase tracking-tighter mb-2 mt-6">' + line.slice(3) + '</h4>';
              if (line.startsWith('- ') || line.startsWith('* ')) return '<li class="ml-4">' + line.slice(2) + '</li>';
              if (line.trim() === '') return '';
              return '<p class="mb-3">' + line + '</p>';
            }).join('');
            return '<div class="sow-print-page bg-white space-y-12"><section class="space-y-8"><div class="red-bar"><h3 class="text-3xl font-black uppercase tracking-tighter">' + s.title + '</h3></div><div class="text-lg leading-relaxed text-slate-800">' + body + '</div></section></div>';
          }).join('')}

          <!-- DEPLOYMENT LOCATIONS -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Deployment Locations</h3>
              </div>
              ${project.locations.length > 0 ? `
                <table>
                  <thead>
                    <tr>
                      <th>Location Name</th>
                      <th>Address</th>
                      <th>Safes</th>
                      <th>Users</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${project.locations.map(loc => `
                      <tr>
                        <td class="font-bold">${loc.name}</td>
                        <td>${loc.address}</td>
                        <td>${loc.numSafes || 0}</td>
                        <td>${loc.numUsers || 0}</td>
                        <td class="uppercase text-[10px] font-black">${loc.deploymentType || 'N/A'}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<p class="text-lg text-slate-400 italic">No locations defined in charter.</p>'}
            </section>
          </div>

          <!-- AUTHORIZATION -->
          <div class="sow-print-page bg-white flex flex-col justify-between">
            <section class="space-y-12">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Authorization</h3>
              </div>
              <p class="text-lg text-slate-800 leading-relaxed">By signing below, the parties agree to the terms and scope of work defined in this document. This Statement of Work is effective as of ${new Date().toLocaleDateString()}.</p>
              
              <div class="grid grid-cols-2 gap-20 pt-20">
                 <div class="space-y-12">
                    <div class="border-b-2 border-slate-900 w-full h-24"></div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Authorization</p>
                    <p class="text-sm font-black uppercase text-slate-900">${project.customerName}</p>
                 </div>
                 <div class="space-y-12">
                    <div class="border-b-2 border-slate-900 w-full h-24"></div>
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Authorization</p>
                    <p class="text-sm font-black uppercase text-slate-900">${companyName}</p>
                 </div>
              </div>
            </section>
          </div>

          <!-- KEY STAKEHOLDERS -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Key Stakeholders</h3>
              </div>
              
              <div class="space-y-12">
                <div class="space-y-6">
                  <h4 class="text-xs font-black uppercase tracking-widest text-[#d12913]">Client Operations</h4>
                  <div class="grid grid-cols-2 gap-4">
                    ${project.contacts.filter(c => c.side === 'customer').map(c => `
                      <div class="p-6 bg-white border border-slate-200 rounded-2xl space-y-1">
                        <p class="text-lg font-black text-slate-900 uppercase">${c.name}</p>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${c.role}</p>
                        <p class="text-xs text-slate-500">${c.email || 'N/A'}</p>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <div class="space-y-6">
                  <h4 class="text-xs font-black uppercase tracking-widest text-[#d12913]">MedixSafe Internal Team</h4>
                  <div class="grid grid-cols-2 gap-4">
                    ${project.contacts.filter(c => c.side === 'internal').map(c => `
                      <div class="p-6 bg-white border border-slate-200 rounded-2xl space-y-1">
                        <p class="text-lg font-black text-slate-900 uppercase">${c.name}</p>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${c.role}</p>
                        <p class="text-xs text-slate-500">${c.email || 'N/A'}</p>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- PROJECT ROADMAP -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Project Roadmap</h3>
              </div>
              
              <div class="space-y-12">
                ${project.milestones.map((m, idx) => `
                  <div class="flex gap-12 relative">
                    <div class="w-32 pt-1">
                      <p class="text-sm font-black text-[#d12913]">${new Date(m.date).toLocaleDateString()}</p>
                    </div>
                    <div class="flex-1 space-y-1">
                      <h4 class="text-xl font-black text-slate-900 uppercase tracking-tighter">${m.title}</h4>
                      <p class="text-sm text-slate-500 font-medium">${m.type === 'milestone' ? 'Key Project Milestone' : m.type === 'touchpoint' ? 'Two times weekly touchpoint to address any issues, answer any questions, etc.' : 'Project Phase Completion'}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </section>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  /**
   * Generates a PDF version of the SOW using jsPDF.
   */
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const companyName = globalSettings.companyName || 'MedixSafe';
    
    // Cover Page
    doc.setFillColor(209, 41, 19); // #d12913
    doc.rect(0, 0, 210, 10, 'F');
    
    doc.setFontSize(40);
    doc.setFont('helvetica', 'bold');
    doc.text('STATEMENT', 20, 60);
    doc.text('OF WORK', 20, 80);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Project: ${project.title}`, 20, 110);
    doc.text(`Customer: ${project.customerName}`, 20, 120);
    doc.text(`Prepared by: ${companyName}`, 20, 130);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 140);

    // Table of Contents
    doc.addPage();
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Table of Contents', 20, 30);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    toc.forEach((item, i) => {
      doc.text(`${item.title}`, 20, 45 + (i * 10));
      doc.text(`${item.page < 10 ? '0' : ''}${item.page}`, 180, 45 + (i * 10), { align: 'right' });
    });

    const addSectionHeader = (title: string, y: number = 30) => {
      doc.setFillColor(209, 41, 19);
      doc.rect(20, y - 5, 1.5, 10, 'F');
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 25, y);
    };

    // 1.0 Purpose
    doc.addPage();
    addSectionHeader('1.0 Purpose');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const purposeText = `MedixSafe will complete, with reasonable guidance and support from the Customer project team, the initiatives listed in this SOW. MedixSafe will design, plan, and implement solutions for the defined deliverables. The purpose of this project is to plan and deliver the items defined below as well as make available custom training materials for ${project.customerName}'s Learning Management System (LMS).`;
    const purposeLines = doc.splitTextToSize(purposeText, 170);
    doc.text(purposeLines, 20, 45);
    doc.text('a. Safe activation at Durham and Connecticut location(s)', 25, 70);
    doc.text('b. Training of personnel (administration and end users)', 25, 77);
    doc.text('c. Provide Training collateral', 25, 84);
    doc.text('d. Provide 2 (15 minute) touchpoints per week to cover off questions, feedback, issues, etc.', 25, 91);

    // Dynamic SOW sections — rendered from editable sections state
    sections.forEach(section => {
      doc.addPage();
      addSectionHeader(section.title);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      let sectionY = 45;
      const lines = section.content.split('\n');
      lines.forEach(line => {
        if (!line.trim()) { sectionY += 4; return; }
        if (line.startsWith('## ')) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(line.slice(3), 20, sectionY);
          sectionY += 8;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          const wrapped = doc.splitTextToSize('• ' + line.slice(2), 165);
          wrapped.forEach((l: string) => {
            if (sectionY > 270) { doc.addPage(); addSectionHeader(section.title + ' (cont.)'); sectionY = 45; }
            doc.text(l, 25, sectionY);
            sectionY += 7;
          });
        } else {
          const wrapped = doc.splitTextToSize(line, 170);
          wrapped.forEach((l: string) => {
            if (sectionY > 270) { doc.addPage(); addSectionHeader(section.title + ' (cont.)'); sectionY = 45; }
            doc.text(l, 20, sectionY);
            sectionY += 7;
          });
        }
      });
    });

    // Authorization
    doc.addPage();
    addSectionHeader('Authorization');
    doc.text(`By signing below, the parties agree to the terms and scope of work defined in this document. This Statement of Work is effective as of ${new Date().toLocaleDateString()}.`, 20, 45);
    doc.line(20, 100, 90, 100);
    doc.text('Customer Authorization', 20, 105);
    doc.text(project.customerName, 20, 112);
    doc.line(120, 100, 190, 100);
    doc.text('Internal Authorization', 120, 105);
    doc.text(companyName, 120, 112);

    // Stakeholders
    doc.addPage();
    addSectionHeader('Key Stakeholders');
    const stakeholderData = project.contacts.map(c => [c.name, c.role, c.side, c.email]);
    autoTable(doc, {
      startY: 40,
      head: [['Name', 'Role', 'Side', 'Email']],
      body: stakeholderData,
    });

    // Roadmap
    doc.addPage();
    addSectionHeader('Project Roadmap');
    let roadmapY = 45;
    project.milestones.forEach(m => {
      doc.setTextColor(209, 41, 19);
      doc.setFont('helvetica', 'bold');
      doc.text(new Date(m.date).toLocaleDateString(), 20, roadmapY);
      doc.setTextColor(0, 0, 0);
      doc.text(m.title, 50, roadmapY);
      roadmapY += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(m.type, 50, roadmapY);
      roadmapY += 10;
      doc.setFontSize(11);
    });
    
    doc.save(`SOW_${project.customerName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">Statement of Work</h2>
          <p className="text-sm text-slate-500 font-medium italic">Mission parameters and contractual deliverables.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsPreview(!isPreview)} className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${isPreview ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {isPreview ? <><Edit3 size={16} /> Edit Mode</> : <><Eye size={16} /> Preview</> }
          </button>
          <button onClick={handleDownloadPDF} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
            <Download size={16} /> Download PDF
          </button>
          <button onClick={handlePrint} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
            <Printer size={16} /> Print SOW
          </button>
          {!isPreview && (
            isEditing ? (
              <button onClick={handleSave} className="px-8 py-2.5 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all flex items-center gap-2 shadow-xl shadow-black/10">
                <Save size={16} /> Save SOW
              </button>
            ) : (
              <button onClick={() => setIsEditing(true)} className="px-8 py-2.5 bg-brand text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-dark transition-all flex items-center gap-2 shadow-xl shadow-brand/10">
                <Edit3 size={16} /> Edit Sections
              </button>
            )
          )}
        </div>
      </div>

      <div ref={docRef} className="space-y-6">
        {isPreview ? (
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
            {/* Cover Page Preview */}
            <div className="p-20 border-t-[20px] border-brand space-y-20 min-h-[800px] flex flex-col justify-between">
              <div className="space-y-12">
                <div className="bg-black -mx-20 px-20 py-12 flex justify-between items-center">
                  <h1 className="text-6xl font-black text-white uppercase tracking-tighter leading-none">Statement<br/>Of Work</h1>
                  {globalSettings.companyLogoBase64 && <img src={globalSettings.companyLogoBase64} className="h-14 object-contain ml-8 max-w-[220px]" alt="Logo" />}
                </div>
                <div className="h-2 w-32 bg-black"></div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">Operational Project Charter</p>
                  <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{project.title}</h2>
                  <p className="text-xl font-bold text-slate-500 mt-2">Prepared for: {project.customerName}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-20 border-t border-slate-100 pt-10">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Customer Contact</p>
                  <p className="text-sm font-black uppercase text-slate-900">{project.contacts.find(c => c.side === 'customer')?.name || 'Primary Stakeholder'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{globalSettings.companyName || 'MedixSafe'} Lead</p>
                  <p className="text-sm font-black uppercase text-slate-900">{project.contacts.find(c => c.side === 'internal')?.name || 'Project Manager'}</p>
                </div>
              </div>
            </div>

            {/* Table of Contents Preview */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-3">
                <List size={24} className="text-brand" />
                <h3 className="text-3xl font-black uppercase tracking-tighter">Table of Contents</h3>
              </div>
              <div className="space-y-4 max-w-2xl">
                {toc.map(item => (
                  <div key={item.id} className="flex justify-between items-end border-b border-dotted border-slate-200 pb-1">
                    <span className="text-sm font-bold uppercase tracking-widest text-slate-600">{item.title}</span>
                    <span className="text-sm font-black text-slate-900">0{item.page}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 1.0 Purpose */}
            <div className="p-20 bg-white space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.0 Purpose</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700">
                <p>MedixSafe will complete, with reasonable guidance and support from the Customer project team, the initiatives listed in this SOW. MedixSafe will design, plan, and implement solutions for the defined deliverables. The purpose of this project is to plan and deliver the items defined below as well as make available custom training materials for {project.customerName}'s Learning Management System (LMS).</p>
                <ul className="mt-4 space-y-2 list-none">
                  <li>a. Safe activation at Durham and Connecticut location(s)</li>
                  <li>b. Training of personnel (administration and end users)</li>
                  <li>c. Provide Training collateral</li>
                  <li>d. Provide 2 (15 minute) touchpoints per week to cover off questions, feedback, issues, etc.</li>
                </ul>
              </div>
            </div>

            {/* Dynamic SOW Sections Preview — rendered from editable sections state */}
            {sections.map(section => (
              <div key={section.id} className="p-20 bg-white border-t border-slate-100 space-y-8">
                <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                  <h3 className="text-3xl font-black uppercase tracking-tighter">{section.title}</h3>
                </div>
                <div className="text-lg leading-relaxed text-slate-700 prose max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {section.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            {/* Deployment Locations */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Deployment Locations</h3>
              </div>
              <div className="text-lg text-slate-400 italic">
                {project.locations.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 text-slate-700 not-italic">
                    {project.locations.map(loc => (
                      <div key={loc.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase">{loc.name}</p>
                          <p className="text-xs text-slate-500">{loc.address}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{loc.deploymentType}</p>
                          <p className="text-xs font-bold text-slate-700">{loc.numSafes || 0} Safes • {loc.numUsers || 0} Users</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No locations defined in charter.</p>
                )}
              </div>
            </div>

            {/* Authorization — Signature Capture */}
            <div className="p-20 border-t border-slate-100 bg-white space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Authorization</h3>
              </div>
              <p className="text-lg text-slate-700 leading-relaxed">By signing below, the parties agree to the terms and scope of work defined in this document. This Statement of Work is effective as of {new Date().toLocaleDateString()}.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                {/* Customer Signature */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#d12913]">Customer Authorization</p>
                      {primaryCustomer ? (
                        <div className="mt-1">
                          <p className="text-sm font-black text-slate-900 uppercase">{primaryCustomer.name}</p>
                          <p className="text-xs text-slate-400 font-bold">{primaryCustomer.role}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-1">No customer stakeholder assigned</p>
                      )}
                    </div>
                    {customerSigned && (
                      <button onClick={() => clearSignature(customerCanvasRef, 'customer')} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-red-400 transition-colors">
                        <Eraser size={12} /> Clear
                      </button>
                    )}
                  </div>
                  <div className={`relative border-2 rounded-2xl overflow-hidden transition-all ${customerSigning ? 'border-brand shadow-lg shadow-brand/10' : customerSigned ? 'border-emerald-200 bg-slate-50' : 'border-slate-200 border-dashed bg-slate-50'}`}>
                    <canvas
                      ref={customerCanvasRef}
                      width={500}
                      height={160}
                      className="w-full h-40 cursor-crosshair touch-none"
                      onMouseDown={startDrawing(customerCanvasRef, setCustomerSigning)}
                      onMouseMove={draw(customerCanvasRef, customerSigning)}
                      onMouseUp={stopDrawing(customerCanvasRef, setCustomerSigning, 'customer')}
                      onMouseLeave={stopDrawing(customerCanvasRef, setCustomerSigning, 'customer')}
                    />
                    {!customerSigned && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex items-center gap-2 text-slate-300">
                          <PenLine size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Sign here</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t-2 border-slate-900 pt-2">
                    <p className="text-[10px] font-bold text-slate-500">{primaryCustomer?.name || 'Customer Representative'} — {project.customerName}</p>
                  </div>
                </div>

                {/* Internal Signature */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#d12913]">{globalSettings.companyName || 'MedixSafe'} Authorization</p>
                      {primaryInternal ? (
                        <div className="mt-1">
                          <p className="text-sm font-black text-slate-900 uppercase">{primaryInternal.name}</p>
                          <p className="text-xs text-slate-400 font-bold">{primaryInternal.role}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-1">No internal stakeholder assigned</p>
                      )}
                    </div>
                    {internalSigned && (
                      <button onClick={() => clearSignature(internalCanvasRef, 'internal')} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-red-400 transition-colors">
                        <Eraser size={12} /> Clear
                      </button>
                    )}
                  </div>
                  <div className={`relative border-2 rounded-2xl overflow-hidden transition-all ${internalSigning ? 'border-brand shadow-lg shadow-brand/10' : internalSigned ? 'border-emerald-200 bg-slate-50' : 'border-slate-200 border-dashed bg-slate-50'}`}>
                    <canvas
                      ref={internalCanvasRef}
                      width={500}
                      height={160}
                      className="w-full h-40 cursor-crosshair touch-none"
                      onMouseDown={startDrawing(internalCanvasRef, setInternalSigning)}
                      onMouseMove={draw(internalCanvasRef, internalSigning)}
                      onMouseUp={stopDrawing(internalCanvasRef, setInternalSigning, 'internal')}
                      onMouseLeave={stopDrawing(internalCanvasRef, setInternalSigning, 'internal')}
                    />
                    {!internalSigned && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex items-center gap-2 text-slate-300">
                          <PenLine size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Sign here</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="border-t-2 border-slate-900 pt-2">
                    <p className="text-[10px] font-bold text-slate-500">{primaryInternal?.name || 'Authorized Representative'} — {globalSettings.companyName || 'MedixSafe'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Stakeholders — Two Column List */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Key Stakeholders</h3>
              </div>
              <div className="grid grid-cols-2 gap-16">
                {/* Internal — Left */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-900">
                    <div className="w-2 h-8 bg-[#d12913] rounded-full" />
                    <p className="text-sm font-black uppercase tracking-widest text-slate-900">{globalSettings.companyName || 'MedixSafe'}</p>
                  </div>
                  <div className="space-y-1">
                    {project.contacts.filter(c => c.side === 'internal').length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No internal stakeholders assigned</p>
                    ) : project.contacts.filter(c => c.side === 'internal').map(c => (
                      <div key={c.id} className="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 uppercase tracking-tight">{c.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.role}</p>
                          {c.email && <p className="text-xs text-slate-500 mt-0.5">{c.email}</p>}
                          {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Customer — Right */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b-2 border-slate-900">
                    <div className="w-2 h-8 bg-[#d12913] rounded-full" />
                    <p className="text-sm font-black uppercase tracking-widest text-slate-900">{project.customerName}</p>
                  </div>
                  <div className="space-y-1">
                    {project.contacts.filter(c => c.side === 'customer').length === 0 ? (
                      <p className="text-sm text-slate-400 italic">No client stakeholders assigned</p>
                    ) : project.contacts.filter(c => c.side === 'customer').map(c => (
                      <div key={c.id} className="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0">
                        <div className="w-10 h-10 bg-[#d12913] rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 uppercase tracking-tight">{c.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.role}</p>
                          {c.email && <p className="text-xs text-slate-500 mt-0.5">{c.email}</p>}
                          {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Project Roadmap Preview */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Project Roadmap</h3>
              </div>
              
              <div className="space-y-12">
                {project.milestones.map((m, idx) => (
                  <div key={m.id} className="flex gap-12 relative">
                    {idx !== project.milestones.length - 1 && (
                      <div className="absolute left-[4.5rem] top-8 bottom-[-3rem] w-0.5 bg-slate-100" />
                    )}
                    <div className="w-32 pt-1">
                      <p className="text-sm font-black text-[#d12913]">{new Date(m.date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{m.title}</h4>
                      <p className="text-sm text-slate-500 font-medium">{m.type === 'milestone' ? 'Key Project Milestone' : m.type === 'touchpoint' ? 'Two times weekly touchpoint to address any issues, answer any questions, etc.' : 'Project Phase Completion'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Builder Mode Header */}
            <div className="bg-brand/5 border border-brand/20 p-8 rounded-[2.5rem] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand text-white rounded-2xl shadow-lg shadow-brand/20">
                  <Edit3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">SOW Builder</h3>
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Construct your mission parameters</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${isEditing ? 'bg-black text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  {isEditing ? <><Save size={16} /> Finish Editing</> : <><Edit3 size={16} /> Edit Sections</>}
                </button>
                {isEditing && (
                  <button
                    onClick={() => {
                      if (confirm('Reset all sections to the default template? This cannot be undone.')) {
                        setSections(DEFAULT_SOW_SECTIONS(project.customerName));
                      }
                    }}
                    className="px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-dashed border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-400 transition-all flex items-center gap-2"
                  >
                    <RotateCcw size={14} /> Reset to Template
                  </button>
                )}
              </div>
            </div>

            {/* Predefined Sections Indicator */}
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 flex items-center gap-4 opacity-60">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm"><FileText size={20} /></div>
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">SOW Sections — All Editable</p>
                  <p className="text-sm font-bold text-slate-900">Click Edit Sections to rename titles or rewrite any section body. Changes are saved to this project.</p>
               </div>
            </div>

            {sections.map(section => (
              <div key={section.id} className="bg-white rounded-[2.5rem] border border-slate-200 p-8 space-y-4 group transition-all hover:border-brand/20">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <GripVertical size={16} className="text-slate-300" />
                       <input 
                        className="bg-transparent border-none outline-none text-xl font-black uppercase tracking-tighter text-slate-900 focus:text-brand w-full disabled:bg-transparent"
                        value={section.title}
                        onChange={e => handleUpdateSection(section.id, 'title', e.target.value)}
                        disabled={!isEditing}
                      />
                    </div>
                    {isEditing && (
                      <button onClick={() => handleRemoveSection(section.id)} className="p-2 text-slate-300 hover:text-brand opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={18} />
                      </button>
                    )}
                 </div>
                 {isEditing ? (
                   <textarea 
                     className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 min-h-[200px] text-sm font-medium leading-relaxed outline-none focus:border-brand transition-all resize-none"
                     value={section.content}
                     onChange={e => handleUpdateSection(section.id, 'content', e.target.value)}
                   />
                 ) : (
                   <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 min-h-[200px] text-sm font-medium leading-relaxed text-slate-700 prose max-w-none markdown-body">
                     <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{section.content}</ReactMarkdown>
                   </div>
                 )}
              </div>
            ))}
            {isEditing && (
              <button 
                onClick={handleAddSection}
                className="w-full py-12 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-slate-300 hover:text-brand hover:border-brand transition-all flex flex-col items-center justify-center gap-2 group"
              >
                <Plus size={40} className="group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Add New Section</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
