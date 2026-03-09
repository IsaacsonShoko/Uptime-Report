import fetch from 'node-fetch';

export default async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { date, names, timePeriod, uptimeHours } = req.body;

        if (!date || !names || !timePeriod || uptimeHours === undefined || uptimeHours === '') {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const hours = parseFloat(uptimeHours);
        if (isNaN(hours) || hours < 0 || hours > 24) {
            return res.status(400).json({ error: 'Uptime Hours must be a number between 0 and 24' });
        }

        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return res.status(500).json({ error: 'Missing Airtable credentials' });
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
        res.status(200).json({ success: true, record: result.records[0] });
    } catch (error) {
        console.error('Submit error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
