
import React, { useState, useRef, useMemo } from 'react';
import { Project, GlobalSettings, SowSection } from '../../types';
import { FileText, Save, Printer, Plus, Trash2, Edit3, X, GripVertical, Eye, Download, List, Target, Calendar, Users, Calculator, CheckCircle } from 'lucide-react';
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
export const ProjectSOW: React.FC<Props> = ({ project, onUpdate, onUpdateGlobalSettings, globalSettings }) => {
  // Local state for SOW sections, initialized from project or global defaults
  const [sections, setSections] = useState<SowSection[]>(project.sowSections || globalSettings.globalSowSections || []);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(true); // Default to preview mode for a "document" feel
  const docRef = useRef<HTMLDivElement>(null);

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
      { id: 'success', title: '1.6 Pilot Success Criteria (Customer)', page: 10 },
      { id: 'starts', title: '1.7 Pilot Starts', page: 11 },
      { id: 'conclusion', title: '1.8 Pilot Conclusion', page: 12 },
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

          <!-- 1.1 ACTIVITY DESCRIPTION -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.1 Activity Description</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800">
                <p>MedixSafe will lead the remote activation, configuration and training for the customer. In addition, the MedixSafe team will be responsible for providing training materials for ${project.customerName}'s LMS.</p>
              </div>
            </section>
          </div>

          <!-- 1.2 SERVICE EXCLUSIONS -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.2 Service Exclusions</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800">
                <p>The following services are excluded from this SOW: ● Any custom development/features/implementation</p>
              </div>
            </section>
          </div>

          <!-- 1.3 PROFESSIONAL SERVICES -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.3 Professional Services</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800">
                <p>The Program Manager from the MedixSafe team is responsible for initiation, planning and controlling the services delivered, as well as rolling out and handing over the solution (s). These services may include the following activities:</p>
              </section>
            </div>
          </div>

          <!-- PLANNING -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Planning</h3>
              </div>
              <ul class="space-y-4 list-disc pl-6 text-lg text-slate-800">
                <li>Collaborating to ensure a comprehensive understanding of business requirements and success criteria</li>
                <li>Defining the project scope and meticulously crafting a project plan or schedule to align with agreed-upon deadlines and deliverables</li>
                <li>Documenting and securing approval for requirement specifications to ensure clarity and alignment</li>
                <li>Identifying and establishing key project milestones for tracking progress</li>
                <li>Strategically planning and allocating resources to ensure timely achievement of project deliverables</li>
                <li>Confirming the availability of necessary resource capacity as outlined in the project plan to support successful outcomes</li>
              </ul>
            </section>
          </div>

          <!-- EXECUTING -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Executing</h3>
              </div>
              <ul class="space-y-4 list-disc pl-6 text-lg text-slate-800">
                <li>Establishing and maintaining the structure mechanisms, guidelines, procedures and required facilities to deliver the project</li>
                <li>Execute plan with internal MedixSafe resources during delivery of items as specified in Section 1.1 Activity Description</li>
                <li>Providing regular progress updates as needed and working with the Customer team to remove any dependencies</li>
                <li>Provide any project plan updates</li>
              </ul>
            </section>
          </div>

          <!-- MONITORING AND CONTROLLING -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Monitoring and Controlling</h3>
              </div>
              <ul class="space-y-4 list-disc pl-6 text-lg text-slate-800">
                <li>Overseeing day-to-day operations to ensure tasks are executed efficiently and deliverables are achieved on schedule.</li>
                <li>Maintaining comprehensive issue logs to track project challenges and resolutions.</li>
                <li>Engaging in escalation processes with stakeholders as necessary to facilitate timely decision-making.</li>
                <li>Collaborating effectively with MedixSafe project team members and leveraging internal resources to enhance project outcomes.</li>
                <li>Proactively managing changes in project scope through Integrated Change Control procedures to align with project goals.</li>
                <li>Ensuring that constraints and scope are effectively addressed to meet the established project objectives.</li>
                <li>Continuously monitoring, recording, and evaluating project deliverables against the project plan to guarantee success.</li>
              </ul>
            </section>
          </div>

          <!-- 1.4 REMOTE ACTIVATION -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.4 Remote Activation</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800">
                <p>Remote activation of safe(s) at Durham and Connecticut location(s) respectively. Once all safes are activated and ready for use and the training is completed the pilot will start. Summary: Currently all safes at Connecticut have been activated. Durham safes still has to be activated. Timeline for completion: EOD 1/7/2026</p>
              </div>
              <div class="commitment-box">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Section Commitments</p>
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <div class="w-2 h-2 bg-[#d12913] rounded-full"></div>
                    <span class="text-sm font-bold text-slate-900">Remote Activation of Safes at Durham and Connecticut</span>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Responsibility</p>
                    <p class="text-sm font-black text-slate-900">2026-01-07 EOD</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- 1.5 TRAINING OF PERSONNEL -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.5 Training of personnel</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800">
                <p>Medixsafe has been training personnel on a per safe activation basis. Part of the kick-off prior to pilot launch is to verify everyone has been trained and is comfortable with the safes, their operations and the software administration (where applicable) Timeline for completion: EOD 1/9/2026</p>
              </div>
              <div class="commitment-box">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Section Commitments</p>
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <div class="w-2 h-2 bg-[#d12913] rounded-full"></div>
                    <span class="text-sm font-bold text-slate-900">Remote Training of Personnel</span>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Responsibility</p>
                    <p class="text-sm font-black text-slate-900">2026-01-09 EOD</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- 1.6 PILOT SUCCESS CRITERIA -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.6 Pilot Success Criteria (Customer)</h3>
              </div>
              <div class="grid grid-cols-2 gap-12">
                <div class="space-y-4">
                  <h4 class="text-lg font-black uppercase tracking-tighter">1. Security & Compliance</h4>
                  <p class="text-sm text-slate-600 leading-relaxed">Safe maintains secure, locked storage with no unauthorized access or tampering events. Access controls (keypad, badge, biometric, code) function consistently. Audit logs or access attempt records are accessible and easy to read. Records meet DEA and state storage requirements. Remote accessibility and oversight is available.</p>
                </div>
                <div class="space-y-4">
                  <h4 class="text-lg font-black uppercase tracking-tighter">2. Reliability & System Stability</h4>
                  <p class="text-sm text-slate-600 leading-relaxed">The safe operates without mechanical or electronic failures that inhibit access. Locking mechanisms, alarms, and backup features work as intended throughout the pilot.</p>
                </div>
                <div class="space-y-4">
                  <h4 class="text-lg font-black uppercase tracking-tighter">3. Workflow Integration & User Experience</h4>
                  <p class="text-sm text-slate-600 leading-relaxed">Safe supports timely access with minimal workflow disruption. End‑users report that the device is intuitive, easy to operate, and does not add burden to manual inventory tasks.</p>
                </div>
                <div class="space-y-4">
                  <h4 class="text-lg font-black uppercase tracking-tighter">4. Operational Efficiency</h4>
                  <p class="text-sm text-slate-600 leading-relaxed">Storage layout and capacity align with workflow needs. The safe supports existing manual inventory and daily processes without adding additional time.</p>
                </div>
                <div class="space-y-4">
                  <h4 class="text-lg font-black uppercase tracking-tighter">5. Cost‑Effectiveness & Scalability</h4>
                  <p class="text-sm text-slate-600 leading-relaxed">Purchase, installation, and maintenance costs meet expectations. The device shows potential for broader deployment with minimal environmental or process changes.</p>
                </div>
              </div>
            </section>
          </div>

          <!-- 1.7 PILOT STARTS -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.7 Pilot Starts</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800">
                <p>Start Date: 2/5/2026 Timeline for completion: EOD 2/4/2026</p>
              </div>
              <div class="commitment-box">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Section Commitments</p>
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <div class="w-2 h-2 bg-[#d12913] rounded-full"></div>
                    <span class="text-sm font-bold text-slate-900">Pilot Start Date</span>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Responsibility</p>
                    <p class="text-sm font-black text-slate-900">2026-02-04 EOD</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- 1.8 PILOT CONCLUSION -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">1.8 Pilot Conclusion</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800">
                <p>Outgoing Survey to stakeholders. Final meeting to recap pilot, survey, etc. Meeting notes and recap to be filed and provided to ${project.customerName} Stakeholders. Timeline for completion: 3/6/2026</p>
              </div>
              <div class="commitment-box">
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Section Commitments</p>
                <div class="flex justify-between items-center">
                  <div class="flex items-center gap-3">
                    <div class="w-2 h-2 bg-[#d12913] rounded-full"></div>
                    <span class="text-sm font-bold text-slate-900">Pilot End Date</span>
                  </div>
                  <div class="text-right">
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Responsibility</p>
                    <p class="text-sm font-black text-slate-900">2026-03-06 EOD</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- CLOSING AND DOCUMENTATION -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Closing and Documentation</h3>
              </div>
              <ul class="space-y-4 list-disc pl-6 text-lg text-slate-800">
                <li>Final project completion report</li>
                <li>Project plan updates</li>
                <li>Project reviews and lessons learned</li>
                <li>Project closure</li>
              </ul>
            </section>
          </div>

          <!-- COMMUNICATION MANAGEMENT -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">Communication Management</h3>
              </div>
              <p class="text-lg text-slate-800">● Please review the communication management table below</p>
              <table>
                <thead>
                  <tr>
                    <th>Meeting</th>
                    <th>Frequency</th>
                    <th>Chairperson</th>
                    <th>Attendees</th>
                    <th>Format</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="font-bold">Weekly Progress Meeting</td>
                    <td>Weekly - up to 1 hour</td>
                    <td>MedixSafe Program Manager</td>
                    <td>
                      <ul class="list-disc pl-4">
                        <li>Customer Role Players</li>
                        <li>MedixSafe Program Manager</li>
                        <li>MedixSafe Project / Tech Team Leads</li>
                      </ul>
                    </td>
                    <td>Video conferencing (MS Teams or Zoom)/ Phone/ In Person</td>
                  </tr>
                  <tr>
                    <td class="font-bold">MedixSafe Testing and Validation</td>
                    <td>During Critical Testing Phases</td>
                    <td>MedixSafe Technical Account Manager/Program Manager</td>
                    <td>
                      <ul class="list-disc pl-4">
                        <li>Customer Technical leads</li>
                        <li>MedixSafe TAM/PM</li>
                        <li>MedixSafe Development (on Call)</li>
                        <li>MedixSafe QA (on call)</li>
                      </ul>
                    </td>
                    <td>Testing and validation sessions</td>
                  </tr>
                </tbody>
              </table>
            </section>
          </div>

          <!-- 2.0 CUSTOMER RESPONSIBILITIES -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">2.0 Customer Responsibilities</h3>
              </div>
              <p class="text-lg text-slate-800 leading-relaxed">In addition to any other obligations under the agreement, the following are the Customers’ responsibilities, which are required to complete the activities described in this SOW.</p>
              <ul class="space-y-4 list-disc pl-6 text-lg text-slate-800">
                <li>The Customer will provide information and resources as necessary for MedixSafe to complete the services available, and deliverables described in this statement of work</li>
                <li>The Customer will assign a PM/Central point of contact who is:
                  <ul class="list-disc pl-6 mt-2 space-y-2">
                    <li>Responsible for all Customer internal aspects of this engagement</li>
                    <li>Authorized to make all decisions or obtain all required internal approvals as needed on this project</li>
                    <li>Responsible for coordinating Customer team members</li>
                    <li>Authorized to approve project changes and sign status reports</li>
                  </ul>
                </li>
                <li>The Customer is responsible for providing MedixSafe personnel with the necessary security access to work areas, sites, etc. MedixSafe can help provide specifications and guidance as needed.</li>
                <li>The Customer is responsible for setting up any power, network components or other assets necessary to complete installation.</li>
              </ul>
            </section>
          </div>

          <!-- 3.0 RISK MANAGEMENT -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">3.0 Risk Management</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800 space-y-6">
                <p>MedixSafe will identify and assess project risks using a workshop in the initial phase of the project. The participants will be the MedixSafe project team, the customers’ project team and other relevant Customer personnel.</p>
                <p>At the completion of the risk assessment process, MedixSafe will ensure all identified risks are recorded in a risk register. The risk register will be kept up to date by all parties and will be presented and discussed at each project status meeting. It is expected that new risks will arise or be identified during the project. All new risks shall be captured in the risk register as they arise, and all parties will track, monitor, and actively mitigate them.</p>
              </div>
            </section>
          </div>

          <!-- 3.1 SCOPE CHANGE MANAGEMENT -->
          <div class="sow-print-page bg-white space-y-12">
            <section class="space-y-8">
              <div class="red-bar">
                 <h3 class="text-3xl font-black uppercase tracking-tighter">3.1 Scope Change Management</h3>
              </div>
              <div class="text-lg leading-relaxed text-slate-800 space-y-6">
                <p>The management of change during the project lifecycle is critical to successful delivery. Change management will effectively control change and variations to scope, cost, and time. Each out-of scope item will be estimated and presented to the customer for their approval.</p>
                <p>The response to a change request will form the baseline for this process:</p>
                <p>The change management process is as follows:</p>
                <ol class="list-decimal pl-6 space-y-4">
                  <li>Initiation: Identify and document the change request. Refer to project change request form for an example of a change request form i.e., stating the reason for change, the person who has logged the change request etc.</li>
                  <li>Evaluation: Determine effort to analyze the impact: Determine the estimated effort and cost to perform the change impact analysis. Depending on this assessment and the project tolerances the change could be rejected unless Customer has agreed to fund the change impact analysis.
                    <ul class="list-disc pl-6 mt-2">
                      <li>Change Impact Analysis: Should the analysis from a. above either be within the projects set tolerances or Customer has agreed to fund the change impact analysis then assign an impact analysis owner and perform the impact analysis i.e., determine the effort, impact, and cost of the change.</li>
                    </ul>
                  </li>
                  <li>Approval: Customer is required to agree and sign off the change request form. An approved Change request is known as a contract variation order (CVO) even if it does not include any additional charges to be provided by Customer.</li>
                  <li>Close out: Customer is required to verify and sign off that the change has been implemented correctly within five days of change implementation and completion. This may require an additional purchase order to be provided by Customer.</li>
                </ol>
              </div>
            </section>
          </div>

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

    // 1.1 Activity Description
    doc.addPage();
    addSectionHeader('1.1 Activity Description');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const activityText = `MedixSafe will lead the remote activation, configuration and training for the customer. In addition, the MedixSafe team will be responsible for providing training materials for ${project.customerName}'s LMS.`;
    const activityLines = doc.splitTextToSize(activityText, 170);
    doc.text(activityLines, 20, 45);

    // 1.2 Service Exclusions
    doc.addPage();
    addSectionHeader('1.2 Service Exclusions');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('The following services are excluded from this SOW: ● Any custom development/features/implementation', 20, 45);

    // 1.3 Professional Services
    doc.addPage();
    addSectionHeader('1.3 Professional Services');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const profText = `The Program Manager from the MedixSafe team is responsible for initiation, planning and controlling the services delivered, as well as rolling out and handing over the solution (s). These services may include the following activities:`;
    const profLines = doc.splitTextToSize(profText, 170);
    doc.text(profLines, 20, 45);

    // Planning
    doc.addPage();
    addSectionHeader('Planning');
    const planningItems = [
      'Collaborating to ensure a comprehensive understanding of business requirements and success criteria',
      'Defining the project scope and meticulously crafting a project plan or schedule to align with agreed-upon deadlines and deliverables',
      'Documenting and securing approval for requirement specifications to ensure clarity and alignment',
      'Identifying and establishing key project milestones for tracking progress',
      'Strategically planning and allocating resources to ensure timely achievement of project deliverables',
      'Confirming the availability of necessary resource capacity as outlined in the project plan to support successful outcomes'
    ];
    let planningY = 45;
    planningItems.forEach(item => {
      const lines = doc.splitTextToSize(`• ${item}`, 165);
      doc.text(lines, 20, planningY);
      planningY += (lines.length * 6) + 2;
    });

    // Executing
    doc.addPage();
    addSectionHeader('Executing');
    const executingItems = [
      'Establishing and maintaining the structure mechanisms, guidelines, procedures and required facilities to deliver the project',
      'Execute plan with internal MedixSafe resources during delivery of items as specified in Section 1.1 Activity Description',
      'Providing regular progress updates as needed and working with the Customer team to remove any dependencies',
      'Provide any project plan updates'
    ];
    let executingY = 45;
    executingItems.forEach(item => {
      const lines = doc.splitTextToSize(`• ${item}`, 165);
      doc.text(lines, 20, executingY);
      executingY += (lines.length * 6) + 2;
    });

    // Monitoring
    doc.addPage();
    addSectionHeader('Monitoring and Controlling');
    const monitoringItems = [
      'Overseeing day-to-day operations to ensure tasks are executed efficiently and deliverables are achieved on schedule.',
      'Maintaining comprehensive issue logs to track project challenges and resolutions.',
      'Engaging in escalation processes with stakeholders as necessary to facilitate timely decision-making.',
      'Collaborating effectively with MedixSafe project team members and leveraging internal resources to enhance project outcomes.',
      'Proactively managing changes in project scope through Integrated Change Control procedures to align with project goals.',
      'Ensuring that constraints and scope are effectively addressed to meet the established project objectives.',
      'Continuously monitoring, recording, and evaluating project deliverables against the project plan to guarantee success.'
    ];
    let monitoringY = 45;
    monitoringItems.forEach(item => {
      const lines = doc.splitTextToSize(`• ${item}`, 165);
      doc.text(lines, 20, monitoringY);
      monitoringY += (lines.length * 6) + 2;
    });

    // 1.4 Remote Activation
    doc.addPage();
    addSectionHeader('1.4 Remote Activation');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const activationText = `Remote activation of safe(s) at Durham and Connecticut location(s) respectively. Once all safes are activated and ready for use and the training is completed the pilot will start. Summary: Currently all safes at Connecticut have been activated. Durham safes still has to be activated. Timeline for completion: EOD 1/7/2026`;
    const activationLines = doc.splitTextToSize(activationText, 170);
    doc.text(activationLines, 20, 45);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 70, 170, 30, 'F');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('SECTION COMMITMENTS', 25, 78);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Remote Activation of Safes at Durham and Connecticut', 25, 88);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('INTERNAL RESPONSIBILITY', 185, 85, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text('2026-01-07 EOD', 185, 92, { align: 'right' });

    // 1.5 Training
    doc.addPage();
    addSectionHeader('1.5 Training of personnel');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const trainingText = `Medixsafe has been training personnel on a per safe activation basis. Part of the kick-off prior to pilot launch is to verify everyone has been trained and is comfortable with the safes, their operations and the software administration (where applicable) Timeline for completion: EOD 1/9/2026`;
    const trainingLines = doc.splitTextToSize(trainingText, 170);
    doc.text(trainingLines, 20, 45);
    
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 70, 170, 30, 'F');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('SECTION COMMITMENTS', 25, 78);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Remote Training of Personnel', 25, 88);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('INTERNAL RESPONSIBILITY', 185, 85, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text('2026-01-09 EOD', 185, 92, { align: 'right' });

    // 1.6 Success Criteria
    doc.addPage();
    addSectionHeader('1.6 Pilot Success Criteria (Customer)');
    const criteria = [
      { t: '1. Security & Compliance', c: 'Safe maintains secure, locked storage with no unauthorized access or tampering events. Access controls (keypad, badge, biometric, code) function consistently. Audit logs or access attempt records are accessible and easy to read. Records meet DEA and state storage requirements. Remote accessibility and oversight is available.' },
      { t: '2. Reliability & System Stability', c: 'The safe operates without mechanical or electronic failures that inhibit access. Locking mechanisms, alarms, and backup features work as intended throughout the pilot.' },
      { t: '3. Workflow Integration & User Experience', c: 'Safe supports timely access with minimal workflow disruption. End‑users report that the device is intuitive, easy to operate, and does not add burden to manual inventory tasks.' },
      { t: '4. Operational Efficiency', c: 'Storage layout and capacity align with workflow needs. The safe supports existing manual inventory and daily processes without adding additional time.' },
      { t: '5. Cost‑Effectiveness & Scalability', c: 'Purchase, installation, and maintenance costs meet expectations. The device shows potential for broader deployment with minimal environmental or process changes.' }
    ];
    let criteriaY = 45;
    criteria.forEach(item => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(item.t, 20, criteriaY);
      criteriaY += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(item.c, 170);
      doc.text(lines, 20, criteriaY);
      criteriaY += (lines.length * 5) + 5;
    });

    // 1.7 Pilot Starts
    doc.addPage();
    addSectionHeader('1.7 Pilot Starts');
    doc.text('Start Date: 2/5/2026 Timeline for completion: EOD 2/4/2026', 20, 45);
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 60, 170, 30, 'F');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('SECTION COMMITMENTS', 25, 68);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Pilot Start Date', 25, 78);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('CUSTOMER RESPONSIBILITY', 185, 75, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text('2026-02-04 EOD', 185, 82, { align: 'right' });

    // 1.8 Pilot Conclusion
    doc.addPage();
    addSectionHeader('1.8 Pilot Conclusion');
    doc.text(`Outgoing Survey to stakeholders. Final meeting to recap pilot, survey, etc. Meeting notes and recap to be filed and provided to ${project.customerName} Stakeholders. Timeline for completion: 3/6/2026`, 20, 45);
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 60, 170, 30, 'F');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('SECTION COMMITMENTS', 25, 68);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Pilot End Date', 25, 78);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('CUSTOMER RESPONSIBILITY', 185, 75, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text('2026-03-06 EOD', 185, 82, { align: 'right' });

    // Closing
    doc.addPage();
    addSectionHeader('Closing and Documentation');
    const closingItems = ['Final project completion report', 'Project plan updates', 'Project reviews and lessons learned', 'Project closure'];
    let closingY = 45;
    closingItems.forEach(item => {
      doc.text(`• ${item}`, 20, closingY);
      closingY += 7;
    });

    // Communication
    doc.addPage();
    addSectionHeader('Communication Management');
    doc.text('● Please review the communication management table below', 20, 45);
    autoTable(doc, {
      startY: 50,
      head: [['Meeting', 'Frequency', 'Chairperson', 'Attendees', 'Format']],
      body: [
        ['Weekly Progress Meeting', 'Weekly - up to 1 hour', 'MedixSafe Program Manager', 'Customer Role Players, MedixSafe PM, Tech Leads', 'Video/Phone/In Person'],
        ['Testing and Validation', 'During Critical Phases', 'MedixSafe TAM/PM', 'Customer Tech Leads, MedixSafe TAM/PM, Dev, QA', 'Testing sessions']
      ],
      headStyles: { fillColor: [248, 250, 252], textColor: [209, 41, 19], fontSize: 8 }
    });

    // 2.0 Responsibilities
    doc.addPage();
    addSectionHeader('2.0 Customer Responsibilities');
    const respText = `In addition to any other obligations under the agreement, the following are the Customers’ responsibilities, which are required to complete the activities described in this SOW.`;
    doc.text(doc.splitTextToSize(respText, 170), 20, 45);
    const respItems = [
      'The Customer will provide information and resources as necessary for MedixSafe to complete the services available, and deliverables described in this statement of work',
      'The Customer will assign a PM/Central point of contact who is responsible for all Customer internal aspects, authorized to make decisions, and coordinate team members',
      'The Customer is responsible for providing MedixSafe personnel with the necessary security access to work areas, sites, etc.',
      'The Customer is responsible for setting up any power, network components or other assets necessary to complete installation.'
    ];
    let respY = 60;
    respItems.forEach(item => {
      const lines = doc.splitTextToSize(`• ${item}`, 165);
      doc.text(lines, 20, respY);
      respY += (lines.length * 6) + 2;
    });

    // 3.0 Risk
    doc.addPage();
    addSectionHeader('3.0 Risk Management');
    const riskText = `MedixSafe will identify and assess project risks using a workshop in the initial phase of the project. The participants will be the MedixSafe project team, the customers’ project team and other relevant Customer personnel.\n\nAt the completion of the risk assessment process, MedixSafe will ensure all identified risks are recorded in a risk register. The risk register will be kept up to date by all parties and will be presented and discussed at each project status meeting.`;
    doc.text(doc.splitTextToSize(riskText, 170), 20, 45);

    // 3.1 Scope
    doc.addPage();
    addSectionHeader('3.1 Scope Change Management');
    const scopeText = `The management of change during the project lifecycle is critical to successful delivery. Change management will effectively control change and variations to scope, cost, and time. Each out-of scope item will be estimated and presented to the customer for their approval.`;
    doc.text(doc.splitTextToSize(scopeText, 170), 20, 45);

    // Locations
    doc.addPage();
    addSectionHeader('Deployment Locations');
    if (project.locations.length > 0) {
      const locData = project.locations.map(loc => [loc.name ?? '', loc.address ?? '', loc.numSafes ?? 0, loc.numUsers ?? 0, loc.deploymentType ?? '']);
      autoTable(doc, {
        startY: 40,
        head: [['Location', 'Address', 'Safes', 'Users', 'Type']],
        body: locData,
      });
    } else {
      doc.text('No locations defined in charter.', 20, 45);
    }

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
            {isPreview ? <><Edit3 size={16} /> Editor Mode</> : <><Eye size={16} /> Preview Mode</>}
          </button>
          <button onClick={handleDownloadPDF} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
            <Download size={16} /> Download PDF
          </button>
          <button onClick={handlePrint} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
            <Printer size={16} /> Print SOW
          </button>
          {isEditing ? (
            <button onClick={handleSave} className="px-8 py-2.5 bg-black text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand transition-all flex items-center gap-2 shadow-xl shadow-black/10">
              <Save size={16} /> Save SOW
            </button>
          ) : (
            <button onClick={() => setIsEditing(true)} className="px-8 py-2.5 bg-brand text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-dark transition-all flex items-center gap-2 shadow-xl shadow-brand/10">
              <Edit3 size={16} /> Edit SOW
            </button>
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

            {/* 1.1 Activity Description */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.1 Activity Description</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700">
                <p>MedixSafe will lead the remote activation, configuration and training for the customer. In addition, the MedixSafe team will be responsible for providing training materials for {project.customerName}'s LMS.</p>
              </div>
            </div>

            {/* 1.2 Service Exclusions */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.2 Service Exclusions</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700">
                <p>The following services are excluded from this SOW: ● Any custom development/features/implementation</p>
              </div>
            </div>

            {/* 1.3 Professional Services */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.3 Professional Services</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700">
                <p>The Program Manager from the MedixSafe team is responsible for initiation, planning and controlling the services delivered, as well as rolling out and handing over the solution (s). These services may include the following activities:</p>
              </div>
            </div>

            {/* Planning */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Planning</h3>
              </div>
              <ul className="space-y-4 list-disc pl-6 text-lg text-slate-700">
                <li>Collaborating to ensure a comprehensive understanding of business requirements and success criteria</li>
                <li>Defining the project scope and meticulously crafting a project plan or schedule to align with agreed-upon deadlines and deliverables</li>
                <li>Documenting and securing approval for requirement specifications to ensure clarity and alignment</li>
                <li>Identifying and establishing key project milestones for tracking progress</li>
                <li>Strategically planning and allocating resources to ensure timely achievement of project deliverables</li>
                <li>Confirming the availability of necessary resource capacity as outlined in the project plan to support successful outcomes</li>
              </ul>
            </div>

            {/* Executing */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Executing</h3>
              </div>
              <ul className="space-y-4 list-disc pl-6 text-lg text-slate-700">
                <li>Establishing and maintaining the structure mechanisms, guidelines, procedures and required facilities to deliver the project</li>
                <li>Execute plan with internal MedixSafe resources during delivery of items as specified in Section 1.1 Activity Description</li>
                <li>Providing regular progress updates as needed and working with the Customer team to remove any dependencies</li>
                <li>Provide any project plan updates</li>
              </ul>
            </div>

            {/* Monitoring and Controlling */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter text-wrap">Monitoring and Controlling</h3>
              </div>
              <ul className="space-y-4 list-disc pl-6 text-lg text-slate-700">
                <li>Overseeing day-to-day operations to ensure tasks are executed efficiently and deliverables are achieved on schedule.</li>
                <li>Maintaining comprehensive issue logs to track project challenges and resolutions.</li>
                <li>Engaging in escalation processes with stakeholders as necessary to facilitate timely decision-making.</li>
                <li>Collaborating effectively with MedixSafe project team members and leveraging internal resources to enhance project outcomes.</li>
                <li>Proactively managing changes in project scope through Integrated Change Control procedures to align with project goals.</li>
                <li>Ensuring that constraints and scope are effectively addressed to meet the established project objectives.</li>
                <li>Continuously monitoring, recording, and evaluating project deliverables against the project plan to guarantee success.</li>
              </ul>
            </div>

            {/* 1.4 Remote Activation */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.4 Remote Activation</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700">
                <p>Remote activation of safe(s) at Durham and Connecticut location(s) respectively. Once all safes are activated and ready for use and the training is completed the pilot will start. Summary: Currently all safes at Connecticut have been activated. Durham safes still has to be activated. Timeline for completion: EOD 1/7/2026</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Section Commitments</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#d12913] rounded-full" />
                    <span className="text-sm font-bold text-slate-900">Remote Activation of Safes at Durham and Connecticut</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Responsibility</p>
                    <p className="text-sm font-black text-slate-900">2026-01-07 EOD</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 1.5 Training of personnel */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.5 Training of personnel</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700">
                <p>Medixsafe has been training personnel on a per safe activation basis. Part of the kick-off prior to pilot launch is to verify everyone has been trained and is comfortable with the safes, their operations and the software administration (where applicable) Timeline for completion: EOD 1/9/2026</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Section Commitments</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#d12913] rounded-full" />
                    <span className="text-sm font-bold text-slate-900">Remote Training of Personnel</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Responsibility</p>
                    <p className="text-sm font-black text-slate-900">2026-01-09 EOD</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 1.6 Pilot Success Criteria (Customer) */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.6 Pilot Success Criteria (Customer)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <h4 className="text-lg font-black uppercase tracking-tighter">1. Security & Compliance</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">Safe maintains secure, locked storage with no unauthorized access or tampering events. Access controls (keypad, badge, biometric, code) function consistently. Audit logs or access attempt records are accessible and easy to read. Records meet DEA and state storage requirements. Remote accessibility and oversight is available.</p>
                </div>
                <div className="space-y-4">
                  <h4 className="text-lg font-black uppercase tracking-tighter">2. Reliability & System Stability</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">The safe operates without mechanical or electronic failures that inhibit access. Locking mechanisms, alarms, and backup features work as intended throughout the pilot.</p>
                </div>
                <div className="space-y-4">
                  <h4 className="text-lg font-black uppercase tracking-tighter">3. Workflow Integration & User Experience</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">Safe supports timely access with minimal workflow disruption. End‑users report that the device is intuitive, easy to operate, and does not add burden to manual inventory tasks.</p>
                </div>
                <div className="space-y-4">
                  <h4 className="text-lg font-black uppercase tracking-tighter">4. Operational Efficiency</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">Storage layout and capacity align with workflow needs. The safe supports existing manual inventory and daily processes without adding additional time.</p>
                </div>
                <div className="space-y-4">
                  <h4 className="text-lg font-black uppercase tracking-tighter">5. Cost‑Effectiveness & Scalability</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">Purchase, installation, and maintenance costs meet expectations. The device shows potential for broader deployment with minimal environmental or process changes.</p>
                </div>
              </div>
            </div>

            {/* 1.7 Pilot Starts */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.7 Pilot Starts</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700">
                <p>Start Date: 2/5/2026 Timeline for completion: EOD 2/4/2026</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Section Commitments</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#d12913] rounded-full" />
                    <span className="text-sm font-bold text-slate-900">Pilot Start Date</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Responsibility</p>
                    <p className="text-sm font-black text-slate-900">2026-02-04 EOD</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 1.8 Pilot Conclusion */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">1.8 Pilot Conclusion</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700">
                <p>Outgoing Survey to stakeholders. Final meeting to recap pilot, survey, etc. Meeting notes and recap to be filed and provided to {project.customerName} Stakeholders. Timeline for completion: 3/6/2026</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Section Commitments</p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#d12913] rounded-full" />
                    <span className="text-sm font-bold text-slate-900">Pilot End Date</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Responsibility</p>
                    <p className="text-sm font-black text-slate-900">2026-03-06 EOD</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Closing and Documentation */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Closing and Documentation</h3>
              </div>
              <ul className="space-y-4 list-disc pl-6 text-lg text-slate-700">
                <li>Final project completion report</li>
                <li>Project plan updates</li>
                <li>Project reviews and lessons learned</li>
                <li>Project closure</li>
              </ul>
            </div>

            {/* Communication Management */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Communication Management</h3>
              </div>
              <p className="text-lg text-slate-700">● Please review the communication management table below</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="p-4 border border-slate-200 text-left text-xs font-black uppercase tracking-widest text-[#d12913]">Meeting</th>
                      <th className="p-4 border border-slate-200 text-left text-xs font-black uppercase tracking-widest text-[#d12913]">Frequency</th>
                      <th className="p-4 border border-slate-200 text-left text-xs font-black uppercase tracking-widest text-[#d12913]">Chairperson</th>
                      <th className="p-4 border border-slate-200 text-left text-xs font-black uppercase tracking-widest text-[#d12913]">Attendees</th>
                      <th className="p-4 border border-slate-200 text-left text-xs font-black uppercase tracking-widest text-[#d12913]">Format</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-4 border border-slate-200 text-sm font-bold">Weekly Progress Meeting</td>
                      <td className="p-4 border border-slate-200 text-sm">Weekly - up to 1 hour</td>
                      <td className="p-4 border border-slate-200 text-sm">MedixSafe Program Manager</td>
                      <td className="p-4 border border-slate-200 text-sm">
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Customer Role Players</li>
                          <li>MedixSafe Program Manager</li>
                          <li>MedixSafe Project / Tech Team Leads</li>
                        </ul>
                      </td>
                      <td className="p-4 border border-slate-200 text-sm">Video conferencing (MS Teams or Zoom)/ Phone/ In Person</td>
                    </tr>
                    <tr>
                      <td className="p-4 border border-slate-200 text-sm font-bold">MedixSafe Testing and Validation</td>
                      <td className="p-4 border border-slate-200 text-sm">During Critical Testing Phases</td>
                      <td className="p-4 border border-slate-200 text-sm text-wrap">MedixSafe Technical Account Manager/Program Manager</td>
                      <td className="p-4 border border-slate-200 text-sm">
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Customer Technical leads</li>
                          <li>MedixSafe TAM/PM</li>
                          <li>MedixSafe Development (on Call)</li>
                          <li>MedixSafe QA (on call)</li>
                        </ul>
                      </td>
                      <td className="p-4 border border-slate-200 text-sm">Testing and validation sessions</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2.0 Customer Responsibilities */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">2.0 Customer Responsibilities</h3>
              </div>
              <p className="text-lg text-slate-700 leading-relaxed">In addition to any other obligations under the agreement, the following are the Customers’ responsibilities, which are required to complete the activities described in this SOW.</p>
              <ul className="space-y-4 list-disc pl-6 text-lg text-slate-700">
                <li>The Customer will provide information and resources as necessary for MedixSafe to complete the services available, and deliverables described in this statement of work</li>
                <li>The Customer will assign a PM/Central point of contact who is:
                  <ul className="list-disc pl-6 mt-2 space-y-2">
                    <li>Responsible for all Customer internal aspects of this engagement</li>
                    <li>Authorized to make all decisions or obtain all required internal approvals as needed on this project</li>
                    <li>Responsible for coordinating Customer team members</li>
                    <li>Authorized to approve project changes and sign status reports</li>
                  </ul>
                </li>
                <li>The Customer is responsible for providing MedixSafe personnel with the necessary security access to work areas, sites, etc. MedixSafe can help provide specifications and guidance as needed.</li>
                <li>The Customer is responsible for setting up any power, network components or other assets necessary to complete installation.</li>
              </ul>
            </div>

            {/* 3.0 Risk Management */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">3.0 Risk Management</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700 space-y-6">
                <p>MedixSafe will identify and assess project risks using a workshop in the initial phase of the project. The participants will be the MedixSafe project team, the customers’ project team and other relevant Customer personnel.</p>
                <p>At the completion of the risk assessment process, MedixSafe will ensure all identified risks are recorded in a risk register. The risk register will be kept up to date by all parties and will be presented and discussed at each project status meeting. It is expected that new risks will arise or be identified during the project. All new risks shall be captured in the risk register as they arise, and all parties will track, monitor, and actively mitigate them.</p>
              </div>
            </div>

            {/* 3.1 Scope Change Management */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-8">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">3.1 Scope Change Management</h3>
              </div>
              <div className="text-lg leading-relaxed text-slate-700 space-y-6">
                <p>The management of change during the project lifecycle is critical to successful delivery. Change management will effectively control change and variations to scope, cost, and time. Each out-of scope item will be estimated and presented to the customer for their approval.</p>
                <p>The response to a change request will form the baseline for this process:</p>
                <p>The change management process is as follows:</p>
                <ol className="list-decimal pl-6 space-y-4">
                  <li>Initiation: Identify and document the change request. Refer to project change request form for an example of a change request form i.e., stating the reason for change, the person who has logged the change request etc.</li>
                  <li>Evaluation: Determine effort to analyze the impact: Determine the estimated effort and cost to perform the change impact analysis. Depending on this assessment and the project tolerances the change could be rejected unless Customer has agreed to fund the change impact analysis.
                    <ul className="list-disc pl-6 mt-2">
                      <li>Change Impact Analysis: Should the analysis from a. above either be within the projects set tolerances or Customer has agreed to fund the change impact analysis then assign an impact analysis owner and perform the impact analysis i.e., determine the effort, impact, and cost of the change.</li>
                    </ul>
                  </li>
                  <li>Approval: Customer is required to agree and sign off the change request form. An approved Change request is known as a contract variation order (CVO) even if it does not include any additional charges to be provided by Customer.</li>
                  <li>Close out: Customer is required to verify and sign off that the change has been implemented correctly within five days of change implementation and completion. This may require an additional purchase order to be provided by Customer.</li>
                </ol>
                <p>Changes may be initiated by Customer because of functional or feature requirements changes, market or regulatory requirements. Situations may occasionally arise where MedixSafe initiates a change request, providing Customer with more flexible options. In such situations attention is directed to the impact and risks of such a change on existing project objectives.</p>
                <p>The changes requested to the agreed project baseline will be identified and documented and the impact will be assessed (assessment may be billable). At completion of the assessment, change activity will be carried out upon agreement by Customer.</p>
              </div>
            </div>

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

            {/* Authorization Preview */}
            <div className="p-20 border-t border-slate-100 bg-white space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Authorization</h3>
              </div>
              <p className="text-lg text-slate-700 leading-relaxed">By signing below, the parties agree to the terms and scope of work defined in this document. This Statement of Work is effective as of {new Date().toLocaleDateString()}.</p>
              <div className="grid grid-cols-2 gap-20 pt-20">
                <div className="space-y-12">
                  <div className="border-b-2 border-slate-200 w-full h-24"></div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Authorization</p>
                    <p className="text-sm font-black uppercase text-slate-900">{project.customerName}</p>
                  </div>
                </div>
                <div className="space-y-12">
                  <div className="border-b-2 border-slate-200 w-full h-24"></div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Internal Authorization</p>
                    <p className="text-sm font-black uppercase text-slate-900">{globalSettings.companyName || 'MedixSafe'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Stakeholders Preview */}
            <div className="p-20 bg-white border-t border-slate-100 space-y-12">
              <div className="flex items-center gap-4 border-l-4 border-[#d12913] pl-6">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Key Stakeholders</h3>
              </div>
              
              <div className="space-y-12">
                <div className="space-y-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#d12913]">Client Operations</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {project.contacts.filter(c => c.side === 'customer').map(c => (
                      <div key={c.id} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
                        <p className="text-lg font-black text-slate-900 uppercase">{c.name}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.role}</p>
                        <p className="text-xs text-slate-500">{c.email}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-xs font-black uppercase tracking-widest text-[#d12913]">MedixSafe Internal Team</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {project.contacts.filter(c => c.side === 'internal').map(c => (
                      <div key={c.id} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
                        <p className="text-lg font-black text-slate-900 uppercase">{c.name}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.role}</p>
                        <p className="text-xs text-slate-500">{c.email}</p>
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
              </div>
            </div>

            {/* Predefined Sections Indicator */}
            <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 flex items-center gap-4 opacity-60">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm"><FileText size={20} /></div>
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Auto-Injected Framework</p>
                  <p className="text-sm font-bold text-slate-900">Pages 01-03: Overview, Stakeholders, Success Criteria, Timeline, Costing</p>
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
                <span className="text-[10px] font-black uppercase tracking-[0.4em]">Append Dynamic SOW Component</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
