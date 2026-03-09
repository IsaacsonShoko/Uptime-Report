import fetch from 'node-fetch';

const PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

function bandOf(pct) {
    if (pct >= 75) return 'green';
    if (pct >= 50) return 'amber';
    return 'red';
}

async function fetchAllRecords(apiKey, baseId, table) {
    const records = [];
    let offset = null;
    do {
        const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
        url.searchParams.set('pageSize', '100');
        if (offset) url.searchParams.set('offset', offset);
        const res  = await fetch(url.toString(), { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!res.ok) throw new Error(`Airtable ${res.status}: ${res.statusText}`);
        const body = await res.json();
        records.push(...(body.records || []));
        offset = body.offset || null;
    } while (offset);
    return records;
}

function aggregate(normalized) {
    const allNames   = [...new Set(normalized.map(r => r.name))];
    const totalSites = allNames.length;
    const periods    = {};

    for (const period of PERIODS) {
        const rows = normalized.filter(r => r.timePeriod === period);
        if (!rows.length) continue;

        const siteMap = {};
        for (const row of rows) {
            if (!siteMap[row.name] || row.date > siteMap[row.name].date) siteMap[row.name] = row;
        }
        const latest = Object.values(siteMap);
        const bands  = { green: 0, amber: 0, red: 0 };
        const sites  = latest.map(row => {
            const avail = parseFloat(((row.uptimeHours / 24) * 100).toFixed(1));
            bands[bandOf(avail)]++;
            return { name: row.name, uptime: row.uptimeHours, downtime: row.downtime, availability: avail };
        }).sort((a, b) => b.availability - a.availability);

        const avgAvailability  = parseFloat((latest.reduce((s, r) => s + (r.uptimeHours / 24) * 100, 0) / latest.length).toFixed(1));
        const avgUptimeHours   = parseFloat((latest.reduce((s, r) => s + r.uptimeHours, 0) / latest.length).toFixed(2));
        const avgDowntimeHours = parseFloat((latest.reduce((s, r) => s + r.downtime,     0) / latest.length).toFixed(2));

        periods[period] = { count: latest.length, avgAvailability, avgUptimeHours, avgDowntimeHours, bands, sites };
    }

    const bandDetails = { green: {}, amber: {}, red: {} };
    for (const period of PERIODS) {
        if (!periods[period]) continue;
        for (const band of ['green', 'amber', 'red']) {
            const bandSites = periods[period].sites.filter(s => bandOf(s.availability) === band);
            if (!bandSites.length) { bandDetails[band][period] = { count: 0, avgUptime: 0, avgDowntime: 0 }; continue; }
            bandDetails[band][period] = {
                count:      bandSites.length,
                avgUptime:  parseFloat((bandSites.reduce((s, r) => s + r.uptime,    0) / bandSites.length).toFixed(2)),
                avgDowntime:parseFloat((bandSites.reduce((s, r) => s + r.downtime,  0) / bandSites.length).toFixed(2)),
            };
        }
    }

    const activePeriods  = PERIODS.filter(p => periods[p]);
    const siteByPeriod   = {};
    for (const period of activePeriods) {
        for (const s of periods[period].sites) {
            if (!siteByPeriod[s.name]) siteByPeriod[s.name] = {};
            siteByPeriod[s.name][period] = s.availability;
        }
    }
    const topPerformers = allNames.filter(n => {
        const a = siteByPeriod[n] || {};
        return activePeriods.every(p => a[p] != null && a[p] >= 100);
    }).sort();

    const sitesNeedingAttention = allNames.map(n => {
        const a    = siteByPeriod[n] || {};
        const vals = activePeriods.map(p => a[p]).filter(v => v != null);
        if (!vals.length) return null;
        const avgAvailability = parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1));
        if (avgAvailability >= 50) return null;
        const periodsDetail = {};
        for (const period of activePeriods) {
            const site = (periods[period]?.sites || []).find(s => s.name === n);
            if (site) periodsDetail[period] = { uptime: site.uptime, downtime: site.downtime, availability: site.availability };
        }
        return { name: n, avgAvailability, periods: periodsDetail };
    }).filter(Boolean).sort((a, b) => a.avgAvailability - b.avgAvailability);

    const allAvails = activePeriods.flatMap(p => (periods[p]?.sites || []).map(s => s.availability));
    const overallAvgAvailability = allAvails.length
        ? parseFloat((allAvails.reduce((s, v) => s + v, 0) / allAvails.length).toFixed(1))
        : 0;

    return { totalSites, overallAvgAvailability, periods, bandDetails, topPerformers, sitesNeedingAttention };
}

export const handler = async (event) => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Airtable credentials' }) };
        }

        const raw = await fetchAllRecords(apiKey, baseId, table);

        const normalized = raw.map(r => {
            const f           = r.fields || {};
            const uptimeHours = f['Uptime Hours'] != null ? Number(f['Uptime Hours']) : f['Hours'] != null ? Number(f['Hours']) : null;
            if (uptimeHours == null) return null;
            const timePeriod  = f['Time Period'] || f['Time'] || '';
            const name        = (f['Names'] || f['Name'] || '').trim();
            const date        = f['Date'] || '';
            if (!name || !PERIODS.includes(timePeriod)) return null;
            return { date, name, timePeriod, uptimeHours, downtime: Math.max(0, 24 - uptimeHours) };
        }).filter(Boolean);

        const availableDates = [...new Set(normalized.map(r => r.date).filter(Boolean))].sort().reverse();
        const requestedDate  = event.queryStringParameters?.date || availableDates[0] || '';
        const filtered       = requestedDate ? normalized.filter(r => r.date === requestedDate) : normalized;

        const payload = { date: requestedDate, availableDates, ...aggregate(filtered) };

        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    } catch (err) {
        console.error('get-dashboard error:', err.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
    }
};
