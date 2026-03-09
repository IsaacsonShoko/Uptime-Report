import fetch from 'node-fetch';

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { date, names, timePeriod, uptimeHours } = JSON.parse(event.body || '{}');

        if (!date || !names || !timePeriod || uptimeHours === undefined || uptimeHours === '') {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing required fields' }) };
        }

        const hours = parseFloat(uptimeHours);
        if (isNaN(hours) || hours < 0 || hours > 24) {
            return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Uptime Hours must be a number between 0 and 24' }) };
        }

        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Missing Airtable credentials' }) };
        }

        const body = {
            records: [{
                fields: {
                    Date:           date,
                    Names:          names,
                    'Time Period':  timePeriod,
                    'Uptime Hours': hours,
                },
            }],
        };

        const airtableRes = await fetch(
            `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
            {
                method: 'POST',
                headers: {
                    Authorization:  `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        if (!airtableRes.ok) {
            const err = await airtableRes.text();
            throw new Error(`Airtable error: ${err}`);
        }

        const result = await airtableRes.json();
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true, record: result.records[0] }) };
    } catch (error) {
        console.error('Submit error:', error.message);
        return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message }) };
    }
};
