import fetch from 'node-fetch';

function calculateStats(records) {
    if (!records || records.length === 0) {
        return { uptime: 0, outageCount: 0, avgDowntime: 0, longestOutage: 0 };
    }

    let onlineCount  = 0;
    let offlineCount = 0;

    for (const record of records) {
        const hours    = record.fields?.Hours;
        const isOnline = hours !== null && hours !== undefined;
        if (isOnline) onlineCount++;
        else          offlineCount++;
    }

    const total       = records.length;
    const uptime      = Math.round((onlineCount / total) * 100);
    const avgDowntime = offlineCount > 0 ? Math.round(offlineCount * 5) : 0;

    return { uptime, outageCount: offlineCount, avgDowntime, longestOutage: avgDowntime };
}

export default async (req, res) => {
    try {
        const apiKey = process.env.AIRTABLE_API_KEY;
        const baseId = process.env.AIRTABLE_BASE_ID;
        const table  = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

        if (!apiKey || !baseId) {
            return res.status(400).json({
                error: 'Missing Airtable credentials',
                uptime: 0, outageCount: 0, avgDowntime: 0, longestOutage: 0,
            });
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const filterDate = sevenDaysAgo.toISOString().split('T')[0];

        const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
        url.searchParams.set('filterByFormula', `IS_AFTER({Date}, '${filterDate}')`);

        const response = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
            throw new Error(`Airtable read failed: ${response.statusText}`);
        }

        const data  = await response.json();
        const stats = calculateStats(data.records || []);

        res.status(200).json(stats);
    } catch (error) {
        console.error('Error getting stats:', error.message);
        res.status(500).json({
            error: 'Failed to get statistics',
            uptime: 0, outageCount: 0, avgDowntime: 0, longestOutage: 0,
        });
    }
};
