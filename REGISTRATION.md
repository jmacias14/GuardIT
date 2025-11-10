# GuardIT Server Registration Guide

This guide explains how to register backup servers with GuardIT and send status updates.

## Manual Server Registration via API

### 1. Register a New Server

Send a POST request to `/api/servers/register`:

```bash
curl -X POST http://localhost:3000/api/servers/register \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "prod-server-01",
    "displayName": "Production Server 1",
    "ipAddress": "192.168.1.100",
    "description": "Main backup server"
  }'
```

**Response:**
```json
{
  "id": 1,
  "server_id": "prod-server-01",
  "display_name": "Production Server 1",
  "description": "Main backup server",
  "ip_address": "192.168.1.100",
  "is_active": true,
  "last_seen": null,
  "created_at": "2025-11-09T10:30:00Z",
  "updated_at": "2025-11-09T10:30:00Z"
}
```

### 2. Send Status Updates

Once registered, the server can send status updates:

```bash
curl -X POST http://localhost:3000/api/status/prod-server-01 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "running",
    "message": "Backup in progress",
    "progress": 45
  }'
```

**Supported Status Values:**
- `running` - Backup is in progress
- `completed` - Backup completed successfully
- `failed` - Backup failed
- `error` - An error occurred
- `warning` - Warning condition
- `unknown` - Unknown status

### 3. Get All Registered Servers

```bash
curl http://localhost:3000/api/servers
```

**Response:**
```json
[
  {
    "id": 1,
    "server_id": "prod-server-01",
    "display_name": "Production Server 1",
    "description": "Main backup server",
    "ip_address": "192.168.1.100",
    "is_active": true,
    "last_seen": "2025-11-09T10:35:00Z",
    "created_at": "2025-11-09T10:30:00Z",
    "updated_at": "2025-11-09T10:30:00Z"
  }
]
```

### 4. Get Specific Server Details

```bash
curl http://localhost:3000/api/servers/prod-server-01
```

### 5. Update Server Information

```bash
curl -X PUT http://localhost:3000/api/servers/prod-server-01 \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Production Server 1 - Updated",
    "description": "Main backup server - Updated",
    "isActive": true
  }'
```

### 6. Delete a Server

```bash
curl -X DELETE http://localhost:3000/api/servers/prod-server-01
```

## PowerShell Client Script

A PowerShell script is provided to simplify registration and status updates.

### Register a Server

```powershell
# Navigate to the scripts directory
cd .\scripts\

# Register a new server
.\guardit-client.ps1 -Action Register `
  -ServerID "prod-server-01" `
  -DisplayName "Production Server 1" `
  -Description "Main backup server" `
  -GuardITURL "http://guardit-server:3000"
```

### Send Status Updates

```powershell
# Send a status update during backup
.\guardit-client.ps1 -Action Status `
  -ServerID "prod-server-01" `
  -Status "running" `
  -Message "Backup in progress - 45% complete" `
  -Progress 45 `
  -GuardITURL "http://guardit-server:3000"

# Backup completed
.\guardit-client.ps1 -Action Status `
  -ServerID "prod-server-01" `
  -Status "completed" `
  -Message "Backup completed successfully" `
  -Progress 100 `
  -GuardITURL "http://guardit-server:3000"

# Backup failed
.\guardit-client.ps1 -Action Status `
  -ServerID "prod-server-01" `
  -Status "failed" `
  -Message "Backup failed: insufficient disk space" `
  -Progress 30 `
  -GuardITURL "http://guardit-server:3000"
```

## Integration with Backup Scripts

### Example: Windows Backup Script Integration

```powershell
# Include the GuardIT client functions
. "C:\GuardIT\scripts\guardit-client.ps1"

# Your backup logic here
try {
    # Start backup
    Send-StatusUpdate -ServerID "prod-server-01" `
        -Status "running" `
        -Message "Starting backup..." `
        -Progress 0 `
        -GuardITURL "http://guardit-server:3000"

    # Perform backup operations
    $backupSize = 0
    # ... your backup code ...

    # Report progress
    Send-StatusUpdate -ServerID "prod-server-01" `
        -Status "running" `
        -Message "Backup in progress..." `
        -Progress 50 `
        -GuardITURL "http://guardit-server:3000"

    # Finish backup
    Send-StatusUpdate -ServerID "prod-server-01" `
        -Status "completed" `
        -Message "Backup completed: $backupSize GB" `
        -Progress 100 `
        -GuardITURL "http://guardit-server:3000"
}
catch {
    Send-StatusUpdate -ServerID "prod-server-01" `
        -Status "failed" `
        -Message "Backup failed: $_" `
        -Progress 0 `
        -GuardITURL "http://guardit-server:3000"
    exit 1
}
```

## Server Registration Best Practices

1. **Unique Server IDs**: Use descriptive, unique server identifiers (e.g., `prod-db-01`, `backup-nas-01`)

2. **IP Address**: Register the static IP address from which the server will send updates. This helps with network security and tracking.

3. **Display Names**: Use human-readable display names that will be shown in the GuardIT dashboard.

4. **Status Updates**: Send status updates at regular intervals and especially at state transitions (started, progress updates, completed, failed).

5. **Error Handling**: Always report failures with descriptive error messages for troubleshooting.

## Database Schema

The registration system uses the following database tables:

### Servers Table
- `id` - Primary key
- `server_id` - Unique server identifier (VARCHAR)
- `display_name` - Human-readable server name
- `description` - Optional server description
- `ip_address` - Registered IP address for validation
- `is_active` - Boolean flag to enable/disable server
- `last_seen` - Timestamp of last status update
- `created_at` - Registration timestamp
- `updated_at` - Last modification timestamp

### Status History Table
- `id` - Primary key
- `server_id` - References servers.server_id
- `status` - Current backup status
- `message` - Status message
- `progress` - Progress percentage (0-100)
- `data` - Optional JSON data
- `timestamp` - When the status was recorded
- `last_update` - Last update timestamp

### Daily Metrics Table
- `id` - Primary key
- `server_id` - References servers.server_id
- `date` - Date of metrics
- `total_runs` - Total backup runs that day
- `successful_runs` - Successful backups that day
- `failed_runs` - Failed backups that day
- `avg_duration` - Average backup duration
- `uptime_percentage` - Daily uptime percentage
- `created_at` - Metrics creation timestamp

## Troubleshooting

### Server Not Found Error
```json
{"error": "Server not registered"}
```
Make sure you register the server first using the `/api/servers/register` endpoint.

### Server Not Active Error
```json
{"error": "Server is not active"}
```
The server is registered but has `is_active` set to false. Update it with the PUT endpoint to reactivate.

### IP Address Already Registered Error
```json
{"error": "IP address already registered for another server"}
```
Each IP can only be registered once. Use a unique IP for each server or contact the admin to update the registration.
