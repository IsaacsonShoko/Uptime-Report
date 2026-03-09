# Scheduling Periodic ISP Checks

This guide explains how to set up automatic checks every 5 minutes (or any interval you prefer).

## Option 1: UptimeRobot (Easiest - Free)

[UptimeRobot](https://uptimerobot.com) can ping your endpoint periodically.

1. Go to https://uptimerobot.com and sign up (free tier included)
2. Click "+ Add New Monitor"
3. Select "HTTP(s)"
4. **URL**: `https://your-netlify-site.netlify.app/api/check-status`
5. **Monitoring Interval**: 5 minutes
6. Click "Create Monitor"

✅ Done! UptimeRobot will check your site every 5 minutes.

## Option 2: IFTTT (Very Easy - Free)

[IFTTT](https://ifttt.com) can create automations.

1. Go to https://ifttt.com and sign up
2. Click "Create" → New Applet
3. **If**: Choose "Schedule" → Select interval (5 minutes from "Every")
4. **Then**: Choose "Webhooks" → "Make a web request"
5. **URL**: `https://your-netlify-site.netlify.app/api/check-status`
6. **Method**: GET
7. Click "Create Action"

✅ Done! IFTTT will trigger checks on schedule.

## Option 3: GitHub Actions (Free, More Control)

Set up automatic checks using GitHub Actions if your repo is on GitHub.

Create `.github/workflows/monitor.yml`:

```yaml
name: ISP Uptime Monitor

on:
  schedule:
    # Run every 5 minutes
    - cron: '*/5 * * * *'
  workflow_dispatch: # Manual trigger

jobs:
  check-status:
    runs-on: ubuntu-latest
    steps:
      - name: Check ISP Status
        run: |
          curl -X GET https://your-netlify-site.netlify.app/api/check-status
```

✅ GitHub will run checks every 5 minutes automatically.

## Option 4: CloudFlare Worker (Advanced - Free)

If your domain uses CloudFlare, you can use Workers.

1. Go to CloudFlare dashboard
2. Workers → Create Service
3. Use this code:

```javascript
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      fetch('https://your-netlify-site.netlify.app/api/check-status')
    );
  }
};
```

4. Set trigger: Cron `*/5 * * * *` (every 5 minutes)

## Option 5: AWS CloudWatch Events (AWS Free Tier)

1. Go to AWS CloudWatch
2. Events → Rules → Create Rule
3. Schedule expression: `rate(5 minutes)`
4. Target: HTTPS endpoint → `https://your-netlify-site.netlify.app/api/check-status`

## Option 6: Manual Cron (Self-Hosted Linux)

If you have a Linux server, add to crontab:

```bash
crontab -e
```

Add this line:

```
*/5 * * * * curl https://your-netlify-site.netlify.app/api/check-status
```

## Recommended Setup

For most users, **UptimeRobot** is recommended because:
- ✅ Free tier is sufficient
- ✅ No code or configuration needed
- ✅ Also monitors your site availability
- ✅ Email alerts on downtime
- ✅ Detailed uptime reports

## Verification

After setting up scheduling, verify it's working:

1. Open your dashboard
2. Check if "Last updated" time advances
3. View your Google Sheet to confirm data is being written
4. Wait 5 minutes and refresh to see new entries

## Typical Data Pattern

With 5-minute intervals, you'll see:
- ~288 checks per day (24 hours × 12 checks/hour)
- ~2,016 checks per week
- ~8,640 checks per month

Your Google Sheet will grow with this data, which is captured in the statistics.

## Customizing Check Intervals

1. Edit the external service configuration (fewer checks = less data, but less precise)
2. Minimum recommended: 5 minutes
3. For less data: Can increase to 15, 30, or 60 minutes
4. Remember: More frequent checks = better accuracy, more data

## Troubleshooting

**Checks not happening?**
- Verify your Netlify site is deployed and accessible
- Test the endpoint manually: `curl https://your-site.netlify.app/api/check-status`
- Check the scheduling service logs/dashboard

**Data not appearing in Sheet?**
- Verify Google credentials are correct in Netlify environment variables
- Check that service account has Editor access to the Sheet
- Look at Netlify function logs for errors

**Too much data accumulating?**
- Increase check interval (e.g., 15 minutes instead of 5)
- Archive old data from Sheet (keep last 30-90 days)
- Use Google Sheets to set up retention policies
