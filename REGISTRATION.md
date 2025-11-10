# GuardIT Backup Task Registration Guide

This guide explains how to register backup tasks with GuardIT and send status updates.

## Task-Based Architecture

GuardIT uses a **task-based** system where each backup script is registered with a unique semantic identifier (task ID). This allows you to:
- Monitor multiple backup tasks per server
- Group tasks by type (database, file copy, verification, etc.)
- Track individual task status independently
- Organize your backup ecosystem flexibly

## Manual Task Registration via API

### 1. Register a New Backup Task

Send a POST request to `/api/tasks/register`:

```bash
curl -X POST http://localhost:3000/api/tasks/register \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "prod-01-db",
    "displayName": "Production Server 1 - Database Backup",
    "taskType": "database",
    "description": "Daily SQL Server full backup"
  }'
```

**Response:**
```json
{
  "id": 1,
  "task_id": "prod-01-db",
  "display_name": "Production Server 1 - Database Backup",
  "description": "Daily SQL Server full backup",
  "task_type": "database",
  "server_id": null,
  "is_active": true,
  "last_seen": null,
  "created_at": "2025-11-09T10:30:00Z",
  "updated_at": "2025-11-09T10:30:00Z"
}
```

### 2. Send Status Updates

Once registered, your script can send status updates:

```bash
curl -X POST http://localhost:3000/api/status/prod-01-db \
  -H "Content-Type: application/json" \
  -d '{
    "status": "running",
    "message": "Backup in progress",
    "progress": 45
  }'
```

**Supported Status Values:**
- `running` - Task is in progress
- `completed` - Task completed successfully
- `failed` - Task failed
- `error` - An error occurred
- `warning` - Warning condition
- `unknown` - Unknown status

### 3. Get All Registered Tasks

```bash
curl http://localhost:3000/api/tasks
```

**Response:**
```json
[
  {
    "id": 1,
    "task_id": "prod-01-db",
    "display_name": "Production Server 1 - Database Backup",
    "task_type": "database",
    "server_id": null,
    "is_active": true,
    "last_seen": "2025-11-09T10:35:00Z",
    "created_at": "2025-11-09T10:30:00Z",
    "updated_at": "2025-11-09T10:30:00Z"
  },
  {
    "id": 2,
    "task_id": "prod-01-copy",
    "display_name": "Production Server 1 - Copy to NAS",
    "task_type": "copy",
    "server_id": null,
    "is_active": true,
    "last_seen": "2025-11-09T10:40:00Z",
    "created_at": "2025-11-09T10:32:00Z",
    "updated_at": "2025-11-09T10:32:00Z"
  }
]
```

### 4. Get Tasks by Type

```bash
curl http://localhost:3000/api/tasks/type/database
```

Returns all tasks with `task_type = "database"`.

### 5. Get Specific Task Details

```bash
curl http://localhost:3000/api/tasks/prod-01-db
```

### 6. Update Task Information

```bash
curl -X PUT http://localhost:3000/api/tasks/prod-01-db \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Production Server 1 - Database Backup (Updated)",
    "description": "Daily SQL Server full backup with compression",
    "isActive": true
  }'
```

### 7. Delete a Task

```bash
curl -X DELETE http://localhost:3000/api/tasks/prod-01-db
```

## PowerShell Client Script

A PowerShell script is provided to simplify registration and status updates.

### Register a Task

```powershell
cd .\scripts\

# Register a database backup task
.\guardit-client.ps1 -Action Register `
  -TaskID "prod-01-db" `
  -DisplayName "Production Server 1 - Database Backup" `
  -TaskType "database" `
  -Description "Daily SQL Server full backup" `
  -GuardITURL "http://guardit-server:3000"

# Register a copy task
.\guardit-client.ps1 -Action Register `
  -TaskID "prod-01-copy" `
  -DisplayName "Production Server 1 - Copy to NAS" `
  -TaskType "copy" `
  -Description "Copy backup to NAS storage" `
  -GuardITURL "http://guardit-server:3000"
```

