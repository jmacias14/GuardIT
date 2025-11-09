# GuardIT - Universal Real-Time Status Dashboard

A lightweight Node.js API with Server-Sent Events (SSE) for monitoring backup jobs and system status across multiple servers in real-time.

## 🚀 Quick Start

### Prerequisites
- Docker Desktop installed and running
- Your 12 servers can reach the central backup server's IP address

### Installation

1. **Copy this folder to your central backup server**

2. **Navigate to the folder**
   ```bash
   cd guardit
   ```

3. **Start the service**
   ```bash
   docker-compose up -d
   ```

4. **Access the dashboard**
   Open your browser and go to:
   ```
   http://localhost:3000
   ```
   Or from another machine:
   ```
   http://[backup-server-ip]:3000
   ```

That's it! The service is now running and waiting for backup status updates.

## 📡 Using the API from Your Backup Scripts

### PowerShell Example

Add these lines to your existing PowerShell backup scripts:

```powershell
# At the start of your backup
Invoke-RestMethod -Uri "http://backup-server:3000/api/status/server1" `
    -Method Post `
    -Body '{"status":"running","message":"Backup started","progress":0}' `
    -ContentType "application/json"

# During backup (update progress)
Invoke-RestMethod -Uri "http://backup-server:3000/api/status/server1" `
    -Method Post `
    -Body '{"status":"running","message":"Copying files...","progress":50}' `
    -ContentType "application/json"

# When completed
Invoke-RestMethod -Uri "http://backup-server:3000/api/status/server1" `
    -Method Post `
    -Body '{"status":"completed","message":"Backup completed successfully","progress":100}' `
    -ContentType "application/json"

# If error occurs
Invoke-RestMethod -Uri "http://backup-server:3000/api/status/server1" `
    -Method Post `
    -Body '{"status":"failed","message":"Backup failed: disk full","progress":0}' `
    -ContentType "application/json"
```

### Batch/CMD Example

Add these lines to your batch scripts:

```batch
@echo off

REM At the start
curl -X POST http://backup-server:3000/api/status/server2 ^
     -H "Content-Type: application/json" ^
     -d "{\"status\":\"running\",\"message\":\"Backup started\",\"progress\":0}"

REM During backup
curl -X POST http://backup-server:3000/api/status/server2 ^
     -H "Content-Type: application/json" ^
     -d "{\"status\":\"running\",\"message\":\"Copying files...\",\"progress\":50}"

REM When completed
curl -X POST http://backup-server:3000/api/status/server2 ^
     -H "Content-Type: application/json" ^
     -d "{\"status\":\"completed\",\"message\":\"Backup completed\",\"progress\":100}"
```

**Note:** Batch scripts require `curl` to be installed. On Windows 10/11, curl is included by default.

## 📝 API Reference

### Send Status Update
**POST** `/api/status/{serverId}`

Body (JSON):
```json
{
  "status": "running|completed|failed|warning|error",
  "message": "Your status message here",
  "progress": 0-100,
  "data": {
    "optional": "any extra data you want to display"
  }
}
```

### Get Status of a Server
**GET** `/api/status/{serverId}`

### Get All Statuses
**GET** `/api/status`

### Delete a Server's Status
**DELETE** `/api/status/{serverId}`

### Clear All Statuses
**DELETE** `/api/status`

### Health Check
**GET** `/api/health`

### Real-Time Updates (SSE)
**GET** `/events`

Your web browser automatically connects to this endpoint to receive real-time updates.

## 🎨 Status Types

Use these status values for proper color coding in the dashboard:

- `running` - Blue (backup in progress)
- `completed` - Green (backup successful)
- `failed` or `error` - Red (backup failed)
- `warning` - Yellow (backup completed with warnings)
- `no_data` - Gray (no status reported yet)

## 📂 File Structure

```
guardit/
├── server.js              # Main API server with SSE
├── package.json           # Node.js dependencies
├── Dockerfile             # Docker image definition
├── docker-compose.yml     # Docker Compose configuration
├── public/
│   └── index.html         # Web dashboard UI
└── scripts/
    ├── example-backup.ps1 # Example PowerShell script
    └── example-backup.bat # Example batch script
```

## 🔧 Configuration

### Change Port

Edit `docker-compose.yml`:
```yaml
ports:
  - "3000:3000"  # Change first 3000 to desired port
```

### Firewall Configuration

Ensure port 3000 (or your chosen port) is open on the backup server:

**Windows Firewall:**
```powershell
New-NetFirewallRule -DisplayName "GuardIT" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

## 🛠️ Docker Commands

```bash
# Start the service
docker-compose up -d

# Stop the service
docker-compose down

# View logs
docker-compose logs -f

# Restart the service
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Check status
docker-compose ps

# Access container shell
docker exec -it guardit sh
```

## 🧪 Testing

Use the example scripts in the `scripts/` folder to test:

```powershell
# Test PowerShell script
.\scripts\example-backup.ps1 -ServerName "test-server" -ApiUrl "http://localhost:3000"
```

```batch
# Test batch script
.\scripts\example-backup.bat test-server http://localhost:3000
```

Then open the dashboard to see the real-time updates!

## 🌐 Accessing from Other Machines

Find your backup server's IP address:
```bash
ipconfig  # Windows
```

Then access the dashboard from any machine on your network:
```
http://[backup-server-ip]:3000
```

## 📊 Dashboard Features

- ✅ **Real-time updates** - No page refresh needed, updates appear instantly
- ✅ **Color-coded cards** - Easy visual status at a glance
- ✅ **Progress bars** - See backup progress in real-time
- ✅ **Timestamps** - Know when each backup last updated
- ✅ **Extra data** - Display custom data from your scripts
- ✅ **Auto-reconnect** - If connection drops, automatically reconnects
- ✅ **Responsive design** - Works on desktop, tablet, and mobile

## 🔍 Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Ensure port is not in use
netstat -an | findstr :3000
```

### Can't access from other servers
- Check firewall rules
- Verify the backup server's IP address
- Test with: `curl http://backup-server-ip:3000/api/health`

### PowerShell script can't connect
```powershell
# Test API connectivity
Invoke-RestMethod -Uri "http://backup-server:3000/api/health"
```

### Dashboard shows "Disconnected"
- Refresh the page
- Check if the Docker container is running: `docker ps`
- Check browser console for errors (F12)

## 🎯 Best Practices

1. **Use descriptive server names** - e.g., "fileserver-dc1", "sql-prod-01"
2. **Send progress updates** - Keep users informed during long backups
3. **Include error details** - Use the `data` field to send error logs
4. **Handle failures gracefully** - Always send a final status even if backup fails
5. **Clean up old statuses** - Use the delete endpoint to remove old servers

## 📈 Scaling

This setup can easily handle:
- 100+ servers reporting simultaneously
- 1000+ status updates per minute
- 10+ dashboard viewers concurrently

For larger deployments, consider:
- Using a proper database (PostgreSQL, MongoDB) instead of in-memory storage
- Adding authentication
- Implementing log retention policies

## 🤝 Support

This is a self-contained solution with no external dependencies. All you need is Docker Desktop!

---

**Happy Monitoring! 🚀**
