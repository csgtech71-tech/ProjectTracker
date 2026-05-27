import type { AccessEvent, SystemEvent, HardwareAuthType } from '../types';

// ─── types ───────────────────────────────────────────────────────────────────

interface RawEvent {
  timestamp: Date;
  deviceId: string;
  level: 'info' | 'warn' | 'error';
  module: string;
  message: string;
  raw: string;
}

export interface ParseResult {
  accessEvents: AccessEvent[];
  systemEvents: SystemEvent[];
  deviceIds: string[];
  configuredAuthType?: string;
  firmware?: string;
  ipAddress?: string;
  wifiSsid?: string;
  wifiSignalDbm?: number;
  certExpires?: string;
  credentialCount?: number;
  lineCount: number;
  rawEventCount: number;
}

// ─── format detection & parsing ───────────────────────────────────────────────

const ANSI_RE = /\x1B\[[0-9;]*[a-zA-Z]/g;

// TXT format: YY-MM-DD HH:MM:SS: [deviceid] level  [module] message
const TXT_LINE_RE =
  /^(\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}):\s+\[([a-f0-9A-F]{12})\]\s+(info|warn|error)\s+\[([^\]]+)\]\s+(.+)$/;

// CSV header columns
const CSV_HEADER = '_ts,enqueuedTimeDevice,level,message';

function stripAnsi(line: string): string {
  return line.replace(ANSI_RE, '');
}

function parseTxtTimestamp(ts: string): Date {
  const [date, time] = ts.split(' ');
  const [yy, mm, dd] = date.split('-');
  return new Date(`20${yy}-${mm}-${dd}T${time}`);
}

// Infer module from CSV message content (no [module] tag in CSV format)
function inferModule(message: string): string {
  if (/card tapped on Door/i.test(message)) return 'wiegand';
  if (/Signal to unlock/i.test(message)) return 'doorRelay';
  if (/Door \d+ was (opened|closed)/i.test(message)) return 'crdHndlr';
  if (/1:1 fingerprint|1:N match|authorized fingerprint|cloud authorized|authorized the card|UserID entered|PIN digit|session_interrupted|denied|timed out/i.test(message)) return 'crdHndlr';
  if (/Successful 1:N match|SFM/i.test(message)) return 'SFM';
  if (/MQTT|Disconnected|connection lost|Connected successfully|Missed more than/i.test(message)) return 'MQTT';
  if (/BOOTED|error reboots|Last boot was|Rebooted \d+ times/i.test(message)) return 'stats';
  if (/Restarting/i.test(message)) return 'watchdog';
  if (/FIELD SUPPORT DATA|Gathering tech support|Firmware |IP address is|Network is via|Wifi signal|cert expires|Local cache has|Configured for/i.test(message)) return 'stats';
  if (/FAILURE/i.test(message)) return 'eventLog';
  if (/Setting NVS config|Configuring|Received a config|Sending value for key/i.test(message)) return 'config';
  if (/cloudSync|Processed a new/i.test(message)) return 'sync';
  if (/Scan received/i.test(message)) return 'scanner';
  return 'other';
}

// Extract device ID from a CSV filename
// e.g. "device-logs-08-b6-1f-b2-63-9c-2026-05-27-13-08-49.csv" → "08b61fb2639c"
function deviceIdFromFilename(filename: string): string | null {
  // Match 6 groups of 2 hex chars separated by hyphens
  const m = filename.match(/([0-9a-f]{2}(?:-[0-9a-f]{2}){5})/i);
  if (!m) return null;
  return m[1].replace(/-/g, '').toLowerCase();
}

