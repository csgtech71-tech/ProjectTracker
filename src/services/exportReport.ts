import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AccessEvent, SystemEvent, GlobalSettings } from '../types';

// ─── colour palette ───────────────────────────────────────────────────────────
const C = {
  black:      [15,  15,  15]  as [number,number,number],
  brand:      [209, 41,  19]  as [number,number,number],
  brandLight: [253, 232, 229] as [number,number,number],
  white:      [255, 255, 255] as [number,number,number],
  slate50:    [248, 250, 252] as [number,number,number],
  slate100:   [241, 245, 249] as [number,number,number],
  slate300:   [203, 213, 225] as [number,number,number],
  slate400:   [148, 163, 184] as [number,number,number],
  slate600:   [71,  85,  105] as [number,number,number],
  slate700:   [51,  65,  85]  as [number,number,number],
  slate900:   [15,  23,  42]  as [number,number,number],
  emerald:    [16,  185, 129] as [number,number,number],
  red:        [239, 68,  68]  as [number,number,number],
  amber:      [245, 158, 11]  as [number,number,number],
  blue:       [59,  130, 246] as [number,number,number],
};

const AUTH_COLORS: Record<string, [number,number,number]> = {
  'Card Only':                                  [59, 130, 246],
  'Card + Pin':                                 [139, 92, 246],
  'Card/User Id/Fingerprint':                   [16, 185, 129],
  'Card/User Id + Pin':                         [245, 158, 11],
  'Card/User Id + Fingerprint':                 [6, 182, 212],
  'Card/User Id + Fingerprint (Pin Fallback)':  [209, 41, 19],
  'Fingerprint Only':                           [236, 72, 153],
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
}

function fmtDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function groupByDay(events: AccessEvent[]) {
  const map: Record<string, { date: string; success: number; failure: number }> = {};
  for (const e of events) {
    const day = e.occurred_at.slice(0, 10);
    if (!map[day]) map[day] = { date: day, success: 0, failure: 0 };
    if (e.result === 'success') map[day].success++;
    else map[day].failure++;
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

// Draw a filled rounded rectangle (jsPDF doesn't have native roundedRect fill in all versions)
function roundRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, color: [number,number,number]) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

// Draw a mini bar chart inline
function drawBarChart(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  data: { date: string; success: number; failure: number }[]
) {
  if (data.length === 0) return;
  const max = Math.max(...data.map(d => d.success + d.failure), 1);
  const barW = Math.max(2, (w - data.length) / data.length);
  const gap = (w - barW * data.length) / Math.max(data.length - 1, 1);

  // Grid lines
  doc.setDrawColor(...C.slate100);
  doc.setLineWidth(0.3);
  for (let i = 0; i <= 4; i++) {
    const gy = y + h - (h * i / 4);
    doc.line(x, gy, x + w, gy);
  }

  data.forEach((d, i) => {
    const bx = x + i * (barW + gap);
    const totalH = (d.success + d.failure) / max * h;
    const successH = (d.success / max) * h;
    const failH = totalH - successH;

    if (failH > 0) {
      doc.setFillColor(...C.red);
      doc.rect(bx, y + h - totalH, barW, failH, 'F');
    }
    if (successH > 0) {
      doc.setFillColor(...C.emerald);
      doc.rect(bx, y + h - successH, barW, successH, 'F');
    }
  });
}

// Draw a mini donut/pie chart
function drawPieChart(
  doc: jsPDF,
  cx: number, cy: number, r: number,
  data: { name: string; value: number }[]
) {
  if (data.length === 0) return;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;
  data.forEach(d => {
    const slice = (d.value / total) * Math.PI * 2;
    const endAngle = startAngle + slice;
    const color = AUTH_COLORS[d.name] || C.slate300;

    // Draw filled sector
    doc.setFillColor(...color);
    const path: number[][] = [[cx, cy]];
    const steps = Math.max(8, Math.floor(slice * 20));
    for (let s = 0; s <= steps; s++) {
      const angle = startAngle + (slice * s) / steps;
      path.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }
    path.push([cx, cy]);

    // Use lines to approximate the sector
    doc.setDrawColor(...color);
    doc.setLineWidth(0);
    // Draw as filled polygon approximation
    if (path.length > 2) {
      const pathStr = path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ') + ' Z';
      (doc as any).path(pathStr, 'F');
    }

    startAngle = endAngle;
  });

  // White donut hole
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r * 0.55, 'F');
}

