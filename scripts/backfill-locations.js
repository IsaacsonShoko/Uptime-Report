/**
 * backfill-locations.js
 *
 * 1. Fixes confirmed spelling errors in the Names field of Timesheets
 * 2. Backfills the Location field from the Name Conversions table
 *
 * Run: node scripts/backfill-locations.js
 * Dry run (no writes): node scripts/backfill-locations.js --dry-run
 */

import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env.local manually
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../.env.local');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.+)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const API_KEY  = process.env.AIRTABLE_API_KEY;
const BASE_ID  = process.env.AIRTABLE_BASE_ID;
const TS_TABLE = 'tblRRwc0BvsTMl4vU';   // Timesheets
const CV_TABLE = 'tblujIggqfABKXFco';   // Name Conversions

const DRY_RUN  = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('\n⚠️  DRY RUN — no changes will be written\n');

// ── Confirmed name corrections (sheet value -> canonical device name) ──────
const NAME_FIXES = {
  // Case fixes
  'T3-HR-Psv-E60i-02':              'T3-HR-PSV-E60i-02',
  'T3-HR-SPR-L009-Tow':             'T3-HR-SPR-L009-TOW',
  'T4-HA-RouI-TIK-01':              'T4-HA-ROUI-TIK-01',
  // Spelling / character fixes
  'T1-BS-SPR-MSH-L22UGS-06':        'T1-BS-SPR-MESH-L22UGS-06',   // missing E
  'T1-BS-SPR-MTS-L22UG-04':         'T1-BS-SPR-MTS-L22UGS-04',    // missing S
  'T1-CN-TERACO-BORDER-CCR-01':     'T1-CN-TERACO-BOARDER-CCR-01', // as per conversions
  'T3-HR-Ins-L009-01':              'T3-HR-INS--L009-01',          // case + double dash
  'T3-HR-SCR-E50ua-SCHOK':          'T3-HR-SCR-E50UG-SCHOK',       // ua -> UG
  'T3-HR-SPR-ESOUG-STVN':           'T3-HR-SPR-E50UG-STVN',        // letter O -> digit 0
  'T2-VIP-KAYA-LANE-E5OUG-O1':     'T2-VIP-KAYA-LANE-E50UG',      // digit/letter mix
  // Underscore -> dash
  'T4-HA_STVM-01':                  'T4-HA-STVM-01',
  'T4_HA-FW-MHL-01':                'T4-HA-FW-MHL-01',
  'T4_HA-SPR-BZC-04':               'T4-HA-SPR-BZC-04',
  // Wrong tier prefix
  'T3-BS-SPR-LAU-L22UGS-02':        'T1-BS-SPR-LAU-L22UGS-02',
  'T3-VIP-UAE-AMBASSADOR-AP-01':    'T2-VIP-UAE-AMBASSADOR-01',
  'T1-BS_SPR-LAU-FW-L22UGS-07':    'T1-BS-SPR-FW-L22UGS-07',
  'T4-BS-SPR-L22UGS-08':            'T1-BS-SPR-FW-L22UGS-08',
};

// ── Helpers ───────────────────────────────────────────────────────────────
async function fetchAll(tableId) {
  const records = [];
  let offset = null;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`Airtable fetch error: ${JSON.stringify(body)}`);
    records.push(...(body.records || []));
    offset = body.offset || null;
  } while (offset);
  return records;
}

async function patchRecords(tableId, updates) {
  // updates: array of { id, fields }
  // Airtable allows max 10 per PATCH
  const chunks = [];
  for (let i = 0; i < updates.length; i += 10) chunks.push(updates.slice(i, i + 10));

  let saved = 0;
  for (const chunk of chunks) {
    if (DRY_RUN) { saved += chunk.length; continue; }
    const res  = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ records: chunk }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`Airtable patch error: ${JSON.stringify(body)}`);
    saved += (body.records || []).length;
    // Respect rate limit
    await new Promise(r => setTimeout(r, 250));
  }
  return saved;
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log('Fetching tables…');
const [timesheets, conversions] = await Promise.all([
  fetchAll(TS_TABLE),
  fetchAll(CV_TABLE),
]);
console.log(`  Timesheets: ${timesheets.length} records`);
console.log(`  Name Conversions: ${conversions.length} records`);

// Build device -> location map (canonical device name -> location string)
const deviceToLocation = {};
for (const r of conversions) {
  const device   = r.fields['DEVICE NAME']?.trim();
  const location = r.fields['LOCATION']?.name ?? r.fields['LOCATION'];
  if (device && location && location !== 'undefined') {
    deviceToLocation[device] = location;
  }
}

// Also index by uppercase for case-insensitive lookup
const deviceToLocationUpper = {};
for (const [k, v] of Object.entries(deviceToLocation)) {
  deviceToLocationUpper[k.toUpperCase()] = { canonical: k, location: v };
}

// ── Build update list ─────────────────────────────────────────────────────
const updates  = [];
const skipped  = [];
let nameFixed  = 0;
let locFilled  = 0;

for (const record of timesheets) {
  const currentName = record.fields['Names']?.trim() || '';
  const currentLoc  = record.fields['Location'] || '';
  const fields      = {};

  // Step 1: determine canonical name (apply fix if needed)
  let canonicalName = currentName;
  if (NAME_FIXES[currentName]) {
    canonicalName = NAME_FIXES[currentName];
    fields['Names'] = canonicalName;
    nameFixed++;
  }

  // Step 2: look up location using canonical name (case-insensitive)
  const entry = deviceToLocationUpper[canonicalName.toUpperCase()];
  if (entry && !currentLoc) {
    fields['Location'] = entry.location;
    locFilled++;
  }

  if (Object.keys(fields).length > 0) {
    updates.push({ id: record.id, fields });
  } else if (!entry) {
    skipped.push(currentName);
  }
}

// ── Report ────────────────────────────────────────────────────────────────
console.log(`\n── Changes planned ──────────────────────────`);
console.log(`  Name corrections:  ${nameFixed} records`);
console.log(`  Location backfill: ${locFilled} records`);
console.log(`  Total updates:     ${updates.length} records`);

const uniqueSkipped = [...new Set(skipped)].sort();
console.log(`\n── Skipped (no match in conversions) ────────`);
uniqueSkipped.forEach(n => console.log(`  "${n}"`));

if (updates.length === 0) {
  console.log('\nNothing to update.');
  process.exit(0);
}

// Sample of what will change
console.log('\n── Sample of updates (first 10) ─────────────');
updates.slice(0, 10).forEach(u => {
  console.log(`  ${u.id}:`, JSON.stringify(u.fields));
});

if (DRY_RUN) {
  console.log('\n✅ Dry run complete — no data was changed.');
  process.exit(0);
}

// ── Execute ───────────────────────────────────────────────────────────────
console.log(`\nWriting ${updates.length} updates to Airtable…`);
const saved = await patchRecords(TS_TABLE, updates);
console.log(`\n✅ Done — ${saved} records updated.`);
