// Client-side PPT generation using already-loaded dashboard data.
// PptxGenJS ESM build works correctly in browser (Vite handles it);
// the Node.js/Netlify function path was abandoned because the ESM build
// crashes in that environment.
import PptxGenJS from 'pptxgenjs';

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

const BAND_DEFS = [
  { key: 'green', label: '≥75% — Good',      color: '16A34A' },
  { key: 'amber', label: '50–74% — Moderate', color: 'D97706' },
  { key: 'red',   label: '<50% — Critical',   color: 'DC2626' },
];

const C = {
  navy:      '0A1628',
  indigo:    '1E3A5F',
  accent:    '2563EB',
  green:     '16A34A',
  amber:     'D97706',
  red:       'DC2626',
  white:     'FFFFFF',
  offwhite:  'F8FAFC',
  lightgray: 'E2E8F0',
  midgray:   '94A3B8',
  text:      '1E293B',
  devicebg:  'F1F5F9',
};

function bandOf(pct)      { return pct >= 75 ? 'green' : pct >= 50 ? 'amber' : 'red'; }
function availColor(pct)  { return pct >= 75 ? C.green : pct >= 50 ? C.amber : C.red; }
function availLight(pct)  { return pct >= 75 ? 'A7F3D0' : pct >= 50 ? 'FDE68A' : 'FECACA'; }

// ── Layout helpers ────────────────────────────────────────
function addBg(slide) {
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.offwhite } });
}

function addHeader(slide, title, subtitle = '', accent = C.navy) {
  slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 1.1, fill: { color: accent } });
  slide.addText(title, { x: 0.35, y: 0.13, w: 9.1, h: 0.58, fontSize: 20, bold: true, color: C.white, fontFace: 'Calibri' });
  if (subtitle) slide.addText(subtitle, { x: 0.35, y: 0.72, w: 9.1, h: 0.3, fontSize: 11, color: 'CCDDEE', fontFace: 'Calibri' });
}

function addFooter(slide, date) {
  slide.addShape('rect', { x: 0, y: 7.05, w: '100%', h: 0.45, fill: { color: C.navy } });
  slide.addText(`Network Performance Report  ·  ${date}  ·  Confidential`, {
    x: 0.3, y: 7.1, w: 9.4, h: 0.3, fontSize: 8, color: C.midgray, align: 'center', fontFace: 'Calibri',
  });
}

function statBox(slide, x, y, w, label, value, sub) {
  slide.addShape('rect', { x, y, w, h: 1.3, fill: { color: C.white }, line: { color: C.lightgray, width: 0.5 }, rectRadius: 0.08 });
  slide.addText(label, { x, y: y + 0.08, w, h: 0.25, fontSize: 8,  bold: true, color: C.midgray, align: 'center', fontFace: 'Calibri' });
  slide.addText(value, { x, y: y + 0.32, w, h: 0.6,  fontSize: 26, bold: true, color: C.text,    align: 'center', fontFace: 'Calibri' });
  if (sub) slide.addText(sub, { x, y: y + 0.94, w, h: 0.28, fontSize: 9, color: C.midgray, align: 'center', fontFace: 'Calibri' });
}

function hoursChart(slide, labels, uptimeVals, downtimeVals, x, y, w, h) {
  if (!labels.length) return;
  slide.addChart('bar', [
    { name: 'Uptime Hours',   labels, values: uptimeVals   },
    { name: 'Downtime Hours', labels, values: downtimeVals },
  ], {
    x, y, w, h, barDir: 'col', barGrouping: 'stacked',
    chartColors: [C.green, C.red], showValue: true,
    dataLabelFontSize: 11, dataLabelFontBold: true, dataLabelColor: C.white, dataLabelPosition: 'ctr',
    catAxisLabelFontSize: 11, valAxisLabelFontSize: 9,
    valAxisMinVal: 0, valAxisMaxVal: 24,
    showLegend: true, legendPos: 'b', legendFontSize: 10, plotAreaBorderColor: C.lightgray,
  });
}

