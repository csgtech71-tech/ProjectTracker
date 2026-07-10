import type { AccessEvent, SystemEvent, HardwareAuthType } from '../types';

// ─── types ────────────────────────────────────────────────────────────────────

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

// ─── format detection ─────────────────────────────────────────────────────────

const ANSI_RE = /\x1B\[[0-9;]*[a-zA-Z]/g;
const TXT_LINE_RE =
  /^(\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}):\s+\[([a-f0-9A-F]{12})\]\s+(info|warn|error)\s+\[([^\]]+)\]\s+(.+)$/;

function stripAnsi(s: string) { return s.replace(ANSI_RE, ''); }

function parseTxtTimestamp(ts: string): Date {
  const [date, time] = ts.split(' ');
  const [yy, mm, dd] = date.split('-');
  return new Date(`20${yy}-${mm}-${dd}T${time}`);
}

function isCsvFormat(text: string): boolean {
  const first = text.split(/\r?\n/)[0]?.toLowerCase() || '';
  return first.includes('enqueuedtimedevice') || (first.includes('_ts') && first.includes('message'));
}

// Extract device ID from CSV filename: "device-logs-08-b6-1f-b2-63-9c-2026-..." → "08b61fb2639c"
function deviceIdFromFilename(filename: string): string | null {
  const m = filename.match(/([0-9a-f]{2}(?:-[0-9a-f]{2}){5})/i);
  return m ? m[1].replace(/-/g, '').toLowerCase() : null;
}

// Infer module from message content (CSV has no [module] tag)
function inferModule(msg: string): string {
  // Access / auth
  if (/card tapped on Door/i.test(msg)) return 'wiegand';
  if (/Signal to unlock/i.test(msg)) return 'doorRelay';
  if (/Setting the GPIO signal to lock/i.test(msg)) return 'doorRelay';
  if (/Door \d+ was (opened|closed)/i.test(msg)) return 'doorSensor';
  if (/Verifying that door was|All sensor checks verified/i.test(msg)) return 'doorSensor';
  if (/PIN digit|PIN is correct|PIN timing|Prompting.*PIN|entered a PIN|No PIN:/i.test(msg)) return 'crdHndlr';
  if (/UserID entered|cloud authorized|authorized the card|local cache.*PIN|Uploading credentials/i.test(msg)) return 'crdHndlr';
  if (/1:1 fingerprint|authorized fingerprint|denied|timed out/i.test(msg)) return 'crdHndlr';
  if (/The user pressed \[/i.test(msg)) return 'crdHndlr';
  if (/This card is in our local cache/i.test(msg)) return 'crdHndlr';
  if (/configured for card-only|card-only mode/i.test(msg)) return 'crdHndlr';
  if (/Successful 1:N match/i.test(msg)) return 'SFM';
  if (/Error reading SFM|No SFM module|SFM not active/i.test(msg)) return 'SFM';
  if (/Cannot perform SFM_read/i.test(msg)) return 'SFM';
  // RFID
  if (/RFID module/i.test(msg)) return 'rfid';
  // Network / MQTT
  if (/No MQTT connection|running in off-line mode/i.test(msg)) return 'MQTT';
  if (/Disconnected from the MQTT|MQTT connection lost/i.test(msg)) return 'MQTT';
  if (/Connected successfully to MQTT|Connected to the MQTT Server/i.test(msg)) return 'MQTT';
  if (/Missed more than/i.test(msg)) return 'MQTT';
  if (/Restarting MQTT|MQTT startup task|Initializing new MQTT|mqttKeepalive/i.test(msg)) return 'MQTT';
  if (/MQTT_EVENT_SUBSCRIBED/i.test(msg)) return 'MQTT';
  if (/leaving state:.*azure|Timeout while acquiring UI semaphore/i.test(msg)) return 'MQTT';
  // Offline access events
  if (/authorized offline UserID scan|Authorized offline opening|Unexpected offline opening|Offline door open alert|closed offline at time/i.test(msg)) return 'offlineAccess';
  // Door held open
  if (/Safe buzzer sounding/i.test(msg)) return 'doorBuzzer';
  // MQTT backoff
  if (/Backing off for \d+ms/i.test(msg)) return 'MQTT';
  // Transmission failure
  if (/Transmission of log event failed/i.test(msg)) return 'MQTT';
  // Cancel/backspace key
  if (/User pressed \[X\]|User pressed \[<-\]/i.test(msg)) return 'crdHndlr';
  // Offline log markers
  if (/=== OFFLINE LOGS (START|END)/i.test(msg)) return 'offlineLog';
  // System / health
  if (/BOOTED|error reboots|Last boot was|Rebooted \d+ times/i.test(msg)) return 'stats';
  if (/Restarting/i.test(msg)) return 'watchdog';
  if (/FIELD SUPPORT DATA|Gathering tech support/i.test(msg)) return 'stats';
  if (/Firmware |IP address is|Network is via|Wifi signal|cert expires|Local cache has/i.test(msg)) return 'stats';
  if (/Booted \d+ seconds ago/i.test(msg)) return 'stats';
  if (/Heap memory is low/i.test(msg)) return 'health';
  if (/Minimum PIN length cannot be/i.test(msg)) return 'config';
  if (/FAILURE/i.test(msg)) return 'eventLog';
  // Device config (boot-time hardware/config messages)
  if (/Configured for cardPinMode|Skipping Facility Codes|Buzzer set for|Storage:|invertLED|flippedCabinet|doorEnabled|cabinetMode|LCD is present|X509 cert expires/i.test(msg)) return 'deviceConfig';
  // Config / sync
  if (/Setting NVS config|Configuring|Received a config|Sending value for key|rfidEnabled|Deleting config key/i.test(msg)) return 'config';
  if (/cloudSync|Processed a new cloudSync/i.test(msg)) return 'sync';
  if (/Skipping Device Sync/i.test(msg)) return 'sync';
  if (/Scan received/i.test(msg)) return 'scanner';
  return 'other';
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { fields.push(cur); cur = ''; }
    else cur += ch;
  }
  fields.push(cur);
  return fields;
}

