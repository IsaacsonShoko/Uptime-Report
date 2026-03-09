import fetch from 'node-fetch';

const AIRTABLE_BASE_URL = 'https://api.airtable.com/v0';

async function checkConnectivity() {
    const startTime = Date.now();
    const targetUrl = process.env.TARGET_URL || 'https://8.8.8.8';

    try {
        const response = await fetch(targetUrl, { method: 'HEAD', timeout: 10000 });
        return {
            status: 'online',
            responseTime: Date.now() - startTime,
            statusCode: response.status,
        };
    } catch (error) {
        return {
            status: 'offline',
            responseTime: Date.now() - startTime,
            error: error.message,
        };
    }
}

async function writeToAirtable(data) {
    const apiKey   = process.env.AIRTABLE_API_KEY;
    const baseId   = process.env.AIRTABLE_BASE_ID;
    const table    = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

    if (!apiKey || !baseId) {
        console.warn('Missing Airtable credentials — skipping write');
        return;
    }

    const now      = new Date();
    const ispName  = process.env.ISP_PROVIDER_NAME || 'ISP Provider';
    const hours    = data.status === 'online'
        ? parseFloat((data.responseTime / 1000 / 3600).toFixed(6))
        : null;

    const body = {
        records: [{
            fields: {
                Names:  ispName,
                Date:   now.toISOString().split('T')[0],
                Time:   now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                Status: data.status,
                Hours:  hours,
            },
        }],
    };

    const res = await fetch(
        `${AIRTABLE_BASE_URL}/${baseId}/${encodeURIComponent(table)}`,
        {
            method: 'POST',
            headers: {
                Authorization:  `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Airtable write failed: ${err}`);
    }
}

export default async (req, res) => {
    try {
        const statusData = await checkConnectivity();

        try {
            await writeToAirtable(statusData);
        } catch (error) {
            console.error('Airtable write failed:', error.message);
        }

        res.status(200).json({
            status:       statusData.status,
            responseTime: statusData.responseTime,
            timestamp:    new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check status', message: error.message });
    }
};
