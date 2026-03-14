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

const API_KEY  = process.env.AIRTABLE_API_KEY;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TABLE    = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';
const CV_TABLE = process.env.AIRTABLE_CV_TABLE_ID || 'tblujIggqfABKXFco';

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
    devicebg:  'F1F5F9',
};

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

const BAND_DEFS = [
    { key: 'green', label: '≥75% — Good',      color: C.green, min: 75,  max: 100 },
    { key: 'amber', label: '50–74% — Moderate', color: C.amber, min: 50,  max: 74.9 },
    { key: 'red',   label: '<50% — Critical',   color: C.red,   min: 0,   max: 49.9 },
];

function bandOf(pct) {
    if (pct >= 75) return 'green';
    if (pct >= 50) return 'amber';
    return 'red';
}

function availColor(pct) {
    if (pct >= 75) return C.green;
    if (pct >= 50) return C.amber;
    return C.red;
}

// Lighter tints for availability badges on dark backgrounds
function availColorLight(pct) {
    if (pct >= 75) return 'A7F3D0';
    if (pct >= 50) return 'FDE68A';
    return 'FECACA';
}

// ── Fetch Airtable ────────────────────────────────────────
async function fetchAll(tableId) {
    let records = [], offset = null;
    do {
        const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableId)}`);
        url.searchParams.set('pageSize', '100');
        if (offset) url.searchParams.set('offset', offset);
        const res  = await fetch(url.toString(), { headers: { Authorization: `Bearer ${API_KEY}` } });
        const data = await res.json();
        records.push(...(data.records || []));
        offset = data.offset || null;
    } while (offset);
    return records;
}

// ── Build aggregate (mirrors get-dashboard.js::aggregate) ─
function buildData(raw, cvRecords) {
    // Build device → { clientName, location } map
    const deviceToClient = {};
    for (const r of cvRecords) {
        const device     = r.fields['DEVICE NAME']?.trim();
        const clientName = r.fields['CLIENT NAME']?.trim();
        const location   = r.fields['LOCATION']?.name ?? r.fields['LOCATION'];
        if (device && clientName) {
            deviceToClient[device.toUpperCase()] = {
                clientName,
                location: (location && location !== 'undefined') ? String(location) : '',
            };
        }
    }

    // Normalize uptime records
    const normalized = raw.map(r => {
        const f           = r.fields || {};
        const uptimeHours = f['Uptime Hours'] != null ? Number(f['Uptime Hours']) : f['Hours'] != null ? Number(f['Hours']) : null;
        if (uptimeHours == null) return null;
        const timePeriod = f['Time Period'] || f['Time'] || '';
        const deviceName = (f['Names'] || f['Name'] || '').trim();
        const date       = f['Date'] || '';
        if (!deviceName || !PERIODS.includes(timePeriod)) return null;

        const entry      = deviceToClient[deviceName.toUpperCase()];
        const clientName = entry?.clientName || deviceName;
        const location   = entry?.location   || (f['Location'] || '').trim();

        return { date, deviceName, clientName, location, timePeriod, uptimeHours, downtime: Math.max(0, 24 - uptimeHours) };
    }).filter(Boolean);

    // Use most recent date
    const availableDates = [...new Set(normalized.map(r => r.date).filter(Boolean))].sort().reverse();
    const latestDate     = availableDates[0] || '';
    const filtered       = latestDate ? normalized.filter(r => r.date === latestDate) : normalized;

    const allClients   = [...new Set(filtered.map(r => r.clientName))];
    const totalClients = allClients.length;
    const totalDevices = [...new Set(filtered.map(r => r.deviceName))].length;

    // Build periods
    const periods = {};
    for (const period of PERIODS) {
        const rows = filtered.filter(r => r.timePeriod === period);
        if (!rows.length) continue;

        // Latest record per device within this period
        const deviceMap = {};
        for (const row of rows) {
            if (!deviceMap[row.deviceName] || row.date > deviceMap[row.deviceName].date) {
                deviceMap[row.deviceName] = row;
            }
        }

        // Group devices under clients
        const clientMap = {};
        for (const row of Object.values(deviceMap)) {
            if (!clientMap[row.clientName]) {
                clientMap[row.clientName] = { clientName: row.clientName, location: row.location, devices: [] };
            }
            const avail = parseFloat(((row.uptimeHours / 24) * 100).toFixed(1));
            clientMap[row.clientName].devices.push({
                name:         row.deviceName,
                uptime:       row.uptimeHours,
                downtime:     row.downtime,
                availability: avail,
            });
        }

        // Build client-level site objects (avg across devices)
        const sites = Object.values(clientMap).map(client => {
            const devs        = client.devices.sort((a, b) => a.name.localeCompare(b.name));
            const avgAvail    = parseFloat((devs.reduce((s, d) => s + d.availability, 0) / devs.length).toFixed(1));
            const avgUptime   = parseFloat((devs.reduce((s, d) => s + d.uptime,       0) / devs.length).toFixed(1));
            const avgDowntime = parseFloat((devs.reduce((s, d) => s + d.downtime,     0) / devs.length).toFixed(1));
            return {
                clientName:   client.clientName,
                location:     client.location,
                devices:      devs,
                uptime:       avgUptime,
                downtime:     avgDowntime,
                availability: avgAvail,
            };
        }).sort((a, b) => b.availability - a.availability);

        const bands = { green: 0, amber: 0, red: 0 };
        sites.forEach(s => bands[bandOf(s.availability)]++);

        periods[period] = {
            count:           sites.length,
            avgAvailability: parseFloat((sites.reduce((s, c) => s + c.availability, 0) / sites.length).toFixed(1)),
            avgUptimeHours:  parseFloat((sites.reduce((s, c) => s + c.uptime,       0) / sites.length).toFixed(1)),
            avgDowntimeHours:parseFloat((sites.reduce((s, c) => s + c.downtime,     0) / sites.length).toFixed(1)),
            bands,
            sites,
        };
    }

    // Band details per period
    const bandDetails = { green: {}, amber: {}, red: {} };
    for (const period of PERIODS) {
        if (!periods[period]) continue;
        for (const band of ['green', 'amber', 'red']) {
            const bs = periods[period].sites.filter(s => bandOf(s.availability) === band);
            if (!bs.length) { bandDetails[band][period] = { count: 0, avgUptime: 0, avgDowntime: 0 }; continue; }
            bandDetails[band][period] = {
                count:       bs.length,
                avgUptime:   parseFloat((bs.reduce((s, r) => s + r.uptime,   0) / bs.length).toFixed(1)),
                avgDowntime: parseFloat((bs.reduce((s, r) => s + r.downtime, 0) / bs.length).toFixed(1)),
            };
        }
    }

    const activePeriods  = PERIODS.filter(p => periods[p]);

    // Client → period availability map (for top performers + attention)
    const clientByPeriod = {};
    for (const period of activePeriods) {
        for (const s of periods[period].sites) {
            if (!clientByPeriod[s.clientName]) clientByPeriod[s.clientName] = {};
            clientByPeriod[s.clientName][period] = s.availability;
        }
    }

    const topPerformers = allClients.filter(n => {
        const a = clientByPeriod[n] || {};
        return activePeriods.every(p => a[p] != null && a[p] >= 100);
    }).sort();

    const sitesNeedingAttention = allClients.map(n => {
        const a    = clientByPeriod[n] || {};
        const vals = activePeriods.map(p => a[p]).filter(v => v != null);
        if (!vals.length) return null;
        const avgAvailability = parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
        if (avgAvailability >= 50) return null;
        const periodsDetail = {};
        for (const period of activePeriods) {
            const site = (periods[period]?.sites || []).find(s => s.clientName === n);
            if (site) periodsDetail[period] = { uptime: site.uptime, downtime: site.downtime, availability: site.availability };
        }
        return { name: n, avgAvailability, periods: periodsDetail };
    }).filter(Boolean).sort((a, b) => a.avgAvailability - b.avgAvailability);

    const allAvails = activePeriods.flatMap(p => (periods[p]?.sites || []).map(s => s.availability));
    const overallAvgAvailability = allAvails.length
        ? parseFloat((allAvails.reduce((s, v) => s + v, 0) / allAvails.length).toFixed(1))
        : 0;

    const locations = [...new Set(
        activePeriods.flatMap(p => (periods[p]?.sites || []).map(s => s.location).filter(Boolean))
    )].sort();

    return { date: latestDate, availableDates, totalClients, totalDevices, overallAvgAvailability, periods, bandDetails, topPerformers, sitesNeedingAttention, activePeriods, locations };
}

// ── Layout helpers ────────────────────────────────────────
function addBg(slide) {
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: '100%', fill: { color: C.offwhite } });
}

function addHeader(slide, title, subtitle = '', accentColor = C.navy) {
    slide.addShape('rect', { x: 0, y: 0, w: '100%', h: 1.1, fill: { color: accentColor } });
    slide.addText(title, { x: 0.35, y: 0.13, w: 9.1, h: 0.58, fontSize: 20, bold: true, color: C.white, fontFace: 'Calibri' });
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

// ── Per-period Client Detail table (with device sub-rows) ─
function addClientDetailSlides(prs, sites, period, date) {
    // Flatten into rows: client row + device sub-rows if >1 device
    const allRows = [];
    let globalClientIdx = 0;
    for (const site of sites) {
        globalClientIdx++;
        allRows.push({ type: 'client', site, idx: globalClientIdx });
        if (site.devices && site.devices.length > 1) {
            for (const dev of site.devices) {
                allRows.push({ type: 'device', dev });
            }
        }
    }

    const ROW_H    = 0.175;
    const PAGE_H   = 5.75;
    const MAX_ROWS = Math.floor(PAGE_H / ROW_H);
    const pages    = Math.ceil(allRows.length / MAX_ROWS);

    for (let p = 0; p < pages; p++) {
        const slide  = prs.addSlide();
        addBg(slide);
        const suffix = pages > 1 ? ` (${p + 1}/${pages})` : '';
        addHeader(slide, `${period} — Client Detail${suffix}`, `Availability per client · ${date}`);
        addFooter(slide, date);

        const chunk     = allRows.slice(p * MAX_ROWS, (p + 1) * MAX_ROWS);
        const headerRow = [
            { text: '#',               options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
            { text: 'Client / Device', options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
            { text: 'Location',        options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
            { text: 'Uptime h',        options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
            { text: 'Downtime h',      options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
            { text: 'Availability',    options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
        ];

        let altIdx = 0;
        const dataRows = chunk.map(row => {
            if (row.type === 'client') {
                altIdx++;
                const bg = altIdx % 2 === 0 ? C.offwhite : C.white;
                const s  = row.site;
                const deviceLabel = s.devices.length > 1 ? ` (${s.devices.length} devices)` : '';
                return [
                    { text: String(row.idx),            options: { fontSize: 8,   bold: true, color: C.midgray, fill: { color: bg }, align: 'center' } },
                    { text: s.clientName + deviceLabel, options: { fontSize: 8.5, bold: true, color: C.text,    fill: { color: bg } } },
                    { text: s.location || '—',          options: { fontSize: 8,   color: C.midgray, fill: { color: bg } } },
                    { text: String(s.uptime),           options: { fontSize: 8,   color: C.text,    fill: { color: bg }, align: 'center' } },
                    { text: String(s.downtime),         options: { fontSize: 8,   color: s.downtime > 0 ? C.red : C.text, fill: { color: bg }, align: 'center' } },
                    { text: `${s.availability}%`,       options: { fontSize: 8,   bold: true, color: availColor(s.availability), fill: { color: bg }, align: 'center' } },
                ];
            } else {
                // Device sub-row — indented, muted
                const d = row.dev;
                return [
                    { text: '',                   options: { fontSize: 7, fill: { color: C.devicebg } } },
                    { text: `  ↳ ${d.name}`,      options: { fontSize: 7.5, italic: true, color: C.midgray, fill: { color: C.devicebg } } },
                    { text: '',                   options: { fontSize: 7, fill: { color: C.devicebg } } },
                    { text: String(d.uptime),     options: { fontSize: 7.5, color: C.midgray, fill: { color: C.devicebg }, align: 'center' } },
                    { text: String(d.downtime),   options: { fontSize: 7.5, color: d.downtime > 0 ? 'E57373' : C.midgray, fill: { color: C.devicebg }, align: 'center' } },
                    { text: `${d.availability}%`, options: { fontSize: 7.5, color: availColor(d.availability), fill: { color: C.devicebg }, align: 'center' } },
                ];
            }
        });

        slide.addTable([headerRow, ...dataRows], {
            x: 0.3, y: 1.2, w: 9.4, h: PAGE_H,
            rowH: ROW_H, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri',
        });
    }
}

// ── Location Breakdown slides (one per period) ────────────
function addLocationSlides(prs, data, date) {
    const { activePeriods, periods } = data;

    for (const period of activePeriods) {
        const sites = periods[period]?.sites ?? [];

        // Group clients by location
        const locationMap = {};
        for (const site of sites) {
            const loc = site.location || 'Unknown';
            if (!locationMap[loc]) locationMap[loc] = [];
            locationMap[loc].push(site);
        }
        const sortedLocations = Object.keys(locationMap).sort();

        // Build flat row list: location header + client rows
        const allRows = [];
        for (const loc of sortedLocations) {
            const lSites    = locationMap[loc].sort((a, b) => b.availability - a.availability);
            const lAvgAvail = parseFloat((lSites.reduce((s, c) => s + c.availability, 0) / lSites.length).toFixed(1));
            const green     = lSites.filter(s => bandOf(s.availability) === 'green').length;
            const amber     = lSites.filter(s => bandOf(s.availability) === 'amber').length;
            const red       = lSites.filter(s => bandOf(s.availability) === 'red').length;
            allRows.push({ type: 'location', loc, count: lSites.length, avgAvail: lAvgAvail, green, amber, red });
            for (const site of lSites) {
                allRows.push({ type: 'client', site });
            }
        }

        const ROW_H    = 0.185;
        const PAGE_H   = 5.75;
        const MAX_ROWS = Math.floor(PAGE_H / ROW_H);

        // Simple paginate — keep location header with its first client if possible
        const pages = [];
        let cur = [], curCount = 0;
        for (const row of allRows) {
            if (curCount >= MAX_ROWS && cur.length) {
                pages.push(cur);
                cur = [];
                curCount = 0;
            }
            cur.push(row);
            curCount++;
        }
        if (cur.length) pages.push(cur);

        for (let pi = 0; pi < pages.length; pi++) {
            const slide  = prs.addSlide();
            addBg(slide);
            const suffix = pages.length > 1 ? ` (${pi + 1}/${pages.length})` : '';
            addHeader(slide, `Location Breakdown — ${period}${suffix}`, `Client availability by location · ${date}`, C.accent);
            addFooter(slide, date);

            slide.addShape('rect', { x: 0, y: 1.1, w: 0.12, h: 5.95, fill: { color: C.accent } });

            const headerRow = [
                { text: 'Location / Client', options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9 } },
                { text: 'Devices',           options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
                { text: 'G / A / R',         options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
                { text: 'Avg Uptime h',      options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
                { text: 'Avg Downtime h',    options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
                { text: 'Avg Avail.',        options: { bold: true, color: C.white, fill: { color: C.indigo }, fontSize: 9, align: 'center' } },
            ];

            let altIdx = 0;
            const dataRows = pages[pi].map(row => {
                if (row.type === 'location') {
                    // Location header row — dark band
                    return [
                        { text: row.loc,                              options: { bold: true, fontSize: 9.5, color: C.white, fill: { color: C.indigo } } },
                        { text: String(row.count),                    options: { bold: true, fontSize: 9,   color: C.white, fill: { color: C.indigo }, align: 'center' } },
                        { text: `${row.green} / ${row.amber} / ${row.red}`, options: { bold: true, fontSize: 9, color: C.white, fill: { color: C.indigo }, align: 'center' } },
                        { text: '',                                   options: { fill: { color: C.indigo } } },
                        { text: '',                                   options: { fill: { color: C.indigo } } },
                        { text: `${row.avgAvail}%`,                   options: { bold: true, fontSize: 9.5, color: availColorLight(row.avgAvail), fill: { color: C.indigo }, align: 'center' } },
                    ];
                } else {
                    altIdx++;
                    const bg = altIdx % 2 === 0 ? C.offwhite : C.white;
                    const s  = row.site;
                    const devCount = s.devices?.length ?? 1;
                    return [
                        { text: `  ${s.clientName}`,  options: { fontSize: 8.5, bold: true, color: C.text,    fill: { color: bg } } },
                        { text: String(devCount),      options: { fontSize: 8,   color: C.midgray, fill: { color: bg }, align: 'center' } },
                        { text: '',                    options: { fill: { color: bg } } },
                        { text: String(s.uptime),      options: { fontSize: 8,   color: C.text,    fill: { color: bg }, align: 'center' } },
                        { text: String(s.downtime),    options: { fontSize: 8,   color: s.downtime > 0 ? C.red : C.text, fill: { color: bg }, align: 'center' } },
                        { text: `${s.availability}%`,  options: { fontSize: 8,   bold: true, color: availColor(s.availability), fill: { color: bg }, align: 'center' } },
                    ];
                }
            });

            slide.addTable([headerRow, ...dataRows], {
                x: 0.3, y: 1.2, w: 9.4, h: PAGE_H,
                rowH: ROW_H, border: { type: 'solid', color: C.lightgray, pt: 0.3 }, fontFace: 'Calibri',
            });
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
console.log('Fetching data from Airtable...');
const [raw, cvRecords] = await Promise.all([
    fetchAll(TABLE),
    fetchAll(CV_TABLE),
]);
console.log(`  ${raw.length} uptime records, ${cvRecords.length} CV/device records loaded`);

const d = buildData(raw, cvRecords);
const { date, totalClients, totalDevices, overallAvgAvailability, periods, bandDetails, topPerformers, sitesNeedingAttention, activePeriods, locations } = d;

console.log(`  Date: ${date} | Clients: ${totalClients} | Devices: ${totalDevices} | Locations: ${locations.length}`);

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
    slide.addText(`${totalClients} clients  ·  ${totalDevices} devices  ·  ${locations.length} locations  ·  Sun – Fri`, {
        x: 0.4, y: 5.2, w: 12, h: 0.4, fontSize: 13, color: C.lightgray, fontFace: 'Calibri',
    });
}

// ─── Slide 2: Executive Summary ───────────────────────────
{
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, 'Executive Summary', `Network availability overview · ${date}`);
    addFooter(slide, date);

    statBox(slide, 0.3,  1.2, 2.1,  'TOTAL CLIENTS',    String(totalClients),         'monitored');
    statBox(slide, 2.55, 1.2, 2.1,  'TOTAL DEVICES',    String(totalDevices),         'in report');
    statBox(slide, 4.8,  1.2, 2.1,  'AVG AVAILABILITY', `${overallAvgAvailability}%`, 'all periods');
    statBox(slide, 7.05, 1.2, 2.25, 'LOCATIONS',        String(locations.length),     date);

    // Summary table — one row per period
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

// ─── Band slides (one per availability band) ──────────────
for (const band of BAND_DEFS) {
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(
        slide,
        `Availability Band: ${band.label}`,
        `Client uptime & downtime per period for this band · ${date}`,
        band.color
    );
    addFooter(slide, date);

    const periodData = activePeriods.map(p => bandDetails[band.key][p] ?? { count: 0, avgUptime: 0, avgDowntime: 0 });

    activePeriods.forEach((p, pi) => {
        statBox(slide, 0.3 + pi * 3.15, 1.2, 3.0,
            p.toUpperCase(),
            `${periodData[pi].count} clients`,
            `avg ${periodData[pi].avgUptime}h up · ${periodData[pi].avgDowntime}h dn`
        );
    });

    hoursChart(
        slide,
        activePeriods,
        periodData.map(d => d.avgUptime),
        periodData.map(d => d.avgDowntime),
        0.5, 2.65, 9.0, 4.15
    );

    slide.addShape('rect', { x: 0, y: 1.1, w: 0.12, h: 5.95, fill: { color: band.color } });
}

// ─── Location Breakdown slides (one per period) ───────────
addLocationSlides(prs, d, date);

// ─── Top Performers ───────────────────────────────────────
{
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, 'Top Performers — 100% Availability Across All Periods', `Full uptime every period · ${date}`);
    addFooter(slide, date);

    if (topPerformers.length === 0) {
        slide.addText('No clients achieved 100% availability across all periods.', {
            x: 0.5, y: 3.5, w: 9, h: 0.5, fontSize: 14, color: C.midgray, align: 'center', fontFace: 'Calibri',
        });
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
        slide.addText(`${topPerformers.length} clients with 100% availability across all periods`, {
            x: 0.3, y: 6.7, w: 9.4, h: 0.28, fontSize: 10, color: C.midgray, italic: true, fontFace: 'Calibri',
        });
    }
}

// ─── Per-period Client Detail slides ─────────────────────
for (const period of activePeriods) {
    addClientDetailSlides(prs, periods[period]?.sites ?? [], period, date);
}

// ─── Clients Requiring Attention ──────────────────────────
{
    const slide = prs.addSlide();
    addBg(slide);
    addHeader(slide, 'Clients Requiring Attention — Average Availability < 50%', `Consistently low-performing clients · ${date}`, C.red);
    addFooter(slide, date);

    if (sitesNeedingAttention.length === 0) {
        slide.addText('All clients are performing above 50% availability.', {
            x: 0.5, y: 3.5, w: 9, h: 0.5, fontSize: 14, color: C.green, align: 'center', fontFace: 'Calibri',
        });
    } else {
        const rows = [
            [
                { text: 'Client',     options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9 } },
                ...activePeriods.map(p => ({ text: p, options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9, align: 'center' } })),
                { text: 'Avg Avail.', options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 9, align: 'center' } },
            ],
            ...sitesNeedingAttention.map((s, i) => {
                const bg = i % 2 === 0 ? C.white : C.offwhite;
                return [
                    { text: s.name, options: { fontSize: 9, color: C.text, fill: { color: bg } } },
                    ...activePeriods.map(p => {
                        const v = s.periods[p];
                        return {
                            text: v ? `${v.uptime}h up / ${v.downtime}h dn (${v.availability}%)` : '—',
                            options: { fontSize: 8.5, color: v ? availColor(v.availability) : C.midgray, fill: { color: bg }, align: 'center' },
                        };
                    }),
                    { text: `${s.avgAvailability}%`, options: { fontSize: 9, bold: true, color: C.red, fill: { color: bg }, align: 'center' } },
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
