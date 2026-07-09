import { supabase } from './supabaseClient';
import type { Project, GlobalSettings } from '../types';

// Helper: convert DB row → Project
function rowToProject(row: Record<string, unknown>): Project {
  const data = (row.data as Record<string, unknown>) ?? {};
  return {
    id: row.id as string,
    title: row.title as string,
    customerName: row.customer_name as string,
    projectOverview: (row.project_overview as string) ?? '',
    deploymentType: (row.deployment_type as Project['deploymentType']) ?? 'both',
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    revision: (row.revision as number) ?? 1,
    isClosed: (row.is_closed as boolean) ?? false,
    isArchived: (row.is_archived as boolean) ?? false,
    isExtended: (row.is_extended as boolean) ?? false,
    extensionReason: row.extension_reason as string | undefined,
    extendedEndDate: row.extended_end_date as string | undefined,
    customerSentiment: row.customer_sentiment as Project['customerSentiment'],
    sowCost: row.sow_cost as number | undefined,
    costingCurrency: (row.costing_currency as 'USD' | 'CAD') ?? 'USD',
    logoBase64: row.logo_base64 as string | undefined,
    aiAnalysisSummary: row.ai_analysis_summary as string | undefined,
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
    // All remaining fields stored in JSONB data column
    locations: (data.locations as Project['locations']) ?? [],
    revisions: (data.revisions as Project['revisions']) ?? [],
    customerSuccessCriteria: (data.customerSuccessCriteria as Project['customerSuccessCriteria']) ?? [],
    ourSuccessCriteria: (data.ourSuccessCriteria as Project['ourSuccessCriteria']) ?? [],
    accomplishments: (data.accomplishments as string[]) ?? [],
    milestones: (data.milestones as Project['milestones']) ?? [],
    contacts: (data.contacts as Project['contacts']) ?? [],
    surveyQuestions: (data.surveyQuestions as Project['surveyQuestions']) ?? [],
    costingItems: (data.costingItems as Project['costingItems']) ?? [],
    sowTOC: data.sowTOC as string | undefined,
    sowSections: (data.sowSections as Project['sowSections']) ?? [],
    hardwareNodes: (data.hardwareNodes as Project['hardwareNodes']) ?? [],
    readinessCategories: (data.readinessCategories as Project['readinessCategories']) ?? [],
    sowMeta: data.sowMeta as Project['sowMeta'] | undefined,
    customerSignature: data.customerSignature as string | undefined,
    ourSignature: data.ourSignature as string | undefined,
  };
}

// Helper: convert Project → DB columns
function projectToRow(p: Project) {
  const {
    id, title, customerName, projectOverview, deploymentType,
    startDate, endDate, revision, isClosed, isArchived, isExtended,
    extensionReason, extendedEndDate, customerSentiment, sowCost,
    costingCurrency, logoBase64, aiAnalysisSummary,
    // Everything else goes into data
    locations, revisions, customerSuccessCriteria, ourSuccessCriteria,
    accomplishments, milestones, contacts, surveyQuestions,
    costingItems, sowTOC, sowSections, hardwareNodes, readinessCategories,
    customerSignature, ourSignature, sowMeta,
    ...rest
  } = p;

  return {
    id,
    title,
    customer_name: customerName,
    project_overview: projectOverview,
    deployment_type: deploymentType,
    start_date: startDate,
    end_date: endDate,
    revision,
    is_closed: isClosed,
    is_archived: isArchived ?? false,
    is_extended: isExtended,
    extension_reason: extensionReason,
    extended_end_date: extendedEndDate,
    customer_sentiment: customerSentiment,
    sow_cost: sowCost,
    costing_currency: costingCurrency,
    logo_base64: logoBase64,
    ai_analysis_summary: aiAnalysisSummary,
    updated_at: new Date().toISOString(),
    data: {
      locations, revisions, customerSuccessCriteria, ourSuccessCriteria,
      accomplishments, milestones, contacts, surveyQuestions,
      costingItems, sowTOC, sowSections, hardwareNodes, readinessCategories,
      customerSignature, ourSignature, sowMeta,
    },
  };
}

