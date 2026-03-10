import fetch from 'node-fetch';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { records } = JSON.parse(event.body || '{}');

        if (!Array.isArray(records) || records.length === 0) {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'records array is required' }) };
        }

        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Airtable credentials' }) };
        }

        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;

        // Airtable allows max 10 records per request — chunk accordingly
        const chunks = [];
        for (let i = 0; i < records.length; i += 10) {
            chunks.push(records.slice(i, i + 10));
        }

        let saved = 0;
        for (const chunk of chunks) {
            const body = {
                records: chunk.map(r => ({
                    fields: {
                        Date:           r.date,
                        Names:          r.deviceName || r.name,
                        'Client Name':  r.clientName  || '',
                        Location:       r.location    || '',
                        'Time Period':  r.timePeriod,
                        'Uptime Hours': parseFloat(r.uptimeHours),
                    },
                })),
            };

            const res = await fetch(url, {
                method:  'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body:    JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.text();
                throw new Error(`Airtable error: ${err}`);
            }

            const result = await res.json();
            saved += (result.records || []).length;
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, saved }),
        };
    } catch (err) {
        console.error('batch-submit error:', err.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
    }
};
