import PptxGenJS from '../node_modules/pptxgenjs/dist/pptxgen.cjs.js';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

try {
    const envFile = readFileSync(join(projectRoot, '.env.local'), 'utf-8');
    for (const line of envFile.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
        if (k && !(k in process.env)) process.env[k] = v;
    }
} catch {}

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE   = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

// ── Palette ───────────────────────────────────────────────
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
};

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

// Band definitions — determined per period per site
const BAND_DEFS = [
    { key: 'green', label: '≥75% — Good',     color: C.green, min: 75,  max: 100 },
    { key: 'amber', label: '50–74% — Moderate',color: C.amber, min: 50,  max: 74.9 },
    { key: 'red',   label: '<50% — Critical',  color: C.red,   min: 0,   max: 49.9 },
];

function inBand(avail, band) {
    return avail >= band.min && avail <= band.max;
}

function availColor(pct) {
    if (pct >= 75) return C.green;
    if (pct >= 50) return C.amber;
    return C.red;
}

// ── Fetch Airtable ────────────────────────────────────────
async function fetchAll() {
    let records = [], offset = null;
    do {
        const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}`);
        url.searchParams.set('pageSize', '100');
        if (offset) url.searchParams.set('offset', offset);
        const res  = await fetch(url.toString(), { headers: { Authorization: `Bearer ${API_KEY}` } });
        const data = await res.json();
        records.push(...(data.records || []));
        offset = data.offset || null;
    } while (offset);
    return records;
}

// ── Build summary ─────────────────────────────────────────
function buildSummary(records) {
    const summary = {};
    for (const r of records) {
        const f      = r.fields;
        const name   = (f.Names || '').trim();
        const period = f['Time Period'];
        const uptime = f['Uptime Hours'] ?? null;
        if (!name || !period || uptime === null) continue;
        const downtime     = parseFloat((24 - uptime).toFixed(1));
        const availability = parseFloat(((uptime / 24) * 100).toFixed(1));
        if (!summary[name]) summary[name] = {};
        summary[name][period] = { uptime, downtime, availability };
    }
    return summary;
}

// All entries for a period, sorted best → worst
function periodEntries(summary, period) {
    return Object.entries(summary)
        .filter(([, v]) => v[period])
        .map(([name, v]) => ({ name, ...v[period] }))
        .sort((a, b) => b.availability - a.availability);
}

// Avg uptime & downtime for a set of entries
function avg(entries) {
    if (!entries.length) return { avgUptime: 0, avgDowntime: 0, count: 0 };
    const avgUptime   = parseFloat((entries.reduce((s, e) => s + e.uptime,   0) / entries.length).toFixed(1));
    const avgDowntime = parseFloat((entries.reduce((s, e) => s + e.downtime, 0) / entries.length).toFixed(1));
    return { avgUptime, avgDowntime, count: entries.length };
}

// ── Layout helpers ────────────────────────────────────────
function addBg(slide) {
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.offwhite } });
}

function addHeader(slide, title, subtitle = '', accentColor = C.navy) {
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 1.1, fill: { color: accentColor } });
    slide.addText(title,    { x: 0.35, y: 0.13, w: 9.1, h: 0.58, fontSize: 20, bold: true, color: C.white,   fontFace: 'Calibri' });
    if (subtitle) slide.addText(subtitle, { x: 0.35, y: 0.72, w: 9.1, h: 0.3, fontSize: 11, color: 'CCDDEE', fontFace: 'Calibri' });
}

function addFooter(slide, date) {
    slide.addShape('rect', { x: 0, y: 7.05, w: '100%', h: 0.45, fill: { color: C.navy } });
    slide.addText(`Network Performance Report  ·  ${date}  ·  Confidential`, {
        x: 0.3, y: 7.1, w: 9.4, h: 0.3,
        fontSize: 8, color: C.midgray, align: 'center', fontFace: 'Calibri',
    });
}

function statBox(slide, x, y, w, label, value, sub) {
    slide.addShape('rect', { x, y, w, h: 1.3, fill: { color: C.white }, line: { color: C.lightgray, width: 0.5 }, rectRadius: 0.08 });
    slide.addText(label, { x, y: y + 0.08, w, h: 0.25, fontSize: 8,  bold: true, color: C.midgray, align: 'center', fontFace: 'Calibri' });
    slide.addText(value, { x, y: y + 0.32, w, h: 0.6,  fontSize: 26, bold: true, color: C.text,    align: 'center', fontFace: 'Calibri' });
    if (sub) slide.addText(sub, { x, y: y + 0.94, w, h: 0.28, fontSize: 9, color: C.midgray, align: 'center', fontFace: 'Calibri' });
}

// ── Uptime vs Downtime stacked bar (hours) ────────────────
function hoursChart(slide, labels, uptimeVals, downtimeVals, x, y, w, h) {
    slide.addChart('bar', [
        { name: 'Uptime Hours',   labels, values: uptimeVals   },
        { name: 'Downtime Hours', labels, values: downtimeVals },
    ], {
        x, y, w, h,
        barDir: 'col', barGrouping: 'stacked',
        chartColors: [C.green, C.red],
        showValue: true,
        dataLabelFontSize: 11, dataLabelFontBold: true,
        dataLabelColor: C.white, dataLabelPosition: 'ctr',
        catAxisLabelFontSize: 11, valAxisLabelFontSize: 9,
        valAxisMinVal: 0, valAxisMaxVal: 24,
        showLegend: true, legendPos: 'b', legendFontSize: 10,
        plotAreaBorderColor: C.lightgray,
    });
}

// ── Provider detail table (paginated) ─────────────────────
function addProviderTable(prs, entries, period, date) {
    const ROWS  = 32;
    const pages = Math.ceil(entries.length / ROWS);
    for (let p = 0; p < pages; p++) {
        const slide  = prs.addSlide();
        addBg(slide);
        const suffix = pages > 1 ? ` (${p + 1}/${pages})` : '';
        addHeader(slide, `${period} — Site Detail${suffix}`, `Uptime & downtime per provider · ${date}`);
        addFooter(slide, date);

        const chunk = entries.slice(p * ROWS, (p + 1) * ROWS);
        const rows  = [
            [
                { text: '#',            options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
                { text: 'Provider',     options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
                { text: 'Uptime h',     options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
                { text: 'Downtime h',   options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
                { text: 'Availability', options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
            ],
            ...chunk.map((e, i) => {
                const idx = p * ROWS + i + 1;
                const bg  = i % 2 === 0 ? C.white : C.offwhite;
                return [
                    { text: String(idx),          options: { fontSize: 8, color: C.midgray, fill: { color: bg }, align: 'center' } },
                    { text: e.name,               options: { fontSize: 8, color: C.text,    fill: { color: bg } } },
                    { text: String(e.uptime),     options: { fontSize: 8, color: C.text,    fill: { color: bg }, align: 'center' } },
                    { text: String(e.downtime),   options: { fontSize: 8, color: e.downtime > 0 ? C.red : C.text, fill: { color: bg }, align: 'center' } },
                    { text: `${e.availability}%`, options: { fontSize: 8, bold: true, color: availColor(e.availability), fill: { color: bg }, align: 'center' } },
                ];
            }),
        ];
        slide.addTable(rows, {
            x: 0.3, y: 1.2, w: 9.4, h: 5.75,
            rowH: 0.175, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri',
        });
    }
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
console.log('Fetching data from Airtable...');
const records = await fetchAll();
console.log(`  ${records.length} records loaded`);

const summary    = buildSummary(records);
const date       = records[0]?.fields?.Date || new Date().toISOString().split('T')[0];
const allEntries = PERIODS.map(p => periodEntries(summary, p));

// For each band × each period: entries in that band
// bandData[bandKey][periodIndex] = { avgUptime, avgDowntime, count, entries[] }
const bandData = {};
for (const band of BAND_DEFS) {
    bandData[band.key] = PERIODS.map((_, pi) => {
        const inThisBand = allEntries[pi].filter(e => inBand(e.availability, band));
        return { ...avg(inThisBand), entries: inThisBand };
    });
}

const prs = new PptxGenJS();
prs.layout  = 'LAYOUT_WIDE';
prs.author  = 'Network Operations';
prs.subject = 'ISP Uptime Report';

// ─── Slide 1: Title ───────────────────────────────────────
{
    const slide = prs.addSlide();
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.navy } });
    slide.addShape('rect', { x: 0, y: 4.8,  w: '100%', h: 2.7,  fill: { color: C.indigo } });
    slide.addShape('rect', { x: 0, y: 3.25, w: 0.18,   h: 1.4,  fill: { color: C.accent } });
    slide.addText('NETWORK PERFORMANCE', {
        x: 0.4, y: 1.2, w: 12, h: 0.5,
        fontSize: 14, bold: true, color: C.accent, charSpacing: 4, fontFace: 'Calibri',
    });
    slide.addText('Uptime & Availability Report', {
        x: 0.4, y: 1.75, w: 12, h: 1.0,
        fontSize: 40, bold: true, color: C.white, fontFace: 'Calibri',
    });
    slide.addText(`Week of ${date}`, {
        x: 0.4, y: 2.85, w: 6, h: 0.45, fontSize: 16, color: C.midgray, fontFace: 'Calibri',
    });
    slide.addText(`${Object.keys(summary).length} sites  ·  3 time periods  ·  Sun – Fri`, {
        x: 0.4, y: 5.2, w: 12, h: 0.4, fontSize: 13, color: C.lightgray, fontFace: 'Calibri',
    });
}

// ─── Slide 2: Executive Summary ───────────────────────────
{
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, 'Executive Summary', `Network availability overview · ${date}`);
    addFooter(slide, date);

    // Overall stats
    const totalSites = Object.keys(summary).length;
    const overallAvg = parseFloat((
        allEntries.flat().reduce((s, e) => s + e.availability, 0) /
        allEntries.flat().length
    ).toFixed(1));

    statBox(slide, 0.3,  1.2, 2.1,  'TOTAL SITES',     String(totalSites),  'monitored');
    statBox(slide, 2.55, 1.2, 2.1,  'AVG AVAILABILITY', `${overallAvg}%`,   'all periods');
    statBox(slide, 4.8,  1.2, 2.1,  'REPORTING PERIOD', 'Sun – Fri',        date);
    statBox(slide, 7.05, 1.2, 2.25, 'TIME PERIODS',     '3',                'bands');

    // Summary table
    const tblRows = [
        [
            { text: 'Period',          options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10 } },
            { text: 'Sites',           options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
            { text: 'Avg Avail.',      options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
            { text: 'Avg Uptime h',    options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
            { text: 'Avg Downtime h',  options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
            { text: '≥75% (Green)',    options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
            { text: '50–74% (Amber)',  options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
            { text: '<50% (Red)',      options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 10, align: 'center' } },
        ],
        ...PERIODS.map((p, pi) => {
            const entries = allEntries[pi];
            const a = avg(entries);
            const overallPeriodAvg = parseFloat((entries.reduce((s, e) => s + e.availability, 0) / entries.length).toFixed(1));
            const bg = pi % 2 === 0 ? C.white : C.offwhite;
            return [
                { text: p,                                            options: { fontSize: 10, bold: true, color: C.text,   fill: { color: bg } } },
                { text: String(entries.length),                       options: { fontSize: 10, color: C.text,   fill: { color: bg }, align: 'center' } },
                { text: `${overallPeriodAvg}%`,                       options: { fontSize: 10, bold: true, color: availColor(overallPeriodAvg), fill: { color: bg }, align: 'center' } },
                { text: String(a.avgUptime),                          options: { fontSize: 10, color: C.green, fill: { color: bg }, align: 'center' } },
                { text: String(a.avgDowntime),                        options: { fontSize: 10, color: C.red,   fill: { color: bg }, align: 'center' } },
                { text: String(bandData.green[pi].count),             options: { fontSize: 10, color: C.green, fill: { color: bg }, align: 'center' } },
                { text: String(bandData.amber[pi].count),             options: { fontSize: 10, color: C.amber, fill: { color: bg }, align: 'center' } },
                { text: String(bandData.red[pi].count),               options: { fontSize: 10, color: C.red,   fill: { color: bg }, align: 'center' } },
            ];
        }),
    ];
    slide.addTable(tblRows, {
        x: 0.3, y: 2.65, w: 9.4, h: 1.4,
        rowH: 0.32, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri',
    });

    // Legend
    [
        { color: C.green, label: '≥75% — Good' },
        { color: C.amber, label: '50–74% — Moderate' },
        { color: C.red,   label: '<50% — Critical' },
    ].forEach((l, i) => {
        slide.addShape('rect', { x: 0.3 + i * 3.1, y: 4.24, w: 0.16, h: 0.16, fill: { color: l.color }, rectRadius: 0.03 });
        slide.addText(l.label, { x: 0.5 + i * 3.1, y: 4.22, w: 2.8, h: 0.22, fontSize: 9, color: C.text, fontFace: 'Calibri' });
    });
}

// ─── Slides 3-5: One slide per availability band ──────────
// Each slide shows: uptime vs downtime hours per time period
// for sites that fall in that band during each period

for (const band of BAND_DEFS) {
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(
        slide,
        `Availability Band: ${band.label}`,
        `Uptime & downtime hours per time period for sites in this band · ${date}`,
        band.color
    );
    addFooter(slide, date);

    // Stat boxes: site count per period in this band
    const periodData = bandData[band.key];
    PERIODS.forEach((p, pi) => {
        statBox(slide, 0.3 + pi * 3.15, 1.2, 3.0,
            p.toUpperCase(),
            `${periodData[pi].count} sites`,
            `avg ${periodData[pi].avgUptime}h up · ${periodData[pi].avgDowntime}h dn`
        );
    });

    // Chart: avg uptime vs downtime hours per time period for this band
    hoursChart(
        slide,
        PERIODS,
        periodData.map(d => d.avgUptime),
        periodData.map(d => d.avgDowntime),
        0.5, 2.65, 9.0, 4.15
    );

    // Colour strip on left edge
    slide.addShape('rect', { x: 0, y: 1.1, w: 0.12, h: 5.95, fill: { color: band.color } });
}

// ─── Slide 6: Top Performers ──────────────────────────────
{
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, 'Top Performers — 100% Availability Across All Periods', `Full uptime every period · ${date}`);
    addFooter(slide, date);

    const topSites = Object.entries(summary)
        .filter(([, v]) => PERIODS.every(p => v[p]?.availability === 100))
        .map(([name]) => name).sort();

    if (topSites.length === 0) {
        slide.addText('No sites achieved 100% availability across all three periods.', {
            x: 0.5, y: 3.5, w: 9, h: 0.5, fontSize: 14, color: C.midgray, align: 'center', fontFace: 'Calibri',
        });
    } else {
        const half = Math.ceil(topSites.length / 2);
        [topSites.slice(0, half), topSites.slice(half)].forEach((col, ci) => {
            col.forEach((name, ri) => {
                const x = ci === 0 ? 0.5 : 5.2;
                const y = 1.3 + ri * 0.29;
                slide.addShape('rect', { x, y: y + 0.05, w: 0.12, h: 0.12, fill: { color: C.green }, rectRadius: 0.06 });
                slide.addText(name, { x: x + 0.18, y, w: 4.5, h: 0.27, fontSize: 9.5, color: C.text, fontFace: 'Calibri' });
            });
        });
        slide.addText(`${topSites.length} sites with 100% availability across all periods`, {
            x: 0.3, y: 6.7, w: 9.4, h: 0.28, fontSize: 10, color: C.midgray, italic: true, fontFace: 'Calibri',
        });
    }
}

// ─── Per-period detail slides ─────────────────────────────
for (let pi = 0; pi < PERIODS.length; pi++) {
    addProviderTable(prs, allEntries[pi], PERIODS[pi], date);
}

// ─── Sites Requiring Attention ────────────────────────────
{
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, 'Sites Requiring Attention — Average Availability < 50%', `Consistently low-performing sites · ${date}`, C.red.replace('#', ''));
    addFooter(slide, date);

    const poor = Object.entries(summary)
        .map(([name, v]) => {
            const ps  = PERIODS.filter(p => v[p]);
            const a   = ps.length ? parseFloat((ps.reduce((s, p) => s + v[p].availability, 0) / ps.length).toFixed(1)) : 0;
            return { name, avg: a, periods: v };
        })
        .filter(s => s.avg < 50)
        .sort((a, b) => a.avg - b.avg);

    if (poor.length === 0) {
        slide.addText('All sites are performing above 50% availability.', {
            x: 0.5, y: 3.5, w: 9, h: 0.5, fontSize: 14, color: C.green, align: 'center', fontFace: 'Calibri',
        });
    } else {
        const rows = [
            [
                { text: 'Provider',      options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9 } },
                ...PERIODS.map(p => ({ text: p, options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9, align: 'center' } })),
                { text: 'Avg Avail.',    options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9, align: 'center' } },
            ],
            ...poor.map((s, i) => {
                const bg = i % 2 === 0 ? C.white : C.offwhite;
                return [
                    { text: s.name, options: { fontSize: 9, color: C.text, fill: { color: bg } } },
                    ...PERIODS.map(p => {
                        const v = s.periods[p];
                        return {
                            text: v ? `${v.uptime}h up / ${v.downtime}h dn (${v.availability}%)` : '—',
                            options: { fontSize: 8.5, color: v ? availColor(v.availability) : C.midgray, fill: { color: bg }, align: 'center' },
                        };
                    }),
                    { text: `${s.avg}%`, options: { fontSize: 9, bold: true, color: C.red, fill: { color: bg }, align: 'center' } },
                ];
            }),
        ];
        slide.addTable(rows, {
            x: 0.3, y: 1.2, w: 9.4,
            rowH: 0.24, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri',
        });
    }
}

// ─── Save ─────────────────────────────────────────────────
const outPath = join(projectRoot, `Network_Uptime_Report_${date}.pptx`);
await prs.writeFile({ fileName: outPath });
console.log(`\nPresentation saved: ${outPath}`);
