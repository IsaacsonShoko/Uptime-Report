import fetch from 'node-fetch';

const TIME_PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];
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

        // Location → names mapping from Name Conversions
        const namesByLocation = {};
        const locationSet = new Set();
        for (const r of cvRecords) {
            const device   = r.fields['DEVICE NAME']?.trim();
            const location = r.fields['LOCATION']?.name ?? r.fields['LOCATION'];
            if (device && location && location !== 'undefined') {
                if (!namesByLocation[location]) namesByLocation[location] = [];
                namesByLocation[location].push(device);
                locationSet.add(location);
            }
        }
        // Sort names within each location
        for (const loc of Object.keys(namesByLocation)) {
            namesByLocation[loc].sort();
        }
        const locations = [...locationSet].sort();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                names:           [...allNames].sort(),
                namesByLocation,
                locations,
                timePeriods:     TIME_PERIODS,
            }),
        };
    } catch (error) {
        console.error('Error getting options:', error.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to get options' }) };
    }
};
