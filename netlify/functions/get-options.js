import fetch from 'node-fetch';

const TIME_PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

export const handler = async () => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Airtable credentials' }) };
        }

        let allNames = new Set();
        let offset   = null;

        do {
            const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
            url.searchParams.set('fields[]', 'Names');
            url.searchParams.set('pageSize', '100');
            if (offset) url.searchParams.set('offset', offset);

            const response = await fetch(url.toString(), {
                headers: { Authorization: `Bearer ${apiKey}` },
            });

            if (!response.ok) throw new Error(`Airtable error: ${response.statusText}`);

            const data = await response.json();
            (data.records || []).forEach(r => {
                if (r.fields?.Names) allNames.add(String(r.fields.Names).trim());
            });
            offset = data.offset || null;
        } while (offset);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ names: [...allNames].sort(), timePeriods: TIME_PERIODS }),
        };
    } catch (error) {
        console.error('Error getting options:', error.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to get options' }) };
    }
};