function parseCsvText(text: string, filename: string): RawEvent[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const deviceId = deviceIdFromFilename(filename) || 'unknown';
  const cols = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/"/g, ''));
  const tsCol = cols.indexOf('enqueuedtimedevice');
  const levelCol = cols.indexOf('level');
  const msgCol = cols.indexOf('message');
  if (tsCol < 0 || levelCol < 0 || msgCol < 0) return [];

  const events: RawEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCsvLine(line);
    if (fields.length <= Math.max(tsCol, levelCol, msgCol)) continue;
    const ts = fields[tsCol]?.replace(/"/g, '').trim();
    const level = fields[levelCol]?.replace(/"/g, '').trim();
    const message = fields[msgCol]?.replace(/^"|"$/g, '').trim();
    if (!ts || !message) continue;
    const timestamp = new Date(ts);
    if (isNaN(timestamp.getTime())) continue;
    events.push({
      timestamp,
      deviceId,
      level: (['info','warn','error'].includes(level) ? level : 'info') as RawEvent['level'],
      module: inferModule(message),
      message,
      raw: line,
    });
  }
  // CSV comes newest-first — sort chronologically for session reconstruction
  return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

// ─── public entry point ───────────────────────────────────────────────────────

export function parseLogFile(text: string, filename?: string): ParseResult {
  const lines = text.split(/\r?\n/);
  let rawEvents: RawEvent[] = [];

  if (isCsvFormat(text)) {
    rawEvents = parseCsvText(text, filename || '');
  } else {
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

  const deviceIds = [...new Set(rawEvents.map(e => e.deviceId))];
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
    const events = rawEvents.filter(e => e.deviceId === deviceId);
    processDeviceEvents(events, accessEvents, systemEvents);

    for (const e of events) {
      if (e.module !== 'stats') continue;
      if (e.message.includes('Configured for')) configuredAuthType = e.message.replace('Configured for ', '').trim();
      const fwM = e.message.match(/Firmware ([\d.]+)/); if (fwM) firmware = fwM[1];
      const fwM2 = e.message.match(/Firmware ([\d.]+),/); if (fwM2) firmware = fwM2[1];
      const ipM = e.message.match(/IP address is ([\d.]+)/); if (ipM) ipAddress = ipM[1];
      const ssM = e.message.match(/Network is via Wifi \(SSID\d+ \/ ([^)]+)\)/); if (ssM) wifiSsid = ssM[1];
      const rsM = e.message.match(/Wifi signal strength is (-\d+)dBm/); if (rsM) wifiSignalDbm = parseInt(rsM[1]);
      const ceM = e.message.match(/cert expires (\d{4}-\d{2}-\d{2})/); if (ceM) certExpires = ceM[1];
      const ccM = e.message.match(/Local cache has (\d+) credentials/); if (ccM) credentialCount = parseInt(ccM[1]);
    }
  }

  return { accessEvents, systemEvents, deviceIds, configuredAuthType, firmware, ipAddress, wifiSsid, wifiSignalDbm, certExpires, credentialCount, lineCount: lines.length, rawEventCount: rawEvents.length };
}

// ─── per-device event processing ─────────────────────────────────────────────

function processDeviceEvents(
  events: RawEvent[],
  accessEvents: AccessEvent[],
  systemEvents: SystemEvent[]
): void {
  const deviceId = events[0]?.deviceId;
  if (!deviceId) return;

  const lastTs = events[events.length - 1]?.timestamp;
  let sessionStart = -1;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const { module, message } = e;

    // ── SYSTEM EVENTS ────────────────────────────────────────────────────────

    if (module === 'MQTT') {
      if (/Disconnected from the MQTT|MQTT connection lost/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_disconnect', module, details: message, raw_line: e.raw });
      else if (/Connected successfully to MQTT|Connected to the MQTT Server/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_connect', module, details: message, raw_line: e.raw });
      else if (/No MQTT connection|running in off-line mode/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_offline', module, details: message, raw_line: e.raw });
      else if (/Restarting MQTT|MQTT startup task|Initializing new MQTT/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_reconnect', module, details: message, raw_line: e.raw });
      else if (/Timeout while acquiring UI semaphore/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_timeout', module, details: message, raw_line: e.raw });
      else if (/MQTT connection lost|leaving state:/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_disconnect', module, details: message, raw_line: e.raw });
      else if (/Missed more than/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'watchdog_reconnect', module, details: message, raw_line: e.raw });
      else if (/Backing off for/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'mqtt_backoff', module, details: message, raw_line: e.raw });
      else if (/Transmission of log event failed/i.test(message))
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'transmission_failure', module, details: message, raw_line: e.raw });
      // MQTT_EVENT_SUBSCRIBED and mqttKeepalive are noise — skip
      continue;
    }

    if (module === 'stats' && /------- BOOTED/.test(message)) {
      const la = events.slice(i, Math.min(i + 6, events.length));
      const errLine = la.find(x => /(\d+) error reboots/.test(x.message));
      const errCount = errLine ? parseInt(errLine.message.match(/(\d+) error reboots/)![1]) : 0;
      const bootTypeLine = la.find(x => /Last boot was/.test(x.message));
      const rebootCountLine = la.find(x => /Rebooted (\d+) times/.test(x.message));
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: errCount > 0 ? 'reboot_error' : 'reboot_normal', module, details: [bootTypeLine?.message, rebootCountLine?.message].filter(Boolean).join(' | ') || message, raw_line: e.raw });
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

    if (module === 'config') {
      const evtType = /Minimum PIN length/i.test(message) ? 'config_warning' : 'config_change';
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: evtType, module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'deviceConfig') {
      // Boot-time hardware/config messages — group as device_config events
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'device_config', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'health') {
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'memory_warning', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'offlineLog') {
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'offline_log_marker', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'offlineAccess') {
      const isUnexpected = /Unexpected offline opening/i.test(message);
      const isAuthorizedScan = /authorized offline UserID scan/i.test(message);
      const isAuthorizedOpen = /Authorized offline opening/i.test(message);
      const isAlert = /Offline door open alert/i.test(message);
      const isClosed = /closed offline at time/i.test(message);
      const evtType = isUnexpected ? 'offline_unauthorized' :
                      isAuthorizedScan ? 'offline_access_scan' :
                      isAuthorizedOpen ? 'offline_access_open' :
                      isAlert ? 'offline_access_alert' :
                      isClosed ? 'offline_door_close' : 'offline_access';
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: evtType, module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'doorBuzzer') {
      const isAlarm = /doorHeldOpenAlarm/i.test(message);
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: isAlarm ? 'door_held_alarm' : 'door_held_warning', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'SFM' && /Cannot perform SFM_read/i.test(message)) {
      // Deduplicate SFM flood — only record first occurrence per boot
      const lastSfm = systemEvents.filter(ev => ev.event_type === 'sfm_error' && ev.device_id === deviceId).pop();
      if (!lastSfm || (new Date(e.timestamp).getTime() - new Date(lastSfm.occurred_at).getTime()) > 60000) {
        systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'sfm_error', module, details: 'SFM read errors (deduplicated)', raw_line: e.raw });
      }
      continue;
    }

    if (module === 'rfid') {
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: 'device_config', module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'SFM' && /Error reading SFM|No SFM module|SFM not active/i.test(message)) {
      const evtType = /Error reading/i.test(message) ? 'hardware_error' : 'device_config';
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: evtType, module, details: message, raw_line: e.raw });
      continue;
    }

    if (module === 'sync') {
      // Distinguish skipped syncs from actual syncs
      const evtType = /Skipping Device Sync/i.test(message) ? 'sync_skipped' : 'cloud_sync';
      systemEvents.push({ device_id: deviceId, occurred_at: e.timestamp.toISOString(), event_type: evtType, module, details: message, raw_line: e.raw });
      continue;
    }

    // ── ACCESS EVENTS ─────────────────────────────────────────────────────────

    // TXT: card tap starts session
    if (module === 'wiegand' && /card tapped on Door/i.test(message)) {
      if (sessionStart >= 0) {
        const dangling = events.slice(sessionStart, i);
        if (e.timestamp.getTime() - events[sessionStart].timestamp.getTime() > 5000) {
          accessEvents.push(buildIncompleteOrFailed(dangling, deviceId, lastTs));
        }
      }
      sessionStart = i;
      continue;
    }

    // CSV: first PIN digit (UID entry phase) starts session
    if (module === 'crdHndlr' && /The user entered a PIN digit/i.test(message) && sessionStart < 0) {
      sessionStart = i;
      continue;
    }

    // Also start on UserID entered if we somehow missed the first digit
    if (module === 'crdHndlr' && /UserID entered/i.test(message) && sessionStart < 0) {
      sessionStart = i;
      continue;
    }

    // Successful unlock — end of successful auth session
    if (module === 'doorRelay' && /Signal to unlock/i.test(message)) {
      const doorMatch = message.match(/door (\d+)/i);
      const doorId = doorMatch ? parseInt(doorMatch[1]) : 0;
      const sessionEvents = sessionStart >= 0 ? events.slice(sessionStart, i + 1) : [e];

      // Look ahead for door open then door close (skip sensor bounce — rapid close/open within 2s)
      let doorOpenAt: string | undefined;
      let doorCloseAt: string | undefined;
      for (let j = i + 1; j < Math.min(i + 30, events.length); j++) {
        const jMsg = events[j].message;
        // First real open
        if (/Door \d+ was opened/i.test(jMsg) && !doorOpenAt) {
          doorOpenAt = events[j].timestamp.toISOString();
        }
        // First close that happens >2s after open (ignore sensor bounce)
        if (/Door \d+ was closed/i.test(jMsg) && doorOpenAt) {
          const openTs = new Date(doorOpenAt).getTime();
          const closeTs = events[j].timestamp.getTime();
          if (closeTs - openTs > 2000) {
            doorCloseAt = events[j].timestamp.toISOString();
            break;
          }
        }
      }

      // Extract No PIN user ID if present
      const noPinEvent = sessionEvents.find(se => /^No PIN:/i.test(se.message));
      const noPinMatch = noPinEvent?.message.match(/No PIN:\s*(\d+)/i);

      accessEvents.push({
        device_id: deviceId,
        occurred_at: sessionEvents[0].timestamp.toISOString(),
        auth_type: detectAuthType(sessionEvents),
        result: 'success',
        user_id_raw: extractUserId(sessionEvents) || noPinMatch?.[1],
        card_bits: extractCardBits(sessionEvents),
        door_id: doorId,
        door_open_at: doorOpenAt,
        door_close_at: doorCloseAt,
        door_open_ms: doorOpenAt && doorCloseAt
          ? new Date(doorCloseAt).getTime() - new Date(doorOpenAt).getTime()
          : undefined,
      });
      sessionStart = -1;
      continue;
    }

    // Card-only device received PIN attempt — wrong auth method
    if (module === 'crdHndlr' && /configured for card-only/i.test(message)) {
      accessEvents.push({
        device_id: deviceId,
        occurred_at: e.timestamp.toISOString(),
        auth_type: 'Card Only',
        result: 'failure',
        failure_reason: 'Wrong auth method: device is card-only, PIN was attempted',
      });
      sessionStart = -1;
      continue;
    }

    // No PIN message — extract user ID for card-only access
    if (module === 'crdHndlr' && /^No PIN:/i.test(message) && sessionStart >= 0) {
      const idMatch = message.match(/No PIN:\s*(\d+)/i);
      if (idMatch) {
        // Store for use by the unlock event
        const sessionEvents = events.slice(sessionStart);
        sessionEvents.forEach(se => { (se as any)._noPinUserId = idMatch[1]; });
      }
      continue;
    }

    // Explicit denial or timeout
    if (module === 'crdHndlr' && /denied|failed|timeout/i.test(message) && sessionStart >= 0) {
      const sessionEvents = events.slice(sessionStart, i + 1);
      accessEvents.push({
        device_id: deviceId,
        occurred_at: sessionEvents[0].timestamp.toISOString(),
        auth_type: detectAuthType(sessionEvents),
        result: 'failure',
        failure_reason: message,
        user_id_raw: extractUserId(sessionEvents),
        card_bits: extractCardBits(sessionEvents),
      });
      sessionStart = -1;
      continue;
    }
  }

  // Dangling session at end of file
  if (sessionStart >= 0) {
    const sessionEvents = events.slice(sessionStart);
    accessEvents.push(buildIncompleteOrFailed(sessionEvents, deviceId, lastTs));
  }
}

