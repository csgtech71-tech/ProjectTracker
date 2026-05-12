import { supabase } from './supabaseClient';
import { parseLogFile } from '../parsers/logParser';
import type { AccessEvent, SystemEvent, LogImport } from '../types';

export interface IngestionResult {
  filename: string;
  deviceId: string;
  accessEvents: number;
  systemEvents: number;
  lineCount: number;
  error?: string;
}

export const logIngestionService = {
  async ingestFile(
    file: File,
    projectId: string,
    userId: string,
    knownDeviceIds: string[]
  ): Promise<IngestionResult> {
    const text = await file.text();
    const result = parseLogFile(text);

    if (result.deviceIds.length === 0) {
      return {
        filename: file.name,
        deviceId: 'unknown',
        accessEvents: 0,
        systemEvents: 0,
        lineCount: result.lineCount,
        error: 'No device ID detected in log file.',
      };
    }

    const deviceId = result.deviceIds[0];

    // Upsert hardware node if we don't know about it yet
    if (!knownDeviceIds.includes(deviceId)) {
      await supabase.from('hardware_nodes').upsert(
        {
          id: deviceId,
          project_id: projectId,
          status: 'active',
          firmware: result.firmware,
          ip_address: result.ipAddress,
          wifi_ssid: result.wifiSsid,
          last_seen: new Date().toISOString(),
          cert_expires: result.certExpires
            ? new Date(result.certExpires).toISOString()
            : undefined,
        },
        { onConflict: 'id', ignoreDuplicates: false }
      );
    } else {
      // Update diagnostic fields on known node
      const update: Record<string, unknown> = { last_seen: new Date().toISOString() };
      if (result.firmware) update.firmware = result.firmware;
      if (result.ipAddress) update.ip_address = result.ipAddress;
      if (result.wifiSsid) update.wifi_ssid = result.wifiSsid;
      if (result.certExpires)
        update.cert_expires = new Date(result.certExpires).toISOString();
      await supabase.from('hardware_nodes').update(update).eq('id', deviceId);
    }

    // Insert log import record
    const importRecord: LogImport = {
      device_id: deviceId,
      project_id: projectId,
      filename: file.name,
      imported_by: userId,
      line_count: result.lineCount,
      event_count: result.accessEvents.length + result.systemEvents.length,
    };

    const { data: importData, error: importError } = await supabase
      .from('log_imports')
      .insert(importRecord)
      .select('id')
      .single();

    if (importError) {
      return {
        filename: file.name,
        deviceId,
        accessEvents: 0,
        systemEvents: 0,
        lineCount: result.lineCount,
        error: importError.message,
      };
    }

    const importId = importData.id;

    // Insert access events in batches of 500
    const accessRows: AccessEvent[] = result.accessEvents.map((e) => ({
      ...e,
      import_id: importId,
      project_id: projectId,
    }));

    for (let i = 0; i < accessRows.length; i += 500) {
      const batch = accessRows.slice(i, i + 500);
      const { error } = await supabase.from('access_events').insert(batch);
      if (error) console.error('Access event batch insert error:', error);
    }

    // Insert system events in batches of 500
    const systemRows: SystemEvent[] = result.systemEvents.map((e) => ({
      ...e,
      import_id: importId,
      project_id: projectId,
    }));

    for (let i = 0; i < systemRows.length; i += 500) {
      const batch = systemRows.slice(i, i + 500);
      const { error } = await supabase.from('system_events').insert(batch);
      if (error) console.error('System event batch insert error:', error);
    }

    return {
      filename: file.name,
      deviceId,
      accessEvents: accessRows.length,
      systemEvents: systemRows.length,
      lineCount: result.lineCount,
    };
  },

  async getAccessEvents(
    projectId: string,
    filters?: {
      deviceId?: string;
      startDate?: string;
      endDate?: string;
      result?: 'success' | 'failure';
    }
  ): Promise<AccessEvent[]> {
    let query = supabase
      .from('access_events')
      .select('*')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: false });

    if (filters?.deviceId) query = query.eq('device_id', filters.deviceId);
    if (filters?.startDate) query = query.gte('occurred_at', filters.startDate);
    if (filters?.endDate) query = query.lte('occurred_at', filters.endDate);
    if (filters?.result) query = query.eq('result', filters.result);

    const { data, error } = await query.limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as AccessEvent[];
  },

  async getSystemEvents(
    projectId: string,
    filters?: {
      deviceId?: string;
      eventTypes?: string[];
      startDate?: string;
      endDate?: string;
    }
  ): Promise<SystemEvent[]> {
    let query = supabase
      .from('system_events')
      .select('*')
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: false });

    if (filters?.deviceId) query = query.eq('device_id', filters.deviceId);
    if (filters?.eventTypes && filters.eventTypes.length > 0)
      query = query.in('event_type', filters.eventTypes);
    if (filters?.startDate) query = query.gte('occurred_at', filters.startDate);
    if (filters?.endDate) query = query.lte('occurred_at', filters.endDate);

    const { data, error } = await query.limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? []) as SystemEvent[];
  },

  async getLogImports(projectId: string): Promise<LogImport[]> {
    const { data, error } = await supabase
      .from('log_imports')
      .select('*')
      .eq('project_id', projectId)
      .order('imported_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as LogImport[];
  },

  async deleteImport(importId: string): Promise<void> {
    // Cascades delete access_events and system_events with this import_id
    const { error } = await supabase
      .from('log_imports')
      .delete()
      .eq('id', importId);
    if (error) throw new Error(error.message);
  },

  async getAnalyticsSettings(projectId?: string) {
    const { data } = await supabase
      .from('analytics_display_settings')
      .select('*')
      .eq('id', 'singleton')
      .single();
    return data;
  },

  async saveAnalyticsSettings(settings: Record<string, boolean>) {
    const { error } = await supabase
      .from('analytics_display_settings')
      .upsert({ id: 'singleton', ...settings, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  },
};
