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

// ─── parsing ─────────────────────────────────────────────────────────────────

const ANSI_RE = /\x1B\[[0-9;]*[a-zA-Z]/g;
// Format: YY-MM-DD HH:MM:SS: [deviceid] level  [module] message
const LINE_RE =
  /^(\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}):\s+\[([a-f0-9A-F]{12})\]\s+(info|warn|error)\s+\[([^\]]+)\]\s+(.+)$/;

function parseTimestamp(ts: string): Date {
  const [date, time] = ts.split(' ');
  const [yy, mm, dd] = date.split('-');
  return new Date(`20${yy}-${mm}-${dd}T${time}`);
}

function stripAnsi(line: string): string {
  return line.replace(ANSI_RE, '');
}

export function parseLogFile(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const rawEvents: RawEvent[] = [];

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const cleaned = stripAnsi(rawLine);
    const m = cleaned.match(LINE_RE);
    if (!m) continue;
    rawEvents.push({
      timestamp: parseTimestamp(m[1]),
      deviceId: m[2].toLowerCase(),
      level: m[3] as RawEvent['level'],
      module: m[4],
      message: m[5].trim(),
      raw: cleaned,
    });
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

    // Extract device metadata from boot stats
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

// ─── per-device processing ───────────────────────────────────────────────────

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

    // ── SYSTEM EVENTS ──────────────────────────────────────────────────────

    if (module === 'MQTT') {
      if (/Disconnected|connection lost|transmission failed/i.test(message)) {
        const accountMatch = message.match(/accountId (\d+)/);
        systemEvents.push({
          device_id: deviceId,
          occurred_at: e.timestamp.toISOString(),
          event_type: 'mqtt_disconnect',
          module,
          details: message,
          raw_line: e.raw,
        });
      } else if (/Connected successfully/i.test(message)) {
        systemEvents.push({
          device_id: deviceId,
          occurred_at: e.timestamp.toISOString(),
          event_type: 'mqtt_connect',
          module,
          details: message,
          raw_line: e.raw,
        });
      } else if (/Missed more than/i.test(message)) {
        systemEvents.push({
          device_id: deviceId,
          occurred_at: e.timestamp.toISOString(),
          event_type: 'watchdog_reconnect',
          module,
          details: message,
          raw_line: e.raw,
        });
      }
      continue;
    }

    if (module === 'stats' && /------- BOOTED/.test(message)) {
      // Look ahead a few lines for reboot context
      const lookahead = events.slice(i, Math.min(i + 6, events.length));
      const errorLine = lookahead.find((x) => /(\d+) error reboots/.test(x.message));
      const errorCount = errorLine
        ? parseInt(errorLine.message.match(/(\d+) error reboots/)![1])
        : 0;
      const bootTypeLine = lookahead.find((x) => /Last boot was/.test(x.message));
      const rebootCountLine = lookahead.find((x) => /Rebooted (\d+) times/.test(x.message));
      systemEvents.push({
        device_id: deviceId,
        occurred_at: e.timestamp.toISOString(),
        event_type: errorCount > 0 ? 'reboot_error' : 'reboot_normal',
        module,
        details: [bootTypeLine?.message, rebootCountLine?.message]
          .filter(Boolean)
          .join(' | ') || message,
        raw_line: e.raw,
      });
      continue;
    }

    if (module === 'watchdog' && /Restarting/.test(message)) {
      systemEvents.push({
        device_id: deviceId,
        occurred_at: e.timestamp.toISOString(),
        event_type: 'reboot_watchdog',
        module,
        details: message,
        raw_line: e.raw,
      });
      continue;
    }

    if (module === 'stats' && /FIELD SUPPORT DATA/.test(message)) {
      systemEvents.push({
        device_id: deviceId,
        occurred_at: e.timestamp.toISOString(),
        event_type: 'healthcheck',
        module,
        details: message,
        raw_line: e.raw,
      });
      continue;
    }

    if (module === 'eventLog' && /FAILURE/.test(message)) {
      systemEvents.push({
        device_id: deviceId,
        occurred_at: e.timestamp.toISOString(),
        event_type: 'hardware_error',
        module,
        details: message,
        raw_line: e.raw,
      });
      continue;
    }

    if (module === 'config' && /Setting NVS config|Configuring/.test(message)) {
      systemEvents.push({
        device_id: deviceId,
        occurred_at: e.timestamp.toISOString(),
        event_type: 'config_change',
        module,
        details: message,
        raw_line: e.raw,
      });
      continue;
    }

    // ── ACCESS EVENTS ──────────────────────────────────────────────────────

    // Card tap — always starts a new auth session
    if (module === 'wiegand' && /card tapped on Door/i.test(message)) {
      // If we had a dangling session, close it as failed
      if (sessionStart >= 0) {
        const danglingEvents = events.slice(sessionStart, i);
        const timeDiff =
          e.timestamp.getTime() - events[sessionStart].timestamp.getTime();
        if (timeDiff > 5000) {
          // Only count as failed if not just a micro-gap
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

    // PIN digit — may start a session if no card tap preceded
    if (
      module === 'crdHndlr' &&
      /entered a PIN digit/i.test(message) &&
      sessionStart < 0
    ) {
      sessionStart = i;
      continue;
    }

    // Successful unlock = end of a successful auth session
    if (module === 'doorRelay' && /Signal to unlock/i.test(message)) {
      const doorMatch = message.match(/door (\d+)/i);
      const doorId = doorMatch ? parseInt(doorMatch[1]) : 0;

      const sessionEvents =
        sessionStart >= 0 ? events.slice(sessionStart, i + 1) : [e];

      // Look ahead for door open/close (up to 15 events)
      let doorOpenAt: string | undefined;
      let doorCloseAt: string | undefined;
      for (let j = i + 1; j < Math.min(i + 15, events.length); j++) {
        if (
          /Door \d+ was opened/i.test(events[j].message) &&
          !doorOpenAt
        ) {
          doorOpenAt = events[j].timestamp.toISOString();
        }
        if (/Door \d+ was closed/i.test(events[j].message)) {
          doorCloseAt = events[j].timestamp.toISOString();
          break;
        }
      }

      const sfmEvent = sessionEvents.find(
        (x) => x.module === 'SFM' && /match/i.test(x.message)
      );
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
        door_open_ms:
          doorOpenAt && doorCloseAt
            ? new Date(doorCloseAt).getTime() - new Date(doorOpenAt).getTime()
            : undefined,
      });

      sessionStart = -1;
      continue;
    }

    // Explicit denial or timeout
    if (
      module === 'crdHndlr' &&
      /denied|failed|timeout/i.test(message) &&
      sessionStart >= 0
    ) {
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
    const timeDiff =
      lastEvent.timestamp.getTime() - events[sessionStart].timestamp.getTime();
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

// ─── helpers ─────────────────────────────────────────────────────────────────

function detectAuthType(sessionEvents: RawEvent[]): HardwareAuthType {
  const has = (pred: (e: RawEvent) => boolean) => sessionEvents.some(pred);

  const hasCard = has(
    (e) => e.module === 'wiegand' && /card tapped/i.test(e.message)
  );
  const hasFingerprint = has(
    (e) => e.module === 'SFM' && /match/i.test(e.message)
  );
  const has1to1 = has(
    (e) => e.module === 'crdHndlr' && /1:1 fingerprint/i.test(e.message)
  );
  const hasPIN = has(
    (e) => e.module === 'crdHndlr' && /PIN digit/i.test(e.message)
  );
  const hasUserId = has(
    (e) => e.module === 'crdHndlr' && /UserID entered/i.test(e.message)
  );

  if (!hasCard && hasFingerprint) return 'Fingerprint Only';
  if (hasCard && hasFingerprint && hasPIN && hasUserId)
    return 'Card/User Id + Fingerprint (Pin Fallback)';
  if (hasCard && hasFingerprint && hasUserId) return 'Card/User Id/Fingerprint';
  if (hasCard && has1to1 && hasUserId) return 'Card/User Id + Fingerprint';
  if (hasCard && hasPIN && hasUserId) return 'Card/User Id + Pin';
  if (hasCard && hasPIN) return 'Card + Pin';
  return 'Card Only';
}

function extractCardInfo(
  sessionEvents: RawEvent[]
): Pick<AccessEvent, 'user_id_raw' | 'card_bits'> {
  const sfmEvent = sessionEvents.find(
    (x) => x.module === 'SFM' && /match/i.test(x.message)
  );
  const userIdMatch = sfmEvent?.message.match(/UserId (\d+)/);
  const cardEvent = sessionEvents.find((x) => x.module === 'wiegand');
  const cardBitsMatch = cardEvent?.message.match(/(\d+)-bit card/);
  return {
    user_id_raw: userIdMatch?.[1],
    card_bits: cardBitsMatch ? parseInt(cardBitsMatch[1]) : undefined,
  };
}
