# Grafana Quick Start - 5 Minute Setup

## Your Setup
- **GuardIT Dashboard**: http://192.168.1.44:3000
- **Grafana**: http://192.168.1.44:3002
- **Login**: `admin` / `admin`

## Step 1: Add Data Source (2 minutes)

1. Open http://192.168.1.44:3002
2. Login with `admin` / `admin`
3. Go to **Connections** → **Data sources**
4. Click **Add data source**
5. Search for **"JSON API"**
   - **If not found**: Go to **Administration** → **Plugins** → Search "JSON API" → Click it → Click **Install**
   - Then go back to **Connections** → **Data sources** → **Add data source** → **JSON API**
6. Fill in:
   ```
   Name: GuardIT
   URL: http://guardit:3000/grafana
   ```
7. Click **Save & Test** → Should show green checkmark

**CRITICAL**: Must use `http://guardit:3000/grafana` (container name), NOT the IP address!

## Step 2: Create Simple Dashboard (3 minutes)

### Option A: Single Server Panel

1. Click **Dashboards** (left menu) → **New** → **New Dashboard**
2. Click **+ Add visualization**
3. Select **GuardIT** data source
4. **In the query section** (bottom of screen):
   - Look for **Metric** dropdown
   - Click it → You'll see your servers listed
   - Select one (e.g., `WIN-VPK24EF28RB` or `TestServer`)
5. **On the right side**:
   - Find **Visualizations** panel
   - Click **Stat** (shows a big number)
6. Click **Apply** (top-right corner)
7. Click **Save dashboard** (disk icon, top-right)

**To add more servers**: Click **Add** → **Visualization** and repeat

### Option B: Table with All Servers

1. **Dashboards** → **New** → **New Dashboard**
2. **+ Add visualization**
3. Select **GuardIT**
4. In query: Select any server (doesn't matter which)
5. **Right side** → Change visualization to **Table**
6. You'll see ALL servers in one table!
7. Click **Apply** → **Save dashboard**

## Step 3: Set Auto-Refresh

1. Top-right corner → Click the refresh dropdown (🔄)
2. Select **5s** (refreshes every 5 seconds)
3. Save dashboard

## Current Test Data

You should see these servers:
- `WIN-VPK24EF28RB` - Status: completed (100%)
- `TestServer` - Status: running (75%)

## Troubleshooting

**"No data" in Grafana**:
1. Check data exists: http://192.168.1.44:3000/api/status (should show JSON)
2. Check datasource URL is `http://guardit:3000/grafana` (container name!)
3. Make sure you selected a server in the **Metric** dropdown
4. Try clicking **Run query** button in query editor

**"Cannot connect to data source"**:
- You used IP address instead of container name
- Change URL to: `http://guardit:3000/grafana`

**Can't find JSON API plugin**:
- Go to **Administration** → **Plugins** → Search "JSON API"
- Or try "SimpleJson" as alternative name
- Click Install, then go back to add data source

## Test Your PowerShell Script

Run your test script to see live updates in Grafana:

```powershell
.\test.ps1
```

Watch both dashboards:
- Real-time SSE: http://192.168.1.44:3000 (instant updates)
- Grafana: http://192.168.1.44:3002 (5-second refresh)

## What Each Visualization Type Shows

- **Stat**: Big number showing status value (0-100)
  - 100 = Completed
  - 50 = Running
  - 0 = Failed
  - Shows progress percentage

- **Table**: All servers in a table
  - Server name
  - Status (text)
  - Message
  - Progress (%)
  - Last update time

- **Time series**: Graph showing status over time
  - Good for seeing trends
  - See when backups complete/fail

## Next Steps

Once you have a basic dashboard:
1. Set up alerts (Administration → Alerting)
2. Create multiple dashboards for different views
3. Add mobile app for on-the-go monitoring
4. Customize thresholds and colors

See [GRAFANA_SETUP.md](GRAFANA_SETUP.md) for advanced configuration!
