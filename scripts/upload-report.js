#!/usr/bin/env node
/**
 * Upload UPTIME FINALIZED.xlsx to Airtable
 *
 * Unpivots: Names × [Sun to Mon, Tue to Wed, Thur to Fri] → individual rows
 * Airtable fields written: Date, Names, Time Period, Uptime Hours
 * (Downtime Hours is auto-calculated by Airtable: 24 - Uptime Hours)
 *
 * Usage:
 *   node scripts/upload-report.js 2026-03-08
 *   node scripts/upload-report.js            ← defaults to today
 */

import XLSX from 'xlsx';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Load .env.local
try {
    const envFile = readFileSync(join(projectRoot, '.env.local'), 'utf-8');
    for (const line of envFile.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !(key in process.env)) process.env[key] = val;
    }
} catch { /* env vars may already be in shell */ }

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE   = process.env.AIRTABLE_TABLE_NAME || 'Uptime Report';

// Column map: Excel key → Airtable "Time Period" value
const TIME_PERIOD_MAP = {
    '__EMPTY':   'Sun to Mon',
    '__EMPTY_1': 'Tue to Wed',
    '__EMPTY_2': 'Thur to Fri',
};

// Parse "8 HOURS", "24 hours", "24 ours" → 8 / 24 / 24
function parseHours(raw) {
    if (raw === null || raw === undefined) return null;
    const num = parseFloat(String(raw).match(/[\d.]+/)?.[0]);
    return isNaN(num) ? null : Math.min(num, 24); // cap at 24
}

function parseXlsx(filePath) {
    const wb    = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
}

function unpivot(rows, captureDate) {
    const records = [];

    for (const row of rows) {
        const name = String(row['UPTIME NETWORK PERFOMANCES'] ?? '').trim();

        // Skip the sub-header row (first row where name === "NMAE")
        if (!name || name.toUpperCase() === 'NMAE') continue;

        for (const [colKey, timePeriod] of Object.entries(TIME_PERIOD_MAP)) {
            if (!(colKey in row)) continue;
            const uptimeHours = parseHours(row[colKey]);
            records.push({
                Date:           captureDate,
                Names:          name,
                'Time Period':  timePeriod,
                'Uptime Hours': uptimeHours,
            });
        }
    }

    return records;
}

async function uploadBatch(records) {
    const url   = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE)}`;
    const BATCH = 10;
    let created = 0;

    for (let i = 0; i < records.length; i += BATCH) {
        const body = {
            records: records.slice(i, i + BATCH).map(fields => ({ fields })),
        };

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization:  `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Batch ${Math.floor(i / BATCH) + 1} failed: ${err}`);
        }

        const json = await res.json();
        created += json.records.length;
        process.stdout.write(`  Batch ${Math.floor(i / BATCH) + 1}: ${json.records.length} records uploaded\n`);
    }

    return created;
}

async function main() {
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        console.error('Error: AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set in .env.local');
        process.exit(1);
    }

    // Date: from CLI arg or today
    const captureDate = process.argv[2] || new Date().toISOString().split('T')[0];
    console.log(`Capture date: ${captureDate}`);

    const xlsxPath = join(projectRoot, 'UPTIME FINALIZED.xlsx');
    console.log(`Reading: ${xlsxPath}`);

    const rows = parseXlsx(xlsxPath);
    console.log(`Parsed ${rows.length} raw row(s) from Excel`);

    const records = unpivot(rows, captureDate);
    console.log(`Unpivoted to ${records.length} Airtable record(s)\n`);

    if (records.length === 0) {
        console.warn('No records to upload. Check the Excel file structure.');
        process.exit(0);
    }

    // Preview first 3
    console.log('Preview (first 3 records):');
    records.slice(0, 3).forEach(r => console.log(' ', JSON.stringify(r)));
    console.log('');

    const total = await uploadBatch(records);
    console.log(`\nDone! Created ${total} record(s) in Airtable.`);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
