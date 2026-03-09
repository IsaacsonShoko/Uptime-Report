# 📡 ISP Uptime Monitor

A simple web application that monitors ISP availability and downtime, logging all data to a Google Spreadsheet. Built for Netlify deployment with serverless functions.

## Features

- **Real-time Status Monitoring**: Checks ISP connectivity every 5 minutes
- **Automatic Data Logging**: Writes results to Google Sheets automatically
- **Uptime Statistics**: Calculates 7-day uptime percentage, outage count, and average downtime
- **Beautiful Dashboard**: Clean, responsive web interface
- **Netlify Deployment**: Zero-config deployment to Netlify

## Project Structure

```
Uptime Report/
├── public/
│   └── index.html          # Frontend dashboard
├── netlify/
│   └── functions/
│       ├── check-status.js # Connectivity check function
│       ├── get-stats.js    # Statistics calculation
│       └── get-history.js  # History retrieval
├── package.json
├── netlify.toml
└── .env.local.example
```

## Setup Instructions

### 1. Prerequisites

- Node.js 16+ and npm
- Google Cloud project with Sheets API enabled
- Netlify account (for deployment)

### 2. Google Sheets Setup

#### Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. Create a Service Account:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Fill in the details and click "Create and Continue"
   - Skip optional steps and click "Done"

5. Create a Key:
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose "JSON" and click "Create"
   - Save the JSON file securely

#### Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet named "ISP Uptime Report"
3. In the first row, add headers:
   - A1: `Date`
   - B1: `Names`
   - C1: `Time Period`
   - D1: `Hours`

   Example data format:
   ```
   Date        | Names     | Time Period | Hours
   03/08/2026  | Comcast   | 3:45 PM    | 0.0125
   03/08/2026  | Comcast   | 3:50 PM    | -
   ```

4. Share the sheet with your service account email (from the JSON key):
   - Click "Share"
   - Paste the service account email
   - Give it "Editor" access

5. Copy the Sheet ID from the URL (it's the ID between `/d/` and `/edit`)

### 3. Local Setup

1. Clone or navigate to this directory
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file:
   ```bash
   cp .env.local.example .env.local
   ```

4. Edit `.env.local` and fill in your credentials:
   ```
   VITE_GOOGLE_SHEET_ID=your_sheet_id_here
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY=your_private_key_here_with_newlines_as_\n
   ISP_PROVIDER_NAME=Comcast
   ```

   **⚠️ Important**: For the `GOOGLE_PRIVATE_KEY`:
   - Copy the entire private key from the JSON file (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`)
   - Replace all newlines with `\n` (literal backslash-n)
   
   **ISP_PROVIDER_NAME**: Set this to your ISP provider (e.g., "Comcast", "Verizon", "AT&T")

5. Start development server:
   ```bash
   npm run dev
   ```

6. Open `http://localhost:8888` in your browser

### 4. Deployment to Netlify

#### Option A: Using Netlify CLI

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Create a new site:
   ```bash
   netlify init
   ```

4. Deploy:
   ```bash
   netlify deploy --prod
   ```

#### Option B: GitHub + Netlify

1. Push this repository to GitHub
2. Connect your GitHub repository to Netlify:
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Select your repository
   - Leave build settings as is (uses `netlify.toml`)
   - Click "Deploy"

3. Add environment variables in Netlify:
   - Go to Site settings → Build & deploy → Environment
   - Add the same environment variables from `.env.local`:
     - `VITE_GOOGLE_SHEET_ID`
     - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
     - `GOOGLE_PRIVATE_KEY`
     - `ISP_PROVIDER_NAME`

### 5. Configure Monitoring

Edit `.env.local` to customize:

```env
# ISP Provider Name (recorded in Google Sheets)
ISP_PROVIDER_NAME=Comcast

# Change the target URL (default: 8.8.8.8)
TARGET_URL=https://example.com

# Change check interval (milliseconds, default: 300000 = 5 minutes)
ISP_CHECK_INTERVAL=300000

# Optional: Add gateway IP monitoring
GATEWAY_IP=192.168.1.1
```

## How It Works

1. **Frontend**: Clean dashboard built with HTML/CSS/JS, shows current status and statistics
2. **Check Function**: Periodically pings a target URL (default: Google DNS)
3. **Data Logging**: Each check result is automatically written to your Google Sheet
4. **Statistics**: Calculates uptime percentage and outage patterns from the data
5. **History**: Displays recent status checks and trends

## API Endpoints

### GET `/api/check-status`
Performs a connectivity check and writes to Google Sheets
```json
{
  "status": "online",
  "responseTime": 45,
  "timestamp": "2024-03-08T15:30:00.000Z"
}
```
**Google Sheet Format**:
- Date: 03/08/2026
- Names: Comcast
- Time Period: 3:30 PM
- Hours: 0.0000125 (response time converted to hours, or "-" if offline)

### GET `/api/get-stats`
Returns 7-day uptime statistics
```json
{
  "uptime": 99.5,
  "outageCount": 2,
  "avgDowntime": 15,
  "longestOutage": 30
}
```

### GET `/api/get-history`
Returns recent status checks from Google Sheets
```json
[
  {
    "date": "03/08/2026",
    "name": "Comcast",
    "time": "3:00 PM",
    "hours": "0.0000125",
    "status": "online"
  },
  {
    "date": "03/08/2026",
    "name": "Comcast",
    "time": "2:55 PM",
    "hours": "-",
    "status": "offline"
  }
]
```

## Monitoring Configuration

### Scheduled Checks on Netlify

To run checks automatically on a schedule (e.g., every 5 minutes), you can:

1. Use IFTTT or Zapier to ping your `/api/check-status` endpoint
2. Use a third-party monitoring service to trigger checks
3. Deploy a separate CloudFlare Worker to call your endpoint

Example using cron (external service):
```
*/5 * * * * curl https://your-site.netlify.app/api/check-status
```

## Troubleshooting

### "Missing Google credentials" error
- Ensure `.env.local` has `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY`
- Check that the private key has `\n` for newlines

### Google Sheets write failing
- Verify you shared the sheet with the service account email
- Check that the sheet has headers in the first row
- Ensure the service account has Editor access

### Checks returning offline
- Verify the `TARGET_URL` is accessible from Netlify's servers
- Check network connectivity and firewall rules
- Try pinging the target URL manually from command line

### Environment variables not loading
- Restart the dev server after editing `.env.local`
- On Netlify, redeploy after adding environment variables

## Cost Considerations

- **Google Sheets API**: Free up to 500 requests per 100 seconds
- **Netlify**: Free tier supports serverless functions
- **This app**: Well within free tier limits

## Future Enhancements

- [ ] Email/SMS alerts on outages
- [ ] Multiple ISP monitoring
- [ ] Historical graphs and charts
- [ ] Webhook integration for incident services
- [ ] Mobile app notifications
- [ ] Advanced analytics dashboard

## License

MIT