// Decide whether a dangling session is 'incomplete' (cut off by log end) or 'failure' (timed out)
function buildIncompleteOrFailed(
  sessionEvents: RawEvent[],
  deviceId: string,
  logLastTs: Date | undefined
): AccessEvent {
  const sessionStart = sessionEvents[0].timestamp;
  const sessionLast = sessionEvents[sessionEvents.length - 1].timestamp;
  const logEnd = logLastTs ?? sessionLast;

  // If the session's last event is within 120s of the log's last timestamp,
  // it's likely cut off mid-flight — mark as incomplete
  const gapToLogEnd = logEnd.getTime() - sessionLast.getTime();
  const isIncomplete = gapToLogEnd < 120000;

  return {
    device_id: deviceId,
    occurred_at: sessionStart.toISOString(),
    auth_type: detectAuthType(sessionEvents),
    result: isIncomplete ? 'incomplete' : 'failure',
    failure_reason: isIncomplete ? 'log_truncated' : 'no_resolution',
    user_id_raw: extractUserId(sessionEvents),
    card_bits: extractCardBits(sessionEvents),
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function detectAuthType(se: RawEvent[]): HardwareAuthType {
  const has = (p: (e: RawEvent) => boolean) => se.some(p);
  const hasCard     = has(e => e.module === 'wiegand' && /card tapped/i.test(e.message));
  const hasUnknownCard = has(e => /unknown card from Door/i.test(e.message));
  const hasFP       = has(e => e.module === 'SFM' && /match/i.test(e.message));
  const has1to1     = has(e => e.module === 'crdHndlr' && /1:1 fingerprint/i.test(e.message));
  const hasPIN      = has(e => e.module === 'crdHndlr' && /PIN digit|entered a PIN|PIN is correct|PIN timing/i.test(e.message));
  const hasUserId   = has(e => e.module === 'crdHndlr' && /UserID entered/i.test(e.message));
  const hasCache    = has(e => /local cache.*PIN/i.test(e.message));
  // "No PIN: HEXID" = credential resolved on cardPinMode=0 device (PIN was the credential, no physical card)
  const hasNoPinId  = has(e => e.module === 'crdHndlr' && /^No PIN:/i.test(e.message));

  // Fingerprint combos
  if (!hasCard && hasFP) return 'Fingerprint Only';
  if (hasCard && hasFP && hasPIN && hasUserId) return 'Card/User Id + Fingerprint (Pin Fallback)';
  if (hasCard && hasFP && hasUserId) return 'Card/User Id/Fingerprint';
  if (hasCard && has1to1 && hasUserId) return 'Card/User Id + Fingerprint';

  // Card + PIN combos
  if (hasCard && hasPIN && hasUserId) return 'Card/User Id + Pin';
  if (hasCard && hasPIN) return 'Card + Pin';

  // Card only (any bit width, known or unknown card type)
  if (hasCard || hasUnknownCard) return 'Card Only';

  // PIN-only device (cardPinMode=0): user enters PIN digits, resolves to credential ID
  // "No PIN: HEXID" is the device's way of saying the credential resolved without a physical card
  if (hasPIN && hasNoPinId) return 'Pin Only';

  // CSV PIN-only flow with UserID (older firmware)
  if (!hasCard && hasPIN && (hasUserId || hasCache)) return 'Card/User Id + Pin';

  return 'Card + Pin';
}

function extractUserId(se: RawEvent[]): string | undefined {
  // PIN timing line carries the credential hex ID (e.g. "PIN timing: F7E104 [...]")
  const pinTiming = se.find(e => /PIN timing:/i.test(e.message));
  const pinMatch = pinTiming?.message.match(/PIN timing:\s+([A-F0-9]{4,8})\s*\[/i);
  if (pinMatch) return pinMatch[1];
  // TXT format: SFM match carries numeric UserId
  const sfm = se.find(e => e.module === 'SFM' && /match/i.test(e.message));
  const sfmMatch = sfm?.message.match(/UserId (\d+)/);
  return sfmMatch?.[1];
}

function extractCardBits(se: RawEvent[]): number | undefined {
  const card = se.find(e => e.module === 'wiegand');
  const m = card?.message.match(/(\d+)-bit card/);
  return m ? parseInt(m[1]) : undefined;
}
