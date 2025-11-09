# Grafana Integration Setup

GuardIT now supports both:
- **SSE Dashboard** (real-time, instant updates) at `http://192.168.1.44:3000`
- **Grafana** (historical data, alerts, mobile access) with 5-second refresh

## Quick Start

### 1. Install Grafana

**Windows:**
```powershell
# Download from: https://grafana.com/grafana/download?platform=windows
# Or use Chocolatey:
choco install grafana
```

**Docker (Recommended):**
```bash
docker run -d -p 3001:3000 --name=grafana grafana/grafana
```

Access Grafana at: `http://localhost:3001` (or `:3000` if not using Docker)
- Default login: `admin` / `admin`

### 2. Install JSON API Datasource Plugin

In Grafana:
1. Go to **Configuration** → **Plugins**
2. Search for **"JSON API"** or **"SimpleJson"**
3. Click **Install**

Or via CLI:
```bash
grafana-cli plugins install simpod-json-datasource
```

### 3. Add Datasource

**IMPORTANT**: Use the container name `guardit`, NOT the IP address!

1. Go to **Connections** → **Data sources** (or **Configuration** → **Data sources** in older versions)
2. Click **Add data source**
3. Search for **JSON API**
   - If you don't see it, install it first: **Administration** → **Plugins** → Search "JSON API" → Install
4. Configure:
   - **Name**: `GuardIT`
   - **URL**: `http://guardit:3000/grafana` ← **IMPORTANT: Use container name!**
   - Leave all other settings as default
5. Scroll down and click **Save & Test**
   - Should show green checkmark: "Data source is working"

**If you get an error**: Make sure you used `http://guardit:3000/grafana` (container name), NOT `http://192.168.1.44:3000/grafana`

### 4. Create Your First Dashboard - STEP BY STEP

#### Simple Status Panel (Recommended to Start)

**Step 1: Create Dashboard**
1. Click **Dashboards** (left sidebar) → **New** → **New Dashboard**
2. Click **+ Add visualization**
3. Select **GuardIT** as the data source

**Step 2: Configure Query**
1. You'll see a query editor at the bottom
2. In the **Metric** dropdown, select one of your servers (e.g., `WIN-VPK24EF28RB` or `TestServer`)
3. You should immediately see data appear!

**Step 3: Choose Visualization**
1. On the right side, find **Visualizations**
2. Select **Stat** (shows a big number with status)
3. The panel will update

**Step 4: Configure Panel**
1. **Panel title**: Click "Panel Title" at top, change to "Server Status"
2. **Refresh interval**: Top-right → Click the time picker → Set refresh to **5s**
3. Click **Apply** (top right) to save the panel

**Step 5: Add More Servers**
1. Click **Add** → **Visualization**
2. Repeat steps above for each server
3. Arrange panels by dragging them

#### Option A: Table View (All Servers at Once)

This shows ALL servers in one table:

1. Create new panel (+ Add visualization)
2. Select **GuardIT** datasource
3. In query editor, select **ANY** server (doesn't matter which)
4. Change visualization to **Table**
5. You'll see ALL servers with: Server | Status | Message | Progress | Last Update

**Note**: The table endpoint shows all servers regardless of which one you select in the query.

#### Option B: Status Graph (Timeline)

1. Create new dashboard → Add panel
2. Select **GuardIT** datasource
3. Select a server from dropdown
4. Visualization: **Time series** or **Stat**
5. Panel settings:
   - **Title**: "Server1 Backup Status"
   - **Refresh**: 5s

Status values:
- `100` = Completed
- `50` = Running
- `25` = Warning
- `0` = Failed/Error
- `-1` = No Data

#### Option C: Multi-Server View

1. Create dashboard → Add panel
2. Add multiple queries (one per server)
3. Visualization: **Bar gauge** or **Stat**
4. Shows all servers at once

### 5. Setup Alerts (Grafana 8+)

1. Edit a panel
2. Go to **Alert** tab
3. Create alert rule:
   - **Condition**: `WHEN last() OF query(A) IS BELOW 1`
   - **For**: 5m (backup failed for 5 minutes)
4. Configure notification channel:
   - Email
   - Slack
   - Discord
   - Teams
   - PagerDuty

Example alert: "Send email if any backup shows 'failed' status for > 5 minutes"

## API Endpoints Available

Your server now exposes these Grafana endpoints:

- `GET/POST /grafana` - Health check
- `POST /grafana/search` - List all servers
- `POST /grafana/query` - Time series data
- `POST /grafana/annotations` - Event markers (completed/failed backups)
- `POST /grafana/table` - Table view data

## Example Dashboard Panels

### Panel 1: Current Status (Stat)
- Query: Select server
- Visualization: Stat
- Thresholds:
  - Red: < 1 (failed)
  - Yellow: 25-49 (warning)
  - Blue: 50-99 (running)
  - Green: 100 (completed)

### Panel 2: All Servers Table
- Query: Any server (will show all)
- Visualization: Table
- Shows: Server, Status, Message, Progress, Last Update

### Panel 3: Progress Over Time
- Query: Select server
- Visualization: Time series
- Shows progress line graph

### Panel 4: Backup Events (Annotations)
- Enable annotations in dashboard settings
- Shows markers when backups complete or fail

## Tips

1. **Refresh Rate**: Set to 5s for near-real-time updates (good balance for backups)
2. **Use Both**: Keep SSE dashboard open during active monitoring, use Grafana for overview/alerts
3. **Mobile**: Grafana has official mobile apps (iOS/Android) for monitoring on-the-go
4. **History**: Add a database to store historical data (see Advanced section)

## Advanced: Persistent Storage

Currently, data is in-memory (resets on restart). To add history:

1. Install a time-series database:
   - **InfluxDB** (recommended for time-series)
   - **Prometheus** with Pushgateway
   - **PostgreSQL** (simple option)

2. Modify `server.js` to write to database on each status update

3. Configure Grafana to query the database instead

This gives you:
- Historical trends (backup times over weeks/months)
- Failure rate analysis
- Performance metrics

## Troubleshooting

**"Data source is not working"**
- Check URL: `http://192.168.1.44:3000/grafana`
- Verify server is running: `http://192.168.1.44:3000/api/health`
- Check firewall allows port 3000

**"No data in panels"**
- Make sure backup scripts have sent at least one status update
- Check `/api/status` shows data: `http://192.168.1.44:3000/api/status`
- Verify time range in Grafana includes recent data

**"Servers not showing in dropdown"**
- At least one backup must have reported status
- Try manual refresh in Grafana
- Check browser console for errors

## What You Get

✅ Real-time SSE dashboard for instant updates
✅ Grafana for historical analysis and pretty graphs
✅ Email/SMS/Slack alerts when backups fail
✅ Mobile app access to monitor backups anywhere
✅ Same PowerShell scripts (no changes needed)
✅ 5-second refresh in Grafana (perfect for backup monitoring)

Your PowerShell scripts don't need any changes - they still POST to the same endpoints!
