import fetch from 'node-fetch';

const TIME_PERIODS = ['Sun to Mon', 'Tue to Wed', 'Thur to Fri'];

export default async (req, res) => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return res.status(400).json({ error: 'Missing Airtable credentials' });
        }

        // Fetch all records, only the Names field
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

        res.status(200).json({
            names:       [...allNames].sort(),
            timePeriods: TIME_PERIODS,
        });
    } catch (error) {
        console.error('Error getting options:', error.message);
        res.status(500).json({ error: 'Failed to get options' });
    }
};
