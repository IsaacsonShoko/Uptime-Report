# ISP Uptime Monitor

A weekly network availability reporting tool. Upload Excel reports to Airtable, visualise client uptime across periods and locations on a React dashboard, and export a formatted PowerPoint presentation — all deployed on Netlify.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React + Vite (SPA) |
| Serverless API | Netlify Functions (Node.js ESM) |
| Data store | Airtable (two tables) |
| PPT export | PptxGenJS (client-side, browser) |
| Hosting | Netlify |

## Project Structure

```
Uptime Report/
├── netlify/functions/
│   ├── get-dashboard.js   # Main API — aggregates Airtable data for the React app
│   ├── get-options.js     # Returns client & device lists for the capture form
│   ├── submit-record.js   # Writes a single capture-form entry to Airtable
│   ├── batch-submit.js    # Bulk write (used by the upload script)
│   ├── get-progress.js    # Upload progress polling
│   ├── get-stats.js       # Legacy stats endpoint
│   ├── get-history.js     # Legacy history endpoint
│   └── check-status.js    # Legacy connectivity check
├── src/
│   ├── App.jsx            # Root — header, tab nav, location/date filters, PPT button
│   ├── components/
│   │   ├── KPICards.jsx        # Summary stat cards
│   │   ├── OverviewCharts.jsx  # Bar/area charts
│   │   ├── BandTab.jsx         # Green / Amber / Red band detail
│   │   ├── LocationsTab.jsx    # Location × period matrix + client drill-down
│   │   ├── AttentionTable.jsx  # Clients < 50% avg availability
│   │   └── TopPerformers.jsx   # Clients at 100%
│   └── utils/
│       └── generatePpt.js  # Client-side PPT generation (dynamically imported)
├── public/
│   ├── index.html          # Vite SPA entry point
│   └── capture/
│       └── index.html      # Vanilla HTML capture form (served at /capture)
├── scripts/
│   └── upload-report.js    # One-shot: parses UPTIME REPORT.xlsx → Airtable
├── netlify.toml
├── vite.config.js
└── .env.local.example
```

## Airtable Setup

Two tables are required in your Airtable base.

### 1. Uptime Report table (`AIRTABLE_TABLE_NAME`)

| Field | Type | Notes |
|---|---|---|
| `Name` | Text | Device identifier |
| `Time Period` | Text | `Sun to Mon`, `Tue to Wed`, `Thur to Fri` |
| `Hours` | Number | Uptime hours for the period |
| `Date` | Date | `YYYY-MM-DD` — the report week |

### 2. Name Conversions table (`AIRTABLE_CV_TABLE_ID`)

Maps device names to clients and locations.

| Field | Type |
|---|---|
| `DEVICE NAME` | Text |
| `CLIENT NAME` | Text |
| `LOCATION` | Text |

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
AIRTABLE_API_KEY=your_personal_access_token
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_TABLE_NAME=tblXXXXXXXXXXXXXX   # Uptime Report table ID or name
AIRTABLE_CV_TABLE_ID=tblXXXXXXXXXXXXXX  # Name Conversions table ID
```

On Netlify, add these under **Site settings → Environment variables**.

## Local Development

```bash
npm install
cp .env.local.example .env.local
# fill in .env.local
npm run dev        # starts Netlify Dev on http://localhost:8888
```

## Uploading a Weekly Report

Place your Excel file (named `UPTIME REPORT.xlsx`) in the project root, then:

```bash
npm run upload
```

The script unpivots the wide Excel format (one column per time period) into individual Airtable rows.

## Dashboard

The React dashboard at `/` provides:

- **Overview** — KPI cards + bar/area charts
- **Green / Amber / Red** tabs — clients grouped by availability band (≥75%, 50–74%, <50%)
- **Locations** — location × period matrix; click a row to see per-client breakdown
- **Attention** — clients averaging below 50%

Use the **Location** and **Report Date** dropdowns in the header to filter. Click **Export PPT** to generate a PowerPoint report for the selected date — no server call, generated entirely in the browser.

## Capture Form

A lightweight data-entry form lives at `/capture`. It lets you select a client and device, then submit uptime hours for a given period directly to Airtable.

## Deployment

Connect the repository to Netlify. Build settings are defined in `netlify.toml`:

- Build command: `vite build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

All `/api/*` requests are proxied to `/.netlify/functions/:splat`.

## License

MIT
