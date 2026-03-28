import fetch from 'node-fetch';

const TIME_PERIODS = ['Sat to Sun', 'Sun to Mon', 'Tue to Wed', 'Thur to Fri'];
const CV_TABLE     = process.env.AIRTABLE_CV_TABLE_ID || 'tblujIggqfABKXFco';

export const handler = async () => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Airtable credentials' }) };
        }

        async function fetchAll(tableId) {
            const records = [];
            let offset = null;
            do {
                const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
                url.searchParams.set('pageSize', '100');
                if (offset) url.searchParams.set('offset', offset);
                const res  = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
                if (!res.ok) throw new Error(`Airtable error: ${res.statusText}`);
                const data = await res.json();
                records.push(...(data.records || []));
                offset = data.offset || null;
            } while (offset);
            return records;
        }

        // Fetch timesheets (for flat names list) and name conversions (for location cascade) in parallel
        const [tsRecords, cvRecords] = await Promise.all([
            fetchAll(table),
            fetchAll(CV_TABLE),
        ]);

        // Flat list of all unique names from Timesheets
        const allNames = new Set();
        tsRecords.forEach(r => {
            const n = r.fields?.Names?.trim();
            if (n) allNames.add(n);
        });

        // Build location/client/device maps from Name Conversions
        const namesByLocation    = {};  // location → [deviceNames]  (legacy)
        const clientsByLocation  = {};  // location → [clientNames]
        const devicesByClient    = {};  // clientName → [deviceNames]
        const locationSet        = new Set();

        for (const r of cvRecords) {
            const device     = r.fields['DEVICE NAME']?.trim();
            const clientName = r.fields['CLIENT NAME']?.trim();
            const location   = r.fields['LOCATION']?.name ?? r.fields['LOCATION'];
            if (!device) continue;
            if (location && location !== 'undefined') {
                if (!namesByLocation[location])   namesByLocation[location]   = [];
                if (!clientsByLocation[location]) clientsByLocation[location] = [];
                namesByLocation[location].push(device);
                if (clientName && !clientsByLocation[location].includes(clientName))
                    clientsByLocation[location].push(clientName);
                locationSet.add(location);
            }
            if (clientName) {
                if (!devicesByClient[clientName]) devicesByClient[clientName] = [];
                devicesByClient[clientName].push(device);
            }
        }
        // Sort all arrays
        for (const loc of Object.keys(namesByLocation))   namesByLocation[loc].sort();
        for (const loc of Object.keys(clientsByLocation)) clientsByLocation[loc].sort();
        for (const cn  of Object.keys(devicesByClient))   devicesByClient[cn].sort();
        const locations = [...locationSet].sort();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                names:            [...allNames].sort(),
                namesByLocation,
                clientsByLocation,
                devicesByClient,
                locations,
                timePeriods:      TIME_PERIODS,
            }),
        };
    } catch (error) {
        console.error('Error getting options:', error.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to get options' }) };
    }
};
