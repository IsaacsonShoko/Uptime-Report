#!/usr/bin/env node

/**
 * Quick setup script for ISP Uptime Monitor
 * This script helps validate and prepare your environment
 */

const fs   = require('fs');
const path = require('path');

console.log('ISP Uptime Monitor - Setup Helper\n');

// Check Node version
const nodeVersion  = process.versions.node;
const majorVersion = parseInt(nodeVersion.split('.')[0]);
if (majorVersion < 16) {
    console.error(`Node.js 16+ required. Current: ${nodeVersion}`);
    process.exit(1);
}
console.log(`Node.js ${nodeVersion} detected\n`);

// Check if .env.local exists
const envPath        = path.join(__dirname, '.env.local');
const envExamplePath = path.join(__dirname, '.env.local.example');

if (!fs.existsSync(envPath)) {
    console.log('Creating .env.local from template...');
    const example = fs.readFileSync(envExamplePath, 'utf-8');
    fs.writeFileSync(envPath, example);
    console.log('.env.local created. Please edit it with your credentials.\n');
} else {
    console.log('.env.local already exists\n');
}

// Check for required Airtable fields
console.log('Checking environment configuration...\n');
const envContent  = fs.readFileSync(envPath, 'utf-8');
const isConfigured = {
    apiKey:  envContent.includes('AIRTABLE_API_KEY=') && !envContent.includes('your_airtable_personal_access_token'),
    baseId:  envContent.includes('AIRTABLE_BASE_ID=') && !envContent.includes('appXXXXXXXXXXXXXX'),
    table:   envContent.includes('AIRTABLE_TABLE_NAME='),
};

if (isConfigured.apiKey && isConfigured.baseId) {
    console.log('All Airtable credentials configured!\n');
} else {
    console.log('Missing credentials (edit .env.local):');
    if (!isConfigured.apiKey) console.log('   - AIRTABLE_API_KEY');
    if (!isConfigured.baseId) console.log('   - AIRTABLE_BASE_ID');
    if (!isConfigured.table)  console.log('   - AIRTABLE_TABLE_NAME');
    console.log();
}

// Check package.json
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
    console.log('package.json found\n');
    console.log('Next steps:');
    console.log('1. npm install                   # Install dependencies');
    console.log('2. npm run upload                # Upload UPTIME REPORT.xlsx to Airtable');
    console.log('3. npm run dev                   # Start development server');
    console.log('4. Open http://localhost:8888 in your browser\n');
} else {
    console.log('package.json not found\n');
}

console.log('For detailed setup instructions, see README.md');