function parseCsvText(text: string, filename: string): RawEvent[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Verify it's a CSV with expected header
  const header = lines[0].toLowerCase();
  if (!header.includes('enqueuedtimedevice') && !header.includes('level') && !header.includes('message')) return [];

  // Get device ID from filename
  const deviceId = deviceIdFromFilename(filename) || 'unknown';

  // Parse header to find column indices
  const cols = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/"/g, ''));
  const tsCol = cols.indexOf('enqueuedtimedevice');
  const levelCol = cols.indexOf('level');
  const msgCol = cols.indexOf('message');

  if (tsCol < 0 || levelCol < 0 || msgCol < 0) return [];

  const events: RawEvent[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted fields (message may contain commas)
    const fields = parseCsvLine(line);
    if (fields.length <= Math.max(tsCol, levelCol, msgCol)) continue;

    const timestampStr = fields[tsCol]?.replace(/"/g, '').trim();
    const level = fields[levelCol]?.replace(/"/g, '').trim() as RawEvent['level'];
    const message = fields[msgCol]?.replace(/^"|"$/g, '').trim();

    if (!timestampStr || !message) continue;

    const timestamp = new Date(timestampStr);
    if (isNaN(timestamp.getTime())) continue;

    events.push({
      timestamp,
      deviceId,
      level: (['info', 'warn', 'error'].includes(level) ? level : 'info') as RawEvent['level'],
      module: inferModule(message),
      message,
      raw: line,
    });
  }

  return events;
}

// Simple CSV line parser that handles quoted fields
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function isCsvFormat(text: string): boolean {
  const firstLine = text.split(/\r?\n/)[0]?.toLowerCase() || '';
  return firstLine.includes('enqueuedtimedevice') || firstLine.includes('_ts,');
}

// ─── public parse entry point ─────────────────────────────────────────────────

export function parseLogFile(text: string, filename?: string): ParseResult {
  const lines = text.split(/\r?\n/);
  let rawEvents: RawEvent[] = [];

  if (isCsvFormat(text)) {
    // CSV format — parse with CSV parser
    rawEvents = parseCsvText(text, filename || '');
  } else {
    // TXT format — original line-by-line parser
    for (const rawLine of lines) {
      if (!rawLine.trim()) continue;
      const cleaned = stripAnsi(rawLine);
      const m = cleaned.match(TXT_LINE_RE);
      if (!m) continue;
      rawEvents.push({
        timestamp: parseTxtTimestamp(m[1]),
        deviceId: m[2].toLowerCase(),
        level: m[3] as RawEvent['level'],
        module: m[4],
        message: m[5].trim(),
        raw: cleaned,
      });
    }
  }

  const deviceIds = [...new Set(rawEvents.map((e) => e.deviceId))];
  const accessEvents: AccessEvent[] = [];
  const systemEvents: SystemEvent[] = [];
  let configuredAuthType: string | undefined;
  let firmware: string | undefined;
  let ipAddress: string | undefined;
  let wifiSsid: string | undefined;
  let wifiSignalDbm: number | undefined;
  let certExpires: string | undefined;
  let credentialCount: number | undefined;

  for (const deviceId of deviceIds) {
    const events = rawEvents.filter((e) => e.deviceId === deviceId);
    processDeviceEvents(events, accessEvents, systemEvents);

    for (const e of events) {
      if (e.module !== 'stats') continue;
      if (e.message.includes('Configured for')) {
        configuredAuthType = e.message.replace('Configured for ', '').trim();
      }
      const fwMatch = e.message.match(/Firmware ([\d.]+)/);
      if (fwMatch) firmware = fwMatch[1];
      const ipMatch = e.message.match(/IP address is ([\d.]+)/);
      if (ipMatch) ipAddress = ipMatch[1];
      const ssidMatch = e.message.match(/Network is via Wifi \(SSID\d+ \/ ([^)]+)\)/);
      if (ssidMatch) wifiSsid = ssidMatch[1];
      const rssiMatch = e.message.match(/Wifi signal strength is (-\d+)dBm/);
      if (rssiMatch) wifiSignalDbm = parseInt(rssiMatch[1]);
      const certMatch = e.message.match(/cert expires (\d{4}-\d{2}-\d{2})/);
      if (certMatch) certExpires = certMatch[1];
      const credMatch = e.message.match(/Local cache has (\d+) credentials/);
      if (credMatch) credentialCount = parseInt(credMatch[1]);
    }
  }

  return {
    accessEvents,
    systemEvents,
    deviceIds,
    configuredAuthType,
    firmware,
    ipAddress,
    wifiSsid,
    wifiSignalDbm,
    certExpires,
    credentialCount,
    lineCount: lines.length,
    rawEventCount: rawEvents.length,
  };
}

// ─── per-device processing ────────────────────────────────────────────────────

function processDeviceEvents(
  events: RawEvent[],
  accessEvents: AccessEvent[],
  systemEvents: SystemEvent[]
): void {
  const deviceId = events[0]?.deviceId;
  if (!deviceId) return;

  let sessionStart = -1;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const { module, message } = e;

    // ── SYSTEM EVENTS ────────────────────────────────────────────────────────

    if (module === 'MQTT') {
      if (/Disconnected|connection lost|transmission failed/i.test(message)) {
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_disconnect', module, details: message, raw_line: e.raw });
      } else if (/Connected successfully/i.test(message)) {
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_connect', module, details: message, raw_line: e.raw });
      } else if (/Missed more than/i.test(message)) {
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'watchdog_reconnect', module, details: message, raw_line: e.raw });
      }
      continue;
    }

    if (module === 'stats' && /------- BOOTED/.test(message)) {
      const lookahead = events.slice(i, Math.min(i + 6, events.length));
      const errorLine = lookahead.find((x) => /(\d+) error reboots/.test(x.message));
      const errorCount = errorLine ? parseInt(errorLine.message.match(/(\d+) error reboots/)![1]) : 0;
      const bootTypeLine = lookahead.find((x) => /Last boot was/.test(x.message));
      const rebootCountLine = lookahead.find((x) => /Rebooted (\d+) times/.test(x.message));
      systemEvents.push({
        device_id: deviceId,
        occurred_at: e.timestamp.toISOString(),
        event_type: errorCount > 0 ? 'reboot_error' : 'reboot_normal',
        module,
        details: [bootTypeLine?.message, rebootCountLine?.message].filter(Boolean).join(' | ') || message,
        raw_line: e.raw,
      });
      continue;
    }

    if (module === 'watchdog' && /Restarting/.test(message)) {
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'reboot_watchdog', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'stats' && /FIELD SUPPORT DATA/.test(message)) {
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'healthcheck', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'eventLog' && /FAILURE/.test(message)) {
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'hardware_error', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'config' && /Setting NVS config|Configuring|Received a config|Sending value for key/i.test(message)) {
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'config_change', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'sync' && /cloudSync|Processed a new/i.test(message)) {
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'cloud_sync', module, details: message, raw_line: e.raw });
      continue;
    }

    // ── ACCESS EVENTS ────────────────────────────────────────────────────────

    if (module === 'wiegand' && /card tapped on Door/i.test(message)) {
      if (sessionStart >= 0) {
        const danglingEvents = events.slice(sessionStart, i);
        const timeDiff = e.timestamp.getTime() - events[sessionStart].timestamp.getTime();
        if (timeDiff > 5000) {
          accessEvents.push({
            device_id: deviceId,
            occurred_at: events[sessionStart].timestamp.toISOString(),
            auth_type: detectAuthType(danglingEvents),
            result: 'failure',
            failure_reason: 'session_interrupted',
            ...extractCardInfo(danglingEvents),
          });
        }
      }
      sessionStart = i;
      continue;
    }

    if (module === 'crdHndlr' && /PIN digit/i.test(message) && sessionStart < 0) {
      sessionStart = i;
      continue;
    }

    if (module === 'doorRelay' && /Signal to unlock/i.test(message)) {
      const doorMatch = message.match(/door (\d+)/i);
      const doorId = doorMatch ? parseInt(doorMatch[1]) : 0;
      const sessionEvents = sessionStart >= 0 ? events.slice(sessionStart, i + 1) : [e];

      let doorOpenAt: string | undefined;
      let doorCloseAt: string | undefined;
      for (let j = i + 1; j < Math.min(i + 15, events.length); j++) {
        if (/Door \d+ was opened/i.test(events[j].message) && !doorOpenAt) doorOpenAt = events[j].timestamp.toISOString();
        if (/Door \d+ was closed/i.test(events[j].message)) { doorCloseAt = events[j].timestamp.toISOString(); break; }
      }

      const sfmEvent = sessionEvents.find((x) => x.module === 'SFM' && /match/i.test(x.message));
      const userIdMatch = sfmEvent?.message.match(/UserId (\d+)/);
      const cardEvent = sessionEvents.find((x) => x.module === 'wiegand');
      const cardBitsMatch = cardEvent?.message.match(/(\d+)-bit card/);

      accessEvents.push({
        device_id: deviceId,
        occurred_at: sessionEvents[0].timestamp.toISOString(),
        auth_type: detectAuthType(sessionEvents),
        result: 'success',
        user_id_raw: userIdMatch?.[1],
        card_bits: cardBitsMatch ? parseInt(cardBitsMatch[1]) : undefined,
        door_id: doorId,
        door_open_at: doorOpenAt,
        door_close_at: doorCloseAt,
        door_open_ms: doorOpenAt && doorCloseAt ? new Date(doorCloseAt).getTime() - new Date(doorOpenAt).getTime() : undefined,
      });
      sessionStart = -1;
      continue;
    }

    if (module === 'crdHndlr' && /denied|failed|timeout/i.test(message) && sessionStart >= 0) {
      const sessionEvents = events.slice(sessionStart, i + 1);
      accessEvents.push({
        device_id: deviceId,
        occurred_at: sessionEvents[0].timestamp.toISOString(),
        auth_type: detectAuthType(sessionEvents),
        result: 'failure',
        failure_reason: message,
        ...extractCardInfo(sessionEvents),
      });
      sessionStart = -1;
      continue;
    }
  }

  // Dangling session at end of file
  if (sessionStart >= 0) {
    const sessionEvents = events.slice(sessionStart);
    const lastEvent = events[events.length - 1];
    const timeDiff = lastEvent.timestamp.getTime() - events[sessionStart].timestamp.getTime();
    if (timeDiff > 30000) {
      accessEvents.push({
        device_id: deviceId,
        occurred_at: events[sessionStart].timestamp.toISOString(),
        auth_type: detectAuthType(sessionEvents),
        result: 'failure',
        failure_reason: 'no_resolution',
        ...extractCardInfo(sessionEvents),
      });
    }
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function detectAuthType(sessionEvents: RawEvent[]): HardwareAuthType {
  const has = (pred: (e: RawEvent) => boolean) => sessionEvents.some(pred);
  const hasCard = has((e) => e.module === 'wiegand' && /card tapped/i.test(e.message));
  const hasFingerprint = has((e) => e.module === 'SFM' && /match/i.test(e.message));
  const has1to1 = has((e) => e.module === 'crdHndlr' && /1:1 fingerprint/i.test(e.message));
  const hasPIN = has((e) => e.module === 'crdHndlr' && /PIN digit/i.test(e.message));
  const hasUserId = has((e) => e.module === 'crdHndlr' && /UserID entered/i.test(e.message));

  if (!hasCard && hasFingerprint) return 'Fingerprint Only';
  if (hasCard && hasFingerprint && hasPIN && hasUserId) return 'Card/User Id + Fingerprint (Pin Fallback)';
  if (hasCard && hasFingerprint && hasUserId) return 'Card/User Id/Fingerprint';
  if (hasCard && has1to1 && hasUserId) return 'Card/User Id + Fingerprint';
  if (hasCard && hasPIN && hasUserId) return 'Card/User Id + Pin';
  if (hasCard && hasPIN) return 'Card + Pin';
  return 'Card Only';
}

function extractCardInfo(sessionEvents: RawEvent[]): Pick<AccessEvent, 'user_id_raw' | 'card_bits'> {
  const sfmEvent = sessionEvents.find((x) => x.module === 'SFM' && /match/i.test(x.message));
  const userIdMatch = sfmEvent?.message.match(/UserId (\d+)/);
  const cardEvent = sessionEvents.find((x) => x.module === 'wiegand');
  const cardBitsMatch = cardEvent?.message.match(/(\d+)-bit card/);
  return {
    user_id_raw: userIdMatch?.[1],
    card_bits: cardBitsMatch ? parseInt(cardBitsMatch[1]) : undefined,
  };
}