### Send Status Updates

```powershell
# Task starting
.\guardit-client.ps1 -Action Status `
  -TaskID "prod-01-db" `
  -Status "running" `
  -Message "Database backup starting..." `
  -Progress 0 `
  -GuardITURL "http://guardit-server:3000"

# Task in progress
.\guardit-client.ps1 -Action Status `
  -TaskID "prod-01-db" `
  -Status "running" `
  -Message "Backup in progress - 45% complete" `
  -Progress 45 `
  -GuardITURL "http://guardit-server:3000"

# Task completed
.\guardit-client.ps1 -Action Status `
  -TaskID "prod-01-db" `
  -Status "completed" `
  -Message "Database backup completed successfully" `
  -Progress 100 `
  -GuardITURL "http://guardit-server:3000"

# Task failed
.\guardit-client.ps1 -Action Status `
  -TaskID "prod-01-db" `
  -Status "failed" `
  -Message "Backup failed: insufficient disk space" `
  -Progress 30 `
  -GuardITURL "http://guardit-server:3000"
```

## Integration with Backup Scripts

### Example: Windows Backup Script Integration

```powershell
# backup-script.ps1

# Configuration - Set these at the top of your script
$TASK_ID = "prod-01-db"
$GUARDIT_URL = "http://guardit-server:3000"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# Source the GuardIT client functions
. "$SCRIPT_DIR\guardit-client.ps1"

# Your backup logic here
try {
    # Notify that backup is starting
    & "$SCRIPT_DIR\guardit-client.ps1" -Action Status `
        -TaskID $TASK_ID `
        -Status "running" `
        -Message "Starting backup..." `
        -Progress 0 `
        -GuardITURL $GUARDIT_URL

    # Perform your backup operations
    Write-Host "Performing backup..."
    Start-Sleep -Seconds 2  # Replace with actual backup code

    # Report progress
    & "$SCRIPT_DIR\guardit-client.ps1" -Action Status `
        -TaskID $TASK_ID `
        -Status "running" `
        -Message "Backup in progress - 50% complete" `
        -Progress 50 `
        -GuardITURL $GUARDIT_URL

    # Continue backup...
    Start-Sleep -Seconds 2

    # Report completion
    & "$SCRIPT_DIR\guardit-client.ps1" -Action Status `
        -TaskID $TASK_ID `
        -Status "completed" `
        -Message "Backup completed successfully" `
        -Progress 100 `
        -GuardITURL $GUARDIT_URL

    Write-Host "✓ Backup completed"
}
catch {
    Write-Error "Backup failed: $_"

    # Report failure to GuardIT
    & "$SCRIPT_DIR\guardit-client.ps1" -Action Status `
        -TaskID $TASK_ID `
        -Status "failed" `
        -Message "Backup failed: $_" `
        -Progress 0 `
        -GuardITURL $GUARDIT_URL

    exit 1
}
```

### Multiple Tasks in One Script

If your script handles multiple backup tasks, you can send updates for each:

```powershell
# Multi-task backup script
$GUARDIT_URL = "http://guardit-server:3000"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# Task 1: Database Backup
$TASK_DB = "prod-01-db"

# Task 2: Copy to NAS
$TASK_COPY = "prod-01-copy"

try {
    # ===== Database Backup =====
    & "$SCRIPT_DIR\guardit-client.ps1" -Action Status `
        -TaskID $TASK_DB `
        -Status "running" `
        -Message "Starting database backup..." `
        -Progress 0 `
        -GuardITURL $GUARDIT_URL

    # ... perform database backup ...

    & "$SCRIPT_DIR\guardit-client.ps1" -Action Status `
        -TaskID $TASK_DB `
        -Status "completed" `
        -Message "Database backup completed" `
        -Progress 100 `
        -GuardITURL $GUARDIT_URL

    # ===== Copy to NAS =====
    & "$SCRIPT_DIR\guardit-client.ps1" -Action Status `
        -TaskID $TASK_COPY `
        -Status "running" `
        -Message "Starting copy to NAS..." `
        -Progress 0 `
        -GuardITURL $GUARDIT_URL

    # ... perform copy operation ...

    & "$SCRIPT_DIR\guardit-client.ps1" -Action Status `
        -TaskID $TASK_COPY `
        -Status "completed" `
        -Message "Copy to NAS completed" `
        -Progress 100 `
        -GuardITURL $GUARDIT_URL

    Write-Host "✓ All backup tasks completed"
}
catch {
    Write-Error "Backup failed: $_"
    exit 1
}
```

## Task Naming Conventions

For consistency and clarity, use semantic task IDs:

```
Format: [SERVER]-[TYPE]-[NUMBER]

Examples:
  prod-01-db          → Production Server 1 - Database Backup
  prod-01-copy        → Production Server 1 - Copy to NAS
  prod-02-db          → Production Server 2 - Database Backup
  prod-02-files       → Production Server 2 - File Backup

Alternative format: [TYPE][NUMBER]
  DB001              → Database Backup Task 1
  COPY001            → Copy Task 1
  VERIFY001          → Verification Task 1
```

## Task Types

Common task types for organizing your backups:

- `database` - Database backups (SQL Server, MySQL, PostgreSQL, etc.)
- `files` - File/folder backups
- `copy` - Copying backups to external storage (NAS, cloud, etc.)
- `verification` - Backup verification tasks
- `archive` - Archive/compression tasks
- `retention` - Data retention/cleanup tasks

## REST API Endpoints Reference

### Task Management
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:taskId` - Get specific task
- `GET /api/tasks/type/:taskType` - Get tasks by type
- `POST /api/tasks/register` - Register new task
- `PUT /api/tasks/:taskId` - Update task
- `DELETE /api/tasks/:taskId` - Delete task

### Status Updates
- `POST /api/status/:taskId` - Send status update
- `GET /api/status/:taskId` - Get current status
- `GET /api/status` - Get all statuses
- `DELETE /api/status/:taskId` - Clear status

### History & Metrics
- `GET /api/history/:taskId` - Get task history (paginated)
- `GET /api/history/:taskId/range` - Get history by date range
- `GET /api/stats/:taskId` - Get task statistics
- `GET /api/summary/:taskId/today` - Get today's summary
- `GET /api/metrics/:taskId/daily` - Get daily metrics (last 30 days)

## Database Schema

### backup_tasks Table
- `task_id` VARCHAR(255) UNIQUE - Semantic task identifier
- `display_name` VARCHAR(255) - Human-readable display name
- `description` TEXT - Task description
- `task_type` VARCHAR(50) - Task categorization
- `server_id` VARCHAR(255) - Optional reference to server
- `is_active` BOOLEAN - Enable/disable task
- `last_seen` TIMESTAMP - When task last reported
- `created_at`, `updated_at` - Timestamps

### status_history Table
- `task_id` VARCHAR(255) - References backup_tasks.task_id
- `status` VARCHAR(50) - Current status
- `message` TEXT - Status message
- `progress` INTEGER - Progress 0-100
- `data` JSONB - Optional JSON data
- `timestamp` TIMESTAMP - When status was recorded

### daily_metrics Table
- `task_id` VARCHAR(255) - References backup_tasks.task_id
- `date` DATE - Date of metrics
- `total_runs` INTEGER - Total task executions
- `successful_runs` INTEGER - Successful executions
- `failed_runs` INTEGER - Failed executions
- `avg_duration` INTERVAL - Average execution time
- `uptime_percentage` DECIMAL - Daily uptime %

## Troubleshooting

### Task Not Found Error
```json
{"error": "Task not registered"}
```
Make sure you register the task first using the `/api/tasks/register` endpoint.

### Task Not Active Error
```json
{"error": "Task is not active"}
```
The task is registered but has `is_active` set to false. Update it with the PUT endpoint to reactivate.

### Task ID Already Exists Error
```json
{"error": "Task ID already exists"}
```
Each task ID must be unique. Use a different task ID or delete the existing task first.