// ── Client detail slides (one per period) ─────────────────
function addClientDetailSlides(prs, sites, period, date) {
  const allRows = [];
  let idx = 0;
  for (const site of sites) {
    idx++;
    allRows.push({ type: 'client', site, idx });
    if (site.devices && site.devices.length > 1)
      for (const dev of site.devices) allRows.push({ type: 'device', dev });
  }

  const ROW_H = 0.175, PAGE_H = 5.75;
  const MAX   = Math.floor((PAGE_H - ROW_H) / ROW_H); // subtract 1 header row
  const pages = Math.ceil(allRows.length / MAX);

  for (let p = 0; p < pages; p++) {
    const slide  = prs.addSlide();
    addBg(slide);
    addHeader(slide, `${period} — Client Detail${pages > 1 ? ` (${p + 1}/${pages})` : ''}`, `Availability per client · ${date}`);
    addFooter(slide, date);

    const chunk = allRows.slice(p * MAX, (p + 1) * MAX);
    const hdr   = [
      { text: '#',               options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
      { text: 'Client / Device', options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
      { text: 'Location',        options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
      { text: 'Uptime h',        options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
      { text: 'Downtime h',      options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
      { text: 'Availability',    options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
    ];

    let alt = 0;
    const rows = chunk.map(row => {
      if (row.type === 'client') {
        alt++;
        const bg  = alt % 2 === 0 ? C.offwhite : C.white;
        const s   = row.site;
        const lbl = s.clientName + (s.devices.length > 1 ? ` (${s.devices.length} devices)` : '');
        return [
          { text: String(row.idx),   options: { fontSize: 8,   bold: true, color: C.midgray, fill: { color: bg }, align: 'center' } },
          { text: lbl,               options: { fontSize: 8.5, bold: true, color: C.text,    fill: { color: bg } } },
          { text: s.location || '—', options: { fontSize: 8,              color: C.midgray,  fill: { color: bg } } },
          { text: String(s.uptime),  options: { fontSize: 8,              color: C.text,     fill: { color: bg }, align: 'center' } },
          { text: String(s.downtime),options: { fontSize: 8,              color: s.downtime > 0 ? C.red : C.text, fill: { color: bg }, align: 'center' } },
          { text: `${s.availability}%`, options: { fontSize: 8, bold: true, color: availColor(s.availability), fill: { color: bg }, align: 'center' } },
        ];
      } else {
        const d = row.dev;
        return [
          { text: '',                   options: { fontSize: 7, fill: { color: C.devicebg } } },
          { text: `  \u21b3 ${d.name}`, options: { fontSize: 7.5, italic: true, color: C.midgray, fill: { color: C.devicebg } } },
          { text: '',                   options: { fontSize: 7, fill: { color: C.devicebg } } },
          { text: String(d.uptime),     options: { fontSize: 7.5, color: C.midgray, fill: { color: C.devicebg }, align: 'center' } },
          { text: String(d.downtime),   options: { fontSize: 7.5, color: d.downtime > 0 ? 'E57373' : C.midgray, fill: { color: C.devicebg }, align: 'center' } },
          { text: `${d.availability}%`, options: { fontSize: 7.5, color: availColor(d.availability), fill: { color: C.devicebg }, align: 'center' } },
        ];
      }
    });

    slide.addTable([hdr, ...rows], {
      x: 0.3, y: 1.2, w: 9.4, h: PAGE_H,
      rowH: ROW_H, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri',
    });
  }
}

// ── Location breakdown slides (one per period) ────────────
function addLocationSlides(prs, activePeriods, periods, date) {
  for (const period of activePeriods) {
    const sites = periods[period]?.sites ?? [];

    const locationMap = {};
    for (const site of sites) {
      const loc = site.location || 'Unknown';
      if (!locationMap[loc]) locationMap[loc] = [];
      locationMap[loc].push(site);
    }

    const allRows = [];
    for (const loc of Object.keys(locationMap).sort()) {
      const ls       = locationMap[loc].sort((a, b) => b.availability - a.availability);
      const avgAvail = parseFloat((ls.reduce((s, c) => s + c.availability, 0) / ls.length).toFixed(1));
      const green    = ls.filter(s => bandOf(s.availability) === 'green').length;
      const amber    = ls.filter(s => bandOf(s.availability) === 'amber').length;
      const red      = ls.filter(s => bandOf(s.availability) === 'red').length;
      allRows.push({ type: 'location', loc, count: ls.length, avgAvail, green, amber, red });
      for (const site of ls) allRows.push({ type: 'client', site });
    }

    const ROW_H = 0.185, PAGE_H = 5.75;
    const MAX   = Math.floor((PAGE_H - ROW_H) / ROW_H); // subtract 1 header row
    const pages = [];
    let cur = [], cnt = 0;
    for (const row of allRows) {
      if (cnt >= MAX && cur.length) { pages.push(cur); cur = []; cnt = 0; }
      cur.push(row); cnt++;
    }
    if (cur.length) pages.push(cur);

    for (let pi = 0; pi < pages.length; pi++) {
      const slide = prs.addSlide();
      addBg(slide);
      addHeader(slide, `Location Breakdown — ${period}${pages.length > 1 ? ` (${pi + 1}/${pages.length})` : ''}`, `Client availability by location · ${date}`, C.accent);
      addFooter(slide, date);
      slide.addShape('rect', { x: 0, y: 1.1, w: 0.12, h: 5.95, fill: { color: C.accent } });

      const hdr = [
        { text: 'Location / Client', options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
        { text: 'Devices',           options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
        { text: 'G / A / R',         options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
        { text: 'Avg Uptime h',      options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
        { text: 'Avg Downtime h',    options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
        { text: 'Avg Avail.',        options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
      ];

      let alt = 0;
      const dataRows = pages[pi].map(row => {
        if (row.type === 'location') {
          return [
            { text: row.loc,                              options: { bold: true, fontSize: 9.5, color: C.white, fill: { color: C.indigo } } },
            { text: String(row.count),                    options: { bold: true, fontSize: 9,   color: C.white, fill: { color: C.indigo }, align: 'center' } },
            { text: `${row.green} / ${row.amber} / ${row.red}`, options: { bold: true, fontSize: 9, color: C.white, fill: { color: C.indigo }, align: 'center' } },
            { text: '', options: { fill: { color: C.indigo } } },
            { text: '', options: { fill: { color: C.indigo } } },
            { text: `${row.avgAvail}%`, options: { bold: true, fontSize: 9.5, color: availLight(row.avgAvail), fill: { color: C.indigo }, align: 'center' } },
          ];
        } else {
          alt++;
          const bg = alt % 2 === 0 ? C.offwhite : C.white;
          const s  = row.site;
          return [
            { text: `  ${s.clientName}`, options: { fontSize: 8.5, bold: true, color: C.text, fill: { color: bg } } },
            { text: String(s.devices?.length ?? 1), options: { fontSize: 8, color: C.midgray, fill: { color: bg }, align: 'center' } },
            { text: '', options: { fill: { color: bg } } },
            { text: String(s.uptime),    options: { fontSize: 8, color: C.text,    fill: { color: bg }, align: 'center' } },
            { text: String(s.downtime),  options: { fontSize: 8, color: s.downtime > 0 ? C.red : C.text, fill: { color: bg }, align: 'center' } },
            { text: `${s.availability}%`, options: { fontSize: 8, bold: true, color: availColor(s.availability), fill: { color: bg }, align: 'center' } },
          ];
        }
      });

      slide.addTable([hdr, ...dataRows], {
        x: 0.3, y: 1.2, w: 9.4, h: PAGE_H,
        rowH: ROW_H, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri',
      });
    }
  }
}

// ── Main export ───────────────────────────────────────────
export async function generateReport(data) {
  const {
    date,
    totalSites:              totalClients,
    totalDevices,
    overallAvgAvailability,
    periods       = {},
    bandDetails   = {},
    topPerformers = [],
    sitesNeedingAttention = [],
    locations     = [],
  } = data;

  const activePeriods = PERIODS.filter(p => periods[p]);

  const prs = new PptxGenJS();
  prs.layout  = 'LAYOUT_WIDE';
  prs.author  = 'Network Operations';
  prs.subject = 'ISP Uptime Report';

  // ── Slide 1: Title ───────────────────────────────────────
  {
    const slide = prs.addSlide();
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.navy } });
    slide.addShape('rect', { x: 0, y: 4.8,  w: '100%', h: 2.7,  fill: { color: C.indigo } });
    slide.addShape('rect', { x: 0, y: 3.25, w: 0.18,   h: 1.4,  fill: { color: C.accent } });
    slide.addText('NETWORK PERFORMANCE', { x: 0.4, y: 1.2, w: 12, h: 0.5, fontSize: 14, bold: true, color: C.accent, charSpacing: 4, fontFace: 'Calibri' });
    slide.addText('Uptime & Availability Report', { x: 0.4, y: 1.75, w: 12, h: 1.0, fontSize: 40, bold: true, color: C.white, fontFace: 'Calibri' });
    slide.addText(`Week of ${date}`, { x: 0.4, y: 2.85, w: 6, h: 0.45, fontSize: 16, color: C.midgray, fontFace: 'Calibri' });
    slide.addText(`${totalClients} clients  ·  ${totalDevices} devices  ·  ${locations.length} locations  ·  Sun – Fri`, { x: 0.4, y: 5.2, w: 12, h: 0.4, fontSize: 13, color: C.lightgray, fontFace: 'Calibri' });
  }

  // ── Slide 2: Executive Summary ───────────────────────────
  {
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, 'Executive Summary', `Network availability overview · ${date}`);
    addFooter(slide, date);

    statBox(slide, 0.3,  1.2, 2.1,  'TOTAL CLIENTS',    String(totalClients),         'monitored');
    statBox(slide, 2.55, 1.2, 2.1,  'TOTAL DEVICES',    String(totalDevices),         'in report');
    statBox(slide, 4.8,  1.2, 2.1,  'AVG AVAILABILITY', `${overallAvgAvailability}%`, 'all periods');
    statBox(slide, 7.05, 1.2, 2.25, 'LOCATIONS',        String(locations.length),     date);

    const tblRows = [
      [
        { text: 'Period',          options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10 } },
        { text: 'Clients',         options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
        { text: 'Avg Avail.',      options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
        { text: 'Avg Uptime h',    options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
        { text: 'Avg Downtime h',  options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
        { text: '≥75% (Green)',    options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
        { text: '50–74% (Amber)',  options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
        { text: '<50% (Red)',      options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
      ],
      ...activePeriods.map((p, i) => {
        const pd = periods[p];
        const bg = i % 2 === 0 ? C.white : C.offwhite;
        return [
          { text: p,                           options: { fontSize: 10, bold: true, color: C.text,  fill: { color: bg } } },
          { text: String(pd.count),            options: { fontSize: 10, color: C.text,  fill: { color: bg }, align: 'center' } },
          { text: `${pd.avgAvailability}%`,    options: { fontSize: 10, bold: true, color: availColor(pd.avgAvailability), fill: { color: bg }, align: 'center' } },
          { text: String(pd.avgUptimeHours),   options: { fontSize: 10, color: C.green, fill: { color: bg }, align: 'center' } },
          { text: String(pd.avgDowntimeHours), options: { fontSize: 10, color: C.red,   fill: { color: bg }, align: 'center' } },
          { text: String(pd.bands.green),      options: { fontSize: 10, color: C.green, fill: { color: bg }, align: 'center' } },
          { text: String(pd.bands.amber),      options: { fontSize: 10, color: C.amber, fill: { color: bg }, align: 'center' } },
          { text: String(pd.bands.red),        options: { fontSize: 10, color: C.red,   fill: { color: bg }, align: 'center' } },
        ];
      }),
    ];
    slide.addTable(tblRows, { x: 0.3, y: 2.65, w: 9.4, h: 1.4, rowH: 0.32, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri' });

    [
      { color: C.green, label: '≥75% — Good' },
      { color: C.amber, label: '50–74% — Moderate' },
      { color: C.red,   label: '<50% — Critical' },
    ].forEach((l, i) => {
      slide.addShape('rect', { x: 0.3 + i * 3.1, y: 4.24, w: 0.16, h: 0.16, fill: { color: l.color }, rectRadius: 0.03 });
      slide.addText(l.label, { x: 0.5 + i * 3.1, y: 4.22, w: 2.8, h: 0.22, fontSize: 9, color: C.text, fontFace: 'Calibri' });
    });
  }

  // ── Band slides ──────────────────────────────────────────
  for (const band of BAND_DEFS) {
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, `Availability Band: ${band.label}`, `Client uptime & downtime per period for this band · ${date}`, band.color);
    addFooter(slide, date);

    const periodData = activePeriods.map(p => bandDetails[band.key]?.[p] ?? { count: 0, avgUptime: 0, avgDowntime: 0 });
    activePeriods.forEach((p, pi) => {
      statBox(slide, 0.3 + pi * 3.15, 1.2, 3.0, p.toUpperCase(), `${periodData[pi].count} clients`, `avg ${periodData[pi].avgUptime}h up · ${periodData[pi].avgDowntime}h dn`);
    });
    hoursChart(slide, activePeriods, periodData.map(d => d.avgUptime), periodData.map(d => d.avgDowntime), 0.5, 2.65, 9.0, 4.15);
    slide.addShape('rect', { x: 0, y: 1.1, w: 0.12, h: 5.95, fill: { color: band.color } });
  }

  // ── Location breakdown slides ────────────────────────────
  addLocationSlides(prs, activePeriods, periods, date);

  // ── Top Performers ───────────────────────────────────────
  {
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, 'Top Performers — 100% Availability Across All Periods', `Full uptime every period · ${date}`);
    addFooter(slide, date);

    if (!topPerformers.length) {
      slide.addText('No clients achieved 100% availability across all periods.', { x: 0.5, y: 3.5, w: 9, h: 0.5, fontSize: 14, color: C.midgray, align: 'center', fontFace: 'Calibri' });
    } else {
      const half = Math.ceil(topPerformers.length / 2);
      [topPerformers.slice(0, half), topPerformers.slice(half)].forEach((col, ci) => {
        col.forEach((name, ri) => {
          const x = ci === 0 ? 0.5 : 5.2;
          const y = 1.3 + ri * 0.29;
          slide.addShape('rect', { x, y: y + 0.05, w: 0.12, h: 0.12, fill: { color: C.green }, rectRadius: 0.06 });
          slide.addText(name, { x: x + 0.18, y, w: 4.5, h: 0.27, fontSize: 9.5, color: C.text, fontFace: 'Calibri' });
        });
      });
      slide.addText(`${topPerformers.length} clients with 100% availability across all periods`, { x: 0.3, y: 6.7, w: 9.4, h: 0.28, fontSize: 10, color: C.midgray, italic: true, fontFace: 'Calibri' });
    }
  }

  // ── Per-period client detail ─────────────────────────────
  for (const period of activePeriods) {
    addClientDetailSlides(prs, periods[period]?.sites ?? [], period, date);
  }

  // ── Clients requiring attention ──────────────────────────
  {
    const ATN_ROW_H = 0.24, PAGE_H = 5.75;
    const MAX = Math.floor((PAGE_H - ATN_ROW_H) / ATN_ROW_H); // subtract 1 header row → 22 data rows

    const hdr = [
      { text: 'Client',     options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9 } },
      ...activePeriods.map(per => ({ text: per, options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9, align: 'center' } })),
      { text: 'Avg Avail.', options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9, align: 'center' } },
    ];

    const pages = Math.max(1, Math.ceil(sitesNeedingAttention.length / MAX));

    for (let pi = 0; pi < pages; pi++) {
      const slide = prs.addSlide();
      addBg(slide);
      addHeader(slide, `Clients Requiring Attention — Avg Availability < 50%${pages > 1 ? ` (${pi + 1}/${pages})` : ''}`, `Consistently low-performing clients · ${date}`, C.red);
      addFooter(slide, date);

      if (!sitesNeedingAttention.length) {
        slide.addText('All clients are performing above 50% availability.', { x: 0.5, y: 3.5, w: 9, h: 0.5, fontSize: 14, color: C.green, align: 'center', fontFace: 'Calibri' });
      } else {
        const chunk = sitesNeedingAttention.slice(pi * MAX, (pi + 1) * MAX);
        const dataRows = chunk.map((s, i) => {
          const bg = i % 2 === 0 ? C.white : C.offwhite;
          return [
            { text: s.name, options: { fontSize: 9, color: C.text, fill: { color: bg } } },
            ...activePeriods.map(per => {
              const v = s.periods?.[per];
              return { text: v ? `${v.uptime}h up / ${v.downtime}h dn (${v.availability}%)` : '—', options: { fontSize: 8.5, color: v ? availColor(v.availability) : C.midgray, fill: { color: bg }, align: 'center' } };
            }),
            { text: `${s.avgAvailability}%`, options: { fontSize: 9, bold: true, color: C.red, fill: { color: bg }, align: 'center' } },
          ];
        });
        slide.addTable([hdr, ...dataRows], { x: 0.3, y: 1.2, w: 9.4, h: PAGE_H, rowH: ATN_ROW_H, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri' });
      }
    }
  }

  // Triggers browser file-save dialog
  await prs.writeFile({ fileName: `Network_Uptime_Report_${date}.pptx` });
}
