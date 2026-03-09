import fetch from 'node-fetch';

export default async (req, res) => {
    try {
        const { date, timePeriod } = req.query;

        if (!date || !timePeriod) {
            return res.status(400).json({ error: 'date and timePeriod are required' });
        }

        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return res.status(500).json({ error: 'Missing Airtable credentials' });
        }

        // Fetch all unique Names (to know total expected)
        const allNamesSet    = new Set();
        const capturedNames  = new Set();
        let offset           = null;

        // Single pass — get all records, collect all names + captured ones for this date/period
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

        const allNames       = [...allNamesSet].sort();
        const captured       = [...capturedNames].sort();
        const remaining      = allNames.filter(n => !capturedNames.has(n));

        res.status(200).json({
            total:     allNames.length,
            captured:  captured.length,
            remaining: remaining.length,
            capturedNames,   // names already done for this date/period
            remainingNames: remaining, // names still to capture
        });
    } catch (error) {
        console.error('Progress error:', error.message);
        res.status(500).json({ error: error.message });
    }
};
