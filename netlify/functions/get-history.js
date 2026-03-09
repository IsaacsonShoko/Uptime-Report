import fetch from 'node-fetch';

export const handler = async (event) => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Airtable credentials' }) };
        }

        const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
        url.searchParams.set('maxRecords', '50');
        url.searchParams.set('sort[0][field]', 'Date');
        url.searchParams.set('sort[0][direction]', 'desc');

        const response = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
            throw new Error(`Airtable read failed: ${response.statusText}`);
        }

        const data = await response.json();

        const history = (data.records || []).map(record => {
            const f      = record.fields;
            const hours  = f.Hours;
            const isOnline = hours !== null && hours !== undefined;
            return {
                date:   f.Date   || '',
                name:   f.Names  || '',
                time:   f.Time   || f['Time Period'] || '',
                hours:  isOnline ? String(hours) : '-',
                status: f.Status || (isOnline ? 'online' : 'offline'),
            };
        });

        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(history) };
    } catch (error) {
        console.error('Error getting history:', error.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Failed to get history' }) };
    }
};
