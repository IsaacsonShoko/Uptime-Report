import fetch from 'node-fetch';

const PERIODS   = ['Sat to Sun', 'Sun to Mon', 'Tue to Wed', 'Thur to Fri'];
const CV_TABLE  = process.env.AIRTABLE_CV_TABLE_ID || 'tblujIggqfABKXFco';

function bandOf(pct) {
    if (pct >= 75) return 'green';
    if (pct >= 50) return 'amber';
    return 'red';
}

async function fetchAllRecords(apiKey, baseId, tableIdOrName) {
    const records = [];
    let offset = null;
    do {
        const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableIdOrName)}`);
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
    const allClients  = [...new Set(normalized.map(r => r.clientName))];
    const totalSites  = allClients.length;
    const totalDevices = [...new Set(normalized.map(r => r.deviceName))].length;
    const periods = {};

    for (const period of PERIODS) {
        const rows = normalized.filter(r => r.timePeriod === period);
        if (!rows.length) continue;

        // Latest record per device
        const deviceMap = {};
        for (const row of rows) {
            if (!deviceMap[row.deviceName] || row.date > deviceMap[row.deviceName].date) {
                deviceMap[row.deviceName] = row;
            }
        }
        const latestDevices = Object.values(deviceMap);

        // Group devices under clients
        const clientMap = {};
        for (const row of latestDevices) {
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

        // Build client-level site objects
        const sites = Object.values(clientMap).map(client => {
            const devs        = client.devices.sort((a, b) => a.name.localeCompare(b.name));
            const avgAvail    = parseFloat((devs.reduce((s, d) => s + d.availability, 0) / devs.length).toFixed(1));
            const avgUptime   = parseFloat((devs.reduce((s, d) => s + d.uptime,       0) / devs.length).toFixed(2));
            const avgDowntime = parseFloat((devs.reduce((s, d) => s + d.downtime,     0) / devs.length).toFixed(2));
            return {
                name:         client.clientName, // backward compat
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

        const avgAvailability  = parseFloat((sites.reduce((s, c) => s + c.availability, 0) / sites.length).toFixed(1));
        const avgUptimeHours   = parseFloat((sites.reduce((s, c) => s + c.uptime,       0) / sites.length).toFixed(2));
        const avgDowntimeHours = parseFloat((sites.reduce((s, c) => s + c.downtime,     0) / sites.length).toFixed(2));

        periods[period] = { count: sites.length, avgAvailability, avgUptimeHours, avgDowntimeHours, bands, sites };
    }

    // bandDetails
    const bandDetails = { green: {}, amber: {}, red: {} };
    for (const period of PERIODS) {
        if (!periods[period]) continue;
        for (const band of ['green', 'amber', 'red']) {
            const bs = periods[period].sites.filter(s => bandOf(s.availability) === band);
            if (!bs.length) { bandDetails[band][period] = { count: 0, avgUptime: 0, avgDowntime: 0 }; continue; }
            bandDetails[band][period] = {
                count:       bs.length,
                avgUptime:   parseFloat((bs.reduce((s, r) => s + r.uptime,   0) / bs.length).toFixed(2)),
                avgDowntime: parseFloat((bs.reduce((s, r) => s + r.downtime, 0) / bs.length).toFixed(2)),
            };
        }
    }

    const activePeriods  = PERIODS.filter(p => periods[p]);
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

    return { totalSites, totalDevices, overallAvgAvailability, periods, bandDetails, topPerformers, sitesNeedingAttention };
}

export const handler = async (event) => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Airtable credentials' }) };
        }

        const [raw, cvRecords] = await Promise.all([
            fetchAllRecords(apiKey, baseId, table),
            fetchAllRecords(apiKey, baseId, CV_TABLE),
        ]);

        // Build device → { clientName, location } map (case-insensitive key)
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

        const availableDates = [...new Set(normalized.map(r => r.date).filter(Boolean))].sort().reverse();
        const requestedDate  = event.queryStringParameters?.date || availableDates[0] || '';
        const filtered       = requestedDate ? normalized.filter(r => r.date === requestedDate) : normalized;

        const locations = [...new Set(normalized.map(r => r.location).filter(Boolean))].sort();
        const payload   = { date: requestedDate, availableDates, locations, ...aggregate(filtered) };

        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    } catch (err) {
        console.error('get-dashboard error:', err.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
    }
};