// ─── page layout helpers ──────────────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;

function addHeader(doc: jsPDF, settings: GlobalSettings, pageNum: number, totalPages: number) {
  // Top bar
  doc.setFillColor(...C.black);
  doc.rect(0, 0, PAGE_W, 14, 'F');

  // Company name in header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text((settings.companyName || 'MedixSafe').toUpperCase(), MARGIN, 9);

  // Page number right-aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.slate400);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W - MARGIN, 9, { align: 'right' });

  // Brand accent line
  doc.setFillColor(...C.brand);
  doc.rect(0, 14, PAGE_W, 1.2, 'F');
}

function addFooter(doc: jsPDF, settings: GlobalSettings) {
  doc.setFillColor(...C.slate50);
  doc.rect(0, PAGE_H - 10, PAGE_W, 10, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...C.slate400);
  doc.text(
    `Generated ${new Date().toLocaleString()} · ${settings.companyName || 'MedixSafe'} OPS · Confidential`,
    PAGE_W / 2, PAGE_H - 4.5, { align: 'center' }
  );
}

function addSectionHeader(doc: jsPDF, y: number, title: string): number {
  roundRect(doc, MARGIN, y, CONTENT_W, 8, 1.5, C.slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text(title.toUpperCase(), MARGIN + 5, y + 5.2);
  return y + 12;
}

function checkPage(doc: jsPDF, y: number, needed: number, settings: GlobalSettings, pageNums: { current: number; total: number }): number {
  if (y + needed > PAGE_H - 16) {
    addFooter(doc, settings);
    doc.addPage();
    pageNums.current++;
    addHeader(doc, settings, pageNums.current, pageNums.total);
    return 22;
  }
  return y;
}

// ─── public export function ───────────────────────────────────────────────────

export interface ExportData {
  accessEvents: AccessEvent[];
  systemEvents: SystemEvent[];
  devices: { id: string; friendlyName: string; firmware?: string; ipAddress?: string; wifiSsid?: string }[];
  filenames: string[];
  settings: GlobalSettings;
  analystName: string;
  reportTitle: string;
  notes: string;
}

export function exportPDF(data: ExportData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { accessEvents, systemEvents, devices, settings } = data;

  const deviceName = (id: string) => {
    const d = devices.find(d => d.id === id);
    return d?.friendlyName || id.slice(0, 8) + '…';
  };

  // ── Compute analytics ──────────────────────────────────────────────────────
  const total = accessEvents.length;
  const successes = accessEvents.filter(e => e.result === 'success').length;
  const failures = accessEvents.filter(e => e.result === 'failure').length;
  const successRate = total > 0 ? ((successes / total) * 100).toFixed(1) : '0';

  const durations = accessEvents.filter(e => e.door_open_ms && e.door_open_ms > 0).map(e => e.door_open_ms!);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

  const uniqueUsers = new Set(accessEvents.filter(e => e.user_id_raw).map(e => e.user_id_raw)).size;

  const methodCounts: Record<string, number> = {};
  for (const e of accessEvents) {
    const key = e.auth_type || 'Unknown';
    methodCounts[key] = (methodCounts[key] || 0) + 1;
  }
  const methodData = Object.entries(methodCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const timeline = groupByDay(accessEvents);

  const userMap: Record<string, { userId: string; total: number; success: number; failure: number; lastSeen: string }> = {};
  for (const e of accessEvents) {
    const uid = e.user_id_raw || 'Unknown';
    if (!userMap[uid]) userMap[uid] = { userId: uid, total: 0, success: 0, failure: 0, lastSeen: e.occurred_at };
    userMap[uid].total++;
    if (e.result === 'success') userMap[uid].success++;
    else userMap[uid].failure++;
    if (e.occurred_at > userMap[uid].lastSeen) userMap[uid].lastSeen = e.occurred_at;
  }
  const userActivity = Object.values(userMap).sort((a, b) => b.total - a.total);

  const reboots = systemEvents.filter(e => e.event_type.startsWith('reboot'));
  const errorReboots = reboots.filter(e => e.event_type === 'reboot_error');
  const mqttDrops = systemEvents.filter(e => e.event_type === 'mqtt_disconnect');

  const dateRange = accessEvents.length > 0 ? {
    start: accessEvents.map(e => e.occurred_at).sort()[0],
    end: accessEvents.map(e => e.occurred_at).sort().reverse()[0],
  } : null;

  // ── Estimate pages (rough) ─────────────────────────────────────────────────
  const estimatedPages = 3 + Math.ceil(userActivity.length / 25) + (failures > 0 ? Math.ceil(failures / 25) : 0);
  const pageNums = { current: 1, total: estimatedPages };

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ════════════════════════════════════════════════════════════════════════════

  // Full black cover header
  doc.setFillColor(...C.black);
  doc.rect(0, 0, PAGE_W, 80, 'F');

  // Brand stripe
  doc.setFillColor(...C.brand);
  doc.rect(0, 80, PAGE_W, 3, 'F');

  // Company logo placeholder / text
  if (settings.companyLogoBase64) {
    try {
      doc.addImage(settings.companyLogoBase64, 'PNG', MARGIN, 14, 40, 20, undefined, 'FAST');
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...C.white);
      doc.text((settings.companyName || 'MedixSafe').toUpperCase(), MARGIN, 28);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...C.brand);
    doc.text(settings.companyName || 'MedixSafe', MARGIN, 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.slate400);
    doc.text('HARDWARE OPERATIONS', MARGIN, 32);
  }

  // Report title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...C.white);
  const titleLines = doc.splitTextToSize(data.reportTitle || 'Device Access & Analytics Report', CONTENT_W);
  doc.text(titleLines, MARGIN, 52);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.slate400);
  doc.text('CONFIDENTIAL — For Authorized Recipients Only', MARGIN, 72);

  // Meta block below the stripe
  let y = 94;

  // Two-column meta
  const metaLeft = [
    ['Report Generated', new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })],
    ['Prepared By', data.analystName || 'MedixSafe Engineering'],
    ['Log Files', data.filenames.length.toString()],
  ];
  const metaRight = [
    ['Date Range', dateRange ? `${fmtDateShort(dateRange.start)} — ${fmtDateShort(dateRange.end)}` : 'N/A'],
    ['Total Events', total.toLocaleString()],
    ['Devices Analyzed', devices.length.toString()],
  ];

  const colW = CONTENT_W / 2 - 4;

  metaLeft.forEach(([label, value], i) => {
    roundRect(doc, MARGIN, y + i * 12, colW, 10, 1.5, C.slate50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.slate400);
    doc.text(label.toUpperCase(), MARGIN + 4, y + i * 12 + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.slate900);
    doc.text(value, MARGIN + 4, y + i * 12 + 9);
  });

  metaRight.forEach(([label, value], i) => {
    const rx = MARGIN + colW + 8;
    roundRect(doc, rx, y + i * 12, colW, 10, 1.5, C.slate50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.slate400);
    doc.text(label.toUpperCase(), rx + 4, y + i * 12 + 4.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...C.slate900);
    doc.text(value, rx + 4, y + i * 12 + 9);
  });

  y += metaLeft.length * 12 + 10;

  // Notes
  if (data.notes.trim()) {
    roundRect(doc, MARGIN, y, CONTENT_W, 24, 2, C.slate50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.brand);
    doc.text('REPORT NOTES', MARGIN + 5, y + 5.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.slate700);
    const noteLines = doc.splitTextToSize(data.notes, CONTENT_W - 10);
    doc.text(noteLines.slice(0, 2), MARGIN + 5, y + 12);
    y += 30;
  }

  // ── KPI summary cards ──────────────────────────────────────────────────────
  y += 4;
  const kpiW = (CONTENT_W - 9) / 4;
  const kpis = [
    { label: 'Total Entries', value: total.toLocaleString(), sub: 'access events', color: C.black },
    { label: 'Success Rate', value: `${successRate}%`, sub: `${successes} granted`, color: C.emerald },
    { label: 'Failed Attempts', value: failures.toLocaleString(), sub: failures > 0 ? 'review required' : 'none detected', color: failures > 0 ? C.red : C.slate300 },
    { label: 'Unique Users', value: uniqueUsers.toLocaleString(), sub: 'by credential ID', color: C.blue },
  ];

  kpis.forEach((kpi, i) => {
    const kx = MARGIN + i * (kpiW + 3);
    roundRect(doc, kx, y, kpiW, 28, 2, C.white);
    doc.setDrawColor(...C.slate100);
    doc.setLineWidth(0.3);
    doc.roundedRect(kx, y, kpiW, 28, 2, 2, 'S');

    // Color top accent
    doc.setFillColor(...kpi.color);
    doc.roundedRect(kx, y, kpiW, 2, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...C.slate400);
    doc.text(kpi.label.toUpperCase(), kx + 4, y + 8.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.slate900);
    doc.text(kpi.value, kx + 4, y + 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...C.slate400);
    doc.text(kpi.sub, kx + 4, y + 25.5);
  });

  y += 34;

  // ── Device list on cover ───────────────────────────────────────────────────
  if (devices.length > 0) {
    y = addSectionHeader(doc, y, 'Analyzed Devices');
    devices.forEach((d, i) => {
      const dy = y + i * 9;
      if (i % 2 === 0) {
        roundRect(doc, MARGIN, dy, CONTENT_W, 8.5, 1, C.slate50);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.slate900);
      doc.text(d.friendlyName || 'Unnamed Device', MARGIN + 4, dy + 5.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.slate400);
      doc.text(d.id, MARGIN + 60, dy + 5.5);

      if (d.firmware) doc.text(`FW ${d.firmware}`, MARGIN + 120, dy + 5.5);
      if (d.ipAddress) doc.text(d.ipAddress, MARGIN + 152, dy + 5.5);
    });
    y += devices.length * 9 + 6;
  }

  addFooter(doc, settings);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 2 — ACCESS ANALYTICS
  // ════════════════════════════════════════════════════════════════════════════

  doc.addPage();
  pageNums.current = 2;
  addHeader(doc, settings, pageNums.current, pageNums.total);
  y = 22;

  // Page title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...C.slate900);
  doc.text('Access Analytics', MARGIN, y);
  y += 10;

  // ── Timeline chart ─────────────────────────────────────────────────────────
  if (timeline.length > 0) {
    y = addSectionHeader(doc, y, 'Daily Access Timeline');
    const chartH = 48;
    roundRect(doc, MARGIN, y, CONTENT_W, chartH + 10, 2, C.white);
    doc.setDrawColor(...C.slate100);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, chartH + 10, 2, 2, 'S');

    drawBarChart(doc, MARGIN + 6, y + 4, CONTENT_W - 12, chartH, timeline);

    // X-axis labels (show every Nth)
    const step = Math.max(1, Math.floor(timeline.length / 8));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...C.slate400);
    const barW = (CONTENT_W - 12) / timeline.length;
    timeline.forEach((d, i) => {
      if (i % step === 0) {
        doc.text(d.date.slice(5), MARGIN + 6 + i * barW, y + chartH + 9);
      }
    });

    // Legend
    const legY = y + chartH + 4;
    doc.setFillColor(...C.emerald);
    doc.rect(CONTENT_W - 28, legY - 2.5, 4, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...C.slate600);
    doc.text('Success', CONTENT_W - 22, legY);
    doc.setFillColor(...C.red);
    doc.rect(CONTENT_W - 4, legY - 2.5, 4, 3, 'F');
    doc.text('Failure', CONTENT_W + 2, legY);

    y += chartH + 16;
  }

  // ── Auth Method Breakdown ──────────────────────────────────────────────────
  if (methodData.length > 0) {
    y = checkPage(doc, y, 60, settings, pageNums);
    y = addSectionHeader(doc, y, 'Authentication Method Distribution');

    const chartBoxH = 52;
    roundRect(doc, MARGIN, y, CONTENT_W, chartBoxH, 2, C.white);
    doc.setDrawColor(...C.slate100);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, CONTENT_W, chartBoxH, 2, 2, 'S');

    // Left: pie chart
    const pieR = 20;
    const pieCX = MARGIN + 28;
    const pieCY = y + chartBoxH / 2;
    drawPieChart(doc, pieCX, pieCY, pieR, methodData);

    // Right: legend table
    let lx = MARGIN + 62;
    let ly = y + 6;
    const colCount = methodData.length > 4 ? 2 : 1;
    const half = Math.ceil(methodData.length / colCount);

    methodData.forEach((d, i) => {
      const col = Math.floor(i / half);
      const row = i % half;
      const mx = lx + col * 82;
      const my = ly + row * 8.5;

      const color = AUTH_COLORS[d.name] || C.slate300;
      doc.setFillColor(...color);
      doc.roundedRect(mx, my, 3, 3, 0.5, 0.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.slate700);
      doc.text(d.name, mx + 5, my + 2.8);

      const pct = ((d.value / total) * 100).toFixed(1);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...C.slate400);
      doc.text(`${d.value} events (${pct}%)`, mx + 5, my + 7);
    });

    y += chartBoxH + 8;
  }

  addFooter(doc, settings);

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 3 — USER ACTIVITY & FAILURES
  // ════════════════════════════════════════════════════════════════════════════

  doc.addPage();
  pageNums.current = 3;
  addHeader(doc, settings, pageNums.current, pageNums.total);
  y = 22;

  // User Activity Table
  if (userActivity.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.slate900);
    doc.text('User Activity', MARGIN, y);
    y += 10;

    y = addSectionHeader(doc, y, `Credential Activity — ${userActivity.length} Users`);

    autoTable(doc, {
      startY: y,
      head: [['User ID', 'Total Access', 'Successful', 'Failed', 'Success Rate', 'Last Seen']],
      body: userActivity.map(u => [
        u.userId,
        u.total.toString(),
        u.success.toString(),
        u.failure.toString(),
        `${((u.success / u.total) * 100).toFixed(0)}%`,
        fmtDate(u.lastSeen),
      ]),
      styles: {
        fontSize: 7,
        cellPadding: 3,
        font: 'helvetica',
        textColor: [...C.slate700] as [number,number,number],
        lineColor: [...C.slate100] as [number,number,number],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [...C.slate900] as [number,number,number],
        textColor: [...C.white] as [number,number,number],
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: [...C.slate50] as [number,number,number],
      },
      columnStyles: {
        0: { font: 'courier', fontStyle: 'normal', cellWidth: 38 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 22, textColor: [...C.emerald] as [number,number,number] },
        3: { halign: 'center', cellWidth: 18, textColor: [...C.red] as [number,number,number] },
        4: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
        5: { cellWidth: 38 },
      },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => {
        addHeader(doc, settings, ++pageNums.current, pageNums.total);
        addFooter(doc, settings);
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Failed Attempts Table
  const failedEvents = accessEvents.filter(e => e.result === 'failure');
  if (failedEvents.length > 0) {
    y = checkPage(doc, y, 30, settings, pageNums);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.slate900);
    doc.text('Failed Access Attempts', MARGIN, y);
    y += 10;

    // Warning banner
    roundRect(doc, MARGIN, y, CONTENT_W, 10, 2, [253, 232, 229]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.brand);
    doc.text(`⚠  ${failedEvents.length} failed access attempt${failedEvents.length !== 1 ? 's' : ''} detected in this log period.`, MARGIN + 5, y + 6.5);
    y += 14;

    y = addSectionHeader(doc, y, 'Failed Attempt Detail');

    autoTable(doc, {
      startY: y,
      head: [['Timestamp', 'Device', 'Auth Method', 'User ID', 'Reason']],
      body: failedEvents.slice(0, 200).map(e => [
        fmtDate(e.occurred_at),
        deviceName(e.device_id),
        e.auth_type || '—',
        e.user_id_raw || '—',
        e.failure_reason || '—',
      ]),
      styles: {
        fontSize: 6.5,
        cellPadding: 2.5,
        font: 'helvetica',
        textColor: [...C.slate700] as [number,number,number],
        lineColor: [...C.slate100] as [number,number,number],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: [...C.brand] as [number,number,number],
        textColor: [...C.white] as [number,number,number],
        fontStyle: 'bold',
        fontSize: 6.5,
        cellPadding: 3.5,
      },
      alternateRowStyles: {
        fillColor: [255, 248, 247] as [number,number,number],
      },
      columnStyles: {
        0: { cellWidth: 36, font: 'courier' },
        1: { cellWidth: 32 },
        2: { cellWidth: 42 },
        3: { cellWidth: 22, font: 'courier' },
        4: { cellWidth: 46 },
      },
      margin: { left: MARGIN, right: MARGIN },
      didDrawPage: () => {
        addHeader(doc, settings, ++pageNums.current, pageNums.total);
        addFooter(doc, settings);
      },
    });

    if (failedEvents.length > 200) {
      y = (doc as any).lastAutoTable.finalY + 4;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.slate400);
      doc.text(`Showing first 200 of ${failedEvents.length} failures. Export CSV for complete dataset.`, MARGIN, y);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SYSTEM / NETWORK PAGE (if applicable)
  // ════════════════════════════════════════════════════════════════════════════

  if (reboots.length > 0 || mqttDrops.length > 0) {
    doc.addPage();
    pageNums.current++;
    addHeader(doc, settings, pageNums.current, pageNums.total);
    y = 22;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.slate900);
    doc.text('System & Network Events', MARGIN, y);
    y += 10;

    if (reboots.length > 0) {
      y = addSectionHeader(doc, y, `Device Reboots — ${reboots.length} total, ${errorReboots.length} error-triggered`);

      if (errorReboots.length > 0) {
        roundRect(doc, MARGIN, y, CONTENT_W, 10, 2, [253, 232, 229]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...C.brand);
        doc.text(`⚠  ${errorReboots.length} error-triggered reboot${errorReboots.length !== 1 ? 's' : ''} detected — hardware review recommended.`, MARGIN + 5, y + 6.5);
        y += 14;
      }

      autoTable(doc, {
        startY: y,
        head: [['Timestamp', 'Device', 'Type', 'Details']],
        body: reboots.map(e => [
          fmtDate(e.occurred_at),
          deviceName(e.device_id),
          e.event_type.replace('reboot_', '').toUpperCase(),
          e.details,
        ]),
        styles: { fontSize: 6.5, cellPadding: 2.5, font: 'helvetica', textColor: [...C.slate700] as [number,number,number], lineColor: [...C.slate100] as [number,number,number], lineWidth: 0.3 },
        headStyles: { fillColor: [...C.slate900] as [number,number,number], textColor: [...C.white] as [number,number,number], fontStyle: 'bold', fontSize: 6.5, cellPadding: 3.5 },
        alternateRowStyles: { fillColor: [...C.slate50] as [number,number,number] },
        columnStyles: {
          0: { cellWidth: 36, font: 'courier' },
          1: { cellWidth: 32 },
          2: { cellWidth: 24 },
          3: { cellWidth: 86 },
        },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: () => { addHeader(doc, settings, ++pageNums.current, pageNums.total); addFooter(doc, settings); },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    if (mqttDrops.length > 0) {
      y = checkPage(doc, y, 30, settings, pageNums);
      y = addSectionHeader(doc, y, `MQTT Disconnections — ${mqttDrops.length} events`);

      autoTable(doc, {
        startY: y,
        head: [['Timestamp', 'Device', 'Details']],
        body: mqttDrops.map(e => [fmtDate(e.occurred_at), deviceName(e.device_id), e.details]),
        styles: { fontSize: 6.5, cellPadding: 2.5, font: 'helvetica', textColor: [...C.slate700] as [number,number,number], lineColor: [...C.slate100] as [number,number,number], lineWidth: 0.3 },
        headStyles: { fillColor: [...C.slate900] as [number,number,number], textColor: [...C.white] as [number,number,number], fontStyle: 'bold', fontSize: 6.5, cellPadding: 3.5 },
        alternateRowStyles: { fillColor: [...C.slate50] as [number,number,number] },
        columnStyles: { 0: { cellWidth: 36, font: 'courier' }, 1: { cellWidth: 36 }, 2: { cellWidth: 106 } },
        margin: { left: MARGIN, right: MARGIN },
        didDrawPage: () => { addHeader(doc, settings, ++pageNums.current, pageNums.total); addFooter(doc, settings); },
      });
    }

    addFooter(doc, settings);
  }

  // Fix last page footer
  addFooter(doc, settings);

  // Save
  const filename = `${(settings.companyName || 'MedixSafe').replace(/\s+/g, '_')}_Log_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export function exportCSV(
  accessEvents: AccessEvent[],
  systemEvents: SystemEvent[],
  devices: { id: string; friendlyName: string }[],
  companyName: string
) {
  const deviceName = (id: string) => {
    const d = devices.find(d => d.id === id);
    return d?.friendlyName || id;
  };

  // Access events CSV
  const accessHeaders = ['Timestamp', 'Device ID', 'Device Name', 'Auth Type', 'Result', 'Failure Reason', 'User ID', 'Card Bits', 'Door ID', 'Door Open (ms)'];
  const accessRows = accessEvents.map(e => [
    e.occurred_at,
    e.device_id,
    deviceName(e.device_id),
    e.auth_type,
    e.result,
    e.failure_reason || '',
    e.user_id_raw || '',
    e.card_bits?.toString() || '',
    e.door_id?.toString() || '',
    e.door_open_ms?.toString() || '',
  ]);

  const accessCSV = [accessHeaders, ...accessRows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const accessBlob = new Blob([accessCSV], { type: 'text/csv' });
  const accessUrl = URL.createObjectURL(accessBlob);
  const accessLink = document.createElement('a');
  accessLink.href = accessUrl;
  accessLink.download = `${companyName.replace(/\s+/g, '_')}_Access_Events_${new Date().toISOString().slice(0, 10)}.csv`;
  accessLink.click();
  URL.revokeObjectURL(accessUrl);

  // System events CSV (slight delay to avoid browser blocking)
  if (systemEvents.length > 0) {
    setTimeout(() => {
      const sysHeaders = ['Timestamp', 'Device ID', 'Device Name', 'Event Type', 'Module', 'Details'];
      const sysRows = systemEvents.map(e => [
        e.occurred_at,
        e.device_id,
        deviceName(e.device_id),
        e.event_type,
        e.module,
        e.details,
      ]);
      const sysCSV = [sysHeaders, ...sysRows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const sysBlob = new Blob([sysCSV], { type: 'text/csv' });
      const sysUrl = URL.createObjectURL(sysBlob);
      const sysLink = document.createElement('a');
      sysLink.href = sysUrl;
      sysLink.download = `${companyName.replace(/\s+/g, '_')}_System_Events_${new Date().toISOString().slice(0, 10)}.csv`;
      sysLink.click();
      URL.revokeObjectURL(sysUrl);
    }, 500);
  }
}