export const projectService = {
  async list(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('projects.list error:', error.message);
      throw new Error(error.message);
    }
    return (data ?? []).map(rowToProject);
  },

  async get(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return rowToProject(data);
  },

  async create(p: Project): Promise<Project> {
    const row = projectToRow(p);
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { error: insertError } = await supabase
          .from('projects')
          .insert({ ...row, created_at: new Date().toISOString() });
        if (insertError) throw new Error(insertError.message);

        const { data, error: selectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', p.id)
          .single();
        if (selectError) throw new Error(selectError.message);
        return rowToProject(data);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        console.warn(`[projectService.create] attempt ${attempt} failed:`, lastError.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
    throw lastError ?? new Error('Failed to create project after 3 attempts');
  },

  async update(p: Project): Promise<void> {
    // Build the top-level column updates (non-JSONB fields)
    const row = projectToRow(p);
    const { data: _data, ...topLevelColumns } = row;

    // Patch the data JSONB column using Postgres || merge operator via RPC.
    // This merges only the keys present in our update without touching other keys,
    // so concurrent saves from different tabs never overwrite each other.
    const patch = row.data as Record<string, unknown>;

    const { error } = await supabase.rpc('patch_project', {
      p_id: p.id,
      p_columns: topLevelColumns,
      p_data_patch: patch,
    });

    if (error) {
      // RPC not available yet — fall back to safe merge approach
      console.warn('patch_project RPC not found, falling back to merge update:', error.message);
      const { data: current } = await supabase
        .from('projects')
        .select('data')
        .eq('id', p.id)
        .single();

      const merged = {
        ...((current?.data ?? {}) as object),
        ...patch,
      };

      const { error: fallbackError } = await supabase
        .from('projects')
        .update({ ...topLevelColumns, data: merged })
        .eq('id', p.id);
      if (fallbackError) throw new Error(fallbackError.message);
    }
  },


  async delete(id: string): Promise<void> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (!error) return;
      lastError = new Error(error.message);
      console.warn(`[projectService.delete] attempt ${attempt} failed:`, error.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1500));
    }
    throw lastError ?? new Error('Failed to delete project');
  },

  async patch(
    id: string,
    fields: Partial<{
      is_closed: boolean;
      is_archived: boolean;
      is_extended: boolean;
      extension_reason: string;
      extended_end_date: string;
      customer_sentiment: string;
      ai_analysis_summary: string;
    }>
  ): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
};

export const settingsService = {
  async load(): Promise<GlobalSettings> {
    const { data, error } = await supabase
      .from('global_settings')
      .select('*')
      .eq('id', 'singleton')
      .maybeSingle();

    if (error) {
      console.warn('global_settings load error:', error.message);
      return { sidebarTitle: 'Project Tracker', companyName: 'MedixSafe' };
    }
    if (!data) {
      // Row missing — insert it silently and return defaults
      await supabase.from('global_settings').upsert({ id: 'singleton', sidebar_title: 'Project Tracker' });
      return { sidebarTitle: 'Project Tracker', companyName: 'MedixSafe' };
    }

    const settingsData = data.data as Record<string, unknown> | null;
    return {
      sidebarTitle: data.sidebar_title ?? 'Project Tracker',
      companyName: data.company_name,
      address: data.address,
      phone: data.phone,
      supportEmail: data.support_email,
      salesEmail: data.sales_email,
      sidebarIconBase64: data.sidebar_icon_base64,
      companyLogoBase64: data.company_logo_base64,
      internalContacts: (settingsData?.internalContacts as GlobalSettings['internalContacts']) ?? [],
    };
  },

  async save(s: GlobalSettings): Promise<void> {
    const { error } = await supabase.from('global_settings').upsert({
      id: 'singleton',
      sidebar_title: s.sidebarTitle,
      company_name: s.companyName,
      address: s.address,
      phone: s.phone,
      support_email: s.supportEmail,
      sales_email: s.salesEmail,
      sidebar_icon_base64: s.sidebarIconBase64,
      company_logo_base64: s.companyLogoBase64,
      updated_at: new Date().toISOString(),
      data: { internalContacts: s.internalContacts ?? [] },
    });
    if (error) throw new Error(error.message);
  },
};
