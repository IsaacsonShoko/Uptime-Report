import fetch from 'node-fetch';

export const handler = async (event) => {
    try {
        const { date, timePeriod } = event.queryStringParameters || {};

        if (!date || !timePeriod) {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'date and timePeriod are required' }) };
        }

        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Airtable credentials' }) };
        }

        const allNamesSet   = new Set();
        const capturedNames = new Set();
        let offset          = null;

        do {
            const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
            url.searchParams.set('fields[]', 'Names');
            url.searchParams.set('fields[]', 'Date');
            url.searchParams.set('fields[]', 'Time Period');
            url.searchParams.set('pageSize', '100');
            if (offset) url.searchParams.set('offset', offset);

            const response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${apiKey}` },
            });

            if (!response.ok) throw new Error(`Airtable error: ${response.statusText}`);

            const data = await response.json();

            for (const record of data.records || []) {
                const f = record.fields;
                if (f.Names) {
                    allNamesSet.add(f.Names.trim());
                    if (f.Date === date && f['Time Period'] === timePeriod) {
                        capturedNames.add(f.Names.trim());
                    }
                }
            }

            offset = data.offset || null;
        } while (offset);

        const allNames  = [...allNamesSet].sort();
        const captured  = [...capturedNames].sort();
        const remaining = allNames.filter(n => !capturedNames.has(n));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                total:          allNames.length,
                captured:       captured.length,
                remaining:      remaining.length,
                capturedNames:  captured,
                remainingNames: remaining,
            }),
        };
    } catch (error) {
        console.error('Progress error:', error.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
    }
};
