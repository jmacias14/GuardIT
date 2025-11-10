# GuardIT - Backup Monitoring & Alert System
**Complete System Documentation**

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Core Features](#core-features)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Frontend Implementation](#frontend-implementation)
8. [Real-time Features](#real-time-features)
9. [Keyword Detection System](#keyword-detection-system)
10. [Deployment](#deployment)
11. [Development Phases](#development-phases)
12. [Known Issues & Solutions](#known-issues--solutions)
13. [Future Enhancements](#future-enhancements)
14. [Update Log](#update-log)

---

## Project Overview

**GuardIT** is a lightweight, real-time backup monitoring and alerting system designed to:
- Monitor multiple backup tasks/sources across distributed servers
- Display custom dashboards with grouped backup sources
- Detect errors automatically through keyword detection
- Send real-time browser notifications for critical issues
- Track historical data for analytics and reporting

**Target Users:** System administrators, DevOps teams managing backup infrastructure

**Key Philosophy:** Keep scripts simple (send messages), let the server do all the logic

---

## System Architecture

### High-Level Flow
```
Backup Scripts (PowerShell/Bash)
    ↓ (HTTP POST with status + message)

Express.js Server
    ├─ Validate & store status
    ├─ Detect keywords in message
    ├─ Create alerts for matching keywords
    └─ Broadcast via SSE to clients

PostgreSQL Database
    ├─ Store status history
    ├─ Persist alerts
    ├─ Track dashboard configurations
    └─ Maintain keyword definitions

Web Dashboard (Frontend)
    ├─ Display dashboards with sources
    ├─ Show real-time alerts
    ├─ Manage configurations
    └─ Receive browser notifications
```

### Component Responsibilities

| Component | Responsibility |
|-----------|-----------------|
| **Backup Scripts** | Send simple status updates with messages |
| **Express Server** | API, keyword detection, SSE broadcasting, database operations |
| **PostgreSQL** | Persistent storage, historical data, configurations |
| **Frontend (Browser)** | UI, SSE connection, real-time updates, notifications |

---

## Technology Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL 15
- **Real-time:** Server-Sent Events (SSE)
- **Container:** Docker + Docker Compose

### Frontend
- **Language:** Vanilla JavaScript (no frameworks)
- **Styling:** Tailwind CSS (dark mode)
- **Real-time:** SSE EventSource API
- **Notifications:** Browser Notification API

### Infrastructure
- **Containerization:** Docker
- **Orchestration:** Docker Compose
- **Data Visualization:** Grafana (optional)
- **Version Control:** Git/GitHub

---

## Core Features

### 1. Dashboard System ✅
**Purpose:** Organize backup monitoring into logical groups

**Features:**
- Create unlimited custom dashboards
- Assign multiple sources (backup tasks) to each dashboard
- Same source can appear in multiple dashboards
- Each dashboard is a separate "page" with its own view
- Back/forward navigation between dashboard list and detail view

**Methods:**
- RESTful CRUD API (`/api/dashboards/*`)
- Many-to-many relationship via `dashboard_sources` table
- Real-time updates via SSE

### 2. Source Management ✅
**Purpose:** Register and configure backup tasks/sources

**Features:**
- Create sources with detailed metadata:
  - Task ID (semantic UID: e.g., "prod-01-db")
  - Display name (verbose, user-facing)
  - Description
  - Task type (database, files, copy, etc.)
  - Execution schedule (hourly, daily, weekly, monthly, custom CRON)
  - Comments/notes
- Enable/disable sources
- Edit existing sources
- Delete sources

**Methods:**
- RESTful API (`/api/tasks/*`)
- Database persistence in `backup_tasks` table
- Validation for unique Task IDs

### 3. Alert System ✅
**Purpose:** Automatically detect and track backup issues

**Features:**
- Automatic keyword detection on status messages
- Alert status lifecycle: active → acknowledged → resolved
- Severity levels (1-5 scale)
- Alert type categorization (error, critical, warning, success, info)
- Browser notifications for error/critical only
- Filter alerts by source (task)
- View alert history with timestamps

**Methods:**
- Keyword-based pattern matching (case-insensitive)
- Database persistence in `alerts` table
- SSE broadcast for real-time notifications
- Browser Notification API for system-level alerts

### 4. Keyword Detection ✅
**Purpose:** Intelligently extract and classify messages from scripts

**Features:**
- 13 predefined keywords with severity levels
- Custom keyword support
- Case-insensitive matching
- Multiple keywords per message
- Extensible system (easy to add new keywords)

**Predefined Keywords:**
```
error          → severity 5, alert_type: error
critical       → severity 5, alert_type: critical
failed         → severity 4, alert_type: error
warning        → severity 3, alert_type: warning
timeout        → severity 4, alert_type: warning
incomplete     → severity 2, alert_type: warning
retry          → severity 2, alert_type: warning
skipped        → severity 2, alert_type: warning
success        → severity 1, alert_type: success
completed      → severity 1, alert_type: success
progress       → severity 0, alert_type: info
files          → severity 0, alert_type: info
speed          → severity 0, alert_type: info
```

**Methods:**
- Substring matching in messages
- Database lookup via `keywords` table
- Automatic at each status update
- Stored in `alerts` table for history

### 5. Real-time Updates ✅
**Purpose:** Push data to clients instantly without polling

**Features:**
- Server-Sent Events (SSE) for one-way server→client communication
- Auto-reconnect on disconnect
- Connection status indicator
- Trigger data refresh on updates
- Broadcast alert notifications

**Methods:**
- EventSource API (vanilla JavaScript)
- `/events` endpoint for SSE stream
- JSON message format
- 3-second retry on disconnect

### 6. Browser Notifications ✅
**Purpose:** Alert users to critical issues even outside the app

**Features:**
- Auto-request permission on page load
- Desktop system notifications
- Persistent notifications (require user interaction)
- Per-task deduplication
- Only for error/critical severity

**Methods:**
- Browser Notification API
- Triggered via SSE alert_notification message type
- Icon and tag-based handling

---

## Database Schema

### Tables Overview

#### `servers` (Optional, for future use)
```sql
id SERIAL PRIMARY KEY
server_id VARCHAR(255) UNIQUE NOT NULL
display_name VARCHAR(255) NOT NULL
description TEXT
is_active BOOLEAN DEFAULT true
last_seen TIMESTAMP
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `backup_tasks` (Core - Backup sources)
```sql
id SERIAL PRIMARY KEY
task_id VARCHAR(255) UNIQUE NOT NULL
display_name VARCHAR(255) NOT NULL
description TEXT
task_type VARCHAR(50)
server_id VARCHAR(255) -- Foreign key to servers
is_active BOOLEAN DEFAULT true
schedule VARCHAR(50) DEFAULT 'daily'
schedule_cron VARCHAR(255)
comments TEXT
enabled BOOLEAN DEFAULT true
last_seen TIMESTAMP
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `status_history` (Message logging)
```sql
id SERIAL PRIMARY KEY
task_id VARCHAR(255) NOT NULL -- Foreign key to backup_tasks
status VARCHAR(50)
message TEXT
progress INTEGER
data JSONB
timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `dashboards` (Dashboard definitions)
```sql
id SERIAL PRIMARY KEY
dashboard_id VARCHAR(255) UNIQUE NOT NULL
display_name VARCHAR(255) NOT NULL
description TEXT
is_active BOOLEAN DEFAULT true
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `dashboard_sources` (M2M junction - Links dashboards to sources)
```sql
id SERIAL PRIMARY KEY
dashboard_id VARCHAR(255) NOT NULL -- FK to dashboards
task_id VARCHAR(255) NOT NULL -- FK to backup_tasks
display_order INTEGER DEFAULT 0
widget_type VARCHAR(50) DEFAULT 'status'
widget_config JSONB
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
UNIQUE(dashboard_id, task_id, widget_type)
```

#### `alerts` (Alert tracking)
```sql
id SERIAL PRIMARY KEY
task_id VARCHAR(255) NOT NULL -- FK to backup_tasks
alert_type VARCHAR(50) NOT NULL
keyword VARCHAR(100)
message TEXT
status VARCHAR(50) DEFAULT 'active'
severity INTEGER DEFAULT 0
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
resolved_at TIMESTAMP
```

#### `keywords` (Alert classification rules)
```sql
id SERIAL PRIMARY KEY
keyword VARCHAR(100) UNIQUE NOT NULL
alert_type VARCHAR(50) NOT NULL
severity INTEGER DEFAULT 0
description TEXT
is_active BOOLEAN DEFAULT true
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `daily_metrics` (Historical analytics)
```sql
id SERIAL PRIMARY KEY
task_id VARCHAR(255) NOT NULL -- FK to backup_tasks
date DATE NOT NULL
total_runs INTEGER
successful_runs INTEGER
failed_runs INTEGER
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
UNIQUE(task_id, date)
```

---

## API Endpoints

### Dashboard Management

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/dashboards` | List all dashboards | - |
| POST | `/api/dashboards/create` | Create new dashboard | `{dashboardId, displayName, description}` |
| GET | `/api/dashboards/:dashboardId` | Get dashboard with sources | - |
| PUT | `/api/dashboards/:dashboardId` | Update dashboard | `{displayName, description, isActive}` |
| DELETE | `/api/dashboards/:dashboardId` | Delete dashboard | - |

### Dashboard Sources (M2M)

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/dashboards/:dashboardId/sources` | Add source to dashboard | `{taskId, widgetType}` |
| PUT | `/api/dashboards/:dashboardId/sources/:taskId` | Update widget config | `{widgetConfig}` |
| DELETE | `/api/dashboards/:dashboardId/sources/:taskId` | Remove source from dashboard | - |

### Tasks/Sources

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/tasks` | List all tasks | - |
| POST | `/api/tasks/register` | Register new task | `{taskId, displayName, taskType, schedule, ...}` |
| GET | `/api/tasks/:taskId` | Get task details | - |
| PUT | `/api/tasks/:taskId` | Update task | `{displayName, description, ...}` |
| DELETE | `/api/tasks/:taskId` | Delete task | - |

### Status Updates (Core)

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/status/:taskId` | Send backup status | `{status, message, progress, data}` |
| GET | `/api/status` | Get all statuses | - |
| GET | `/api/status/:taskId` | Get task status history | - |
| DELETE | `/api/status/:taskId` | Delete status | - |
| DELETE | `/api/status` | Clear all statuses | - |

### Alerts

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/alerts` | Get active alerts | - |
| GET | `/api/alerts/:taskId` | Get task's alerts | - |
| POST | `/api/alerts/:alertId/acknowledge` | Acknowledge alert | - |
| POST | `/api/alerts/:alertId/resolve` | Resolve alert | - |

### Keywords

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| GET | `/api/keywords` | Get all keywords | - |
| POST | `/api/keywords` | Create custom keyword | `{keyword, alertType, severity, description}` |
| PUT | `/api/keywords/:keywordId` | Update keyword | `{severity, description, isActive}` |
| DELETE | `/api/keywords/:keywordId` | Delete keyword | - |

### Real-time

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events` | SSE endpoint for real-time updates |
| GET | `/api/health` | Health check endpoint |

---

## Frontend Implementation

### Page Structure
```
Root (index.html)
├── Layout
│   ├── Left: Main Content Area
│   │   ├── Header (GuardIT title + connection status)
│   │   └── Content Container
│   │       ├── Dashboards View
│   │       ├── Sources View
│   │       ├── Alerts View
│   │       └── Config View
│   └── Right: Navigation Sidebar (width-72)
│       ├── 📊 Dashboards Button
│       ├── 📁 Sources Button
│       ├── 🚨 Alerts Button
│       └── ⚙️ Config Button
│
├── Modals
│   ├── Dashboard Form Modal
│   ├── Add Source to Dashboard Modal
│   ├── Source Form Modal
│   └── Source Details Modal
│
└── JavaScript Functions
    ├── View Management (switchMainView)
    ├── Dashboard Functions (load, render, create, etc.)
    ├── Source Functions (load, render, create, etc.)
    ├── Alerts Functions (load, render, filter, acknowledge, resolve)
    ├── Modal Management (open, close)
    ├── SSE Connection (connectSSE, updateStatus)
    └── Notifications (requestPermission, sendNotification)
```

### Key JavaScript Functions

#### View Management
- `switchMainView(view)` - Switch between dashboard/sources/alerts/config tabs

#### Dashboard Functions
- `loadDashboards()` - Fetch all dashboards from API
- `renderDashboards()` - Display dashboard cards
- `openDashboard(dashboardId)` - Open dashboard detail view
- `loadDashboardSources(dashboardId)` - Load sources for dashboard
- `renderDashboardSources(sources)` - Display sources as cards
- `expandSourceCard(button)` - Toggle source card expansion
- `removeSourceFromDashboard(taskId)` - Remove source from dashboard
- `saveDashboard(event)` - Create new dashboard

#### Source Functions
- `loadSources()` - Fetch all sources/tasks
- `renderSources()` - Display sources list
- `saveSource(event)` - Create new source
- `populateSourceSelect()` - Populate dropdown for add source modal
- `addSourceToDashboard(event)` - Add source to current dashboard
- `openSourceDetailsModal(taskId)` - Show source history/logs

#### Alert Functions
- `loadAlerts()` - Fetch active alerts
- `renderAlerts()` - Display alerts list
- `populateAlertFilter()` - Build filter dropdown
- `filterAlerts()` - Filter alerts by source
- `refreshAlerts()` - Manual refresh
- `acknowledgeAlert(alertId)` - Acknowledge an alert
- `resolveAlert(alertId)` - Resolve an alert

#### SSE & Notifications
- `connectSSE()` - Establish SSE connection
- `updateConnectionStatus(connected)` - Update connection indicator
- `requestNotificationPermission()` - Ask browser permission
- `sendNotification(title, options)` - Display browser notification

### Styling
- **Framework:** Tailwind CSS (dark mode)
- **Colors:** Slate 800-900 background, slate 50-300 text
- **Responsive:** Flexbox layout, responsive grid
- **Theme:** Dark mode optimized for monitoring dashboards

---

## Real-time Features

### Server-Sent Events (SSE) Architecture

#### Connection Flow
```
Client connects to /events endpoint
    ↓
Server creates EventSource stream
    ↓
Server holds connection open
    ↓
On status update/alert:
    ├─ Store in database
    ├─ Create alert (if keywords match)
    └─ Broadcast to all connected clients
    ↓
Clients receive message & update UI
```

#### Message Types
```json
{
  "type": "connected",
  "timestamp": "2025-11-10T12:00:00Z"
}
```

```json
{
  "type": "initial",
  "statuses": { /* current statuses */ }
}
```

```json
{
  "type": "update",
  "serverId": "prod-01-db",
  "status": { /* status object */ }
}
```

```json
{
  "type": "alert_notification",
  "taskId": "prod-01-db",
  "taskName": "Production Database Backup",
  "alertType": "error",
  "message": "Database backup failed - disk space critical",
  "severity": 5,
  "keyword": "error",
  "timestamp": "2025-11-10T12:00:00Z"
}
```

### Browser Notification Handling
```javascript
// On alert_notification message:
sendNotification(`🚨 ERROR: ${taskName}`, {
  body: message,
  icon: '🚨',
  tag: `alert-${taskId}`,
  requireInteraction: true
});
```

---

## Keyword Detection System

### Detection Process
1. Status message received via `/api/status/:taskId`
2. Message stored in `status_history` table
3. `Keyword.detectKeywords(message)` called
4. Each active keyword checked for substring match (case-insensitive)
5. For each matched keyword:
   - Alert created in `alerts` table
   - Alert broadcast via SSE if error/critical
6. Browser notification sent for error/critical only

### Adding New Keywords
```javascript
// Via API:
POST /api/keywords
{
  "keyword": "disk_full",
  "alertType": "error",
  "severity": 5,
  "description": "Disk space insufficient for backup"
}

// Or directly in database:
INSERT INTO keywords (keyword, alert_type, severity, description)
VALUES ('disk_full', 'error', 5, 'Disk space insufficient for backup');
```

### Alert Severity Scale
- **5:** Critical (error, critical) - Triggers notification
- **4:** High (failed, timeout)
- **3:** Medium (warning)
- **2:** Low (incomplete, retry, skipped)
- **1:** Info (success, completed)
- **0:** Data (progress, files, speed)

---

## Deployment

### Docker Architecture

#### Containers
1. **guardit** (Node.js + Express)
   - Port: 3000
   - Waits for DB, runs migrations, starts server

2. **guardit-postgres** (PostgreSQL 15)
   - Port: 5432
   - Database: guardit
   - User: guardit

3. **grafana** (Optional)
   - Port: 3002
   - For future analytics

#### Docker Compose
```yaml
version: '3.8'
services:
  guardit-postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: guardit
      POSTGRES_PASSWORD: guardit
      POSTGRES_DB: guardit

  guardit:
    build: .
    depends_on:
      - guardit-postgres
    environment:
      DB_HOST: guardit-postgres
      DB_USER: guardit
      DB_PASSWORD: guardit
      DB_NAME: guardit
    ports:
      - "3000:3000"
```

#### Dockerfile
```dockerfile
FROM node:lts-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build:css
CMD ./start.sh
```

#### Start Script
```bash
#!/bin/sh
sleep 5  # Wait for database
node db/migrate.js  # Run migrations
node server.js      # Start server
```

### Running Locally
```bash
# Start all containers
docker-compose up -d --build

# View logs
docker logs guardit
docker logs guardit-postgres

# Access
- Application: http://localhost:3000
- Grafana: http://localhost:3002 (if enabled)
```

### Configuration
Environment variables (can be set in docker-compose.yml):
- `DB_HOST` - PostgreSQL host
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_NAME` - Database name
- `PORT` - Server port (default: 3000)

---

## Development Phases

### Phase 1: Core Infrastructure ✅
- Express.js server setup
- PostgreSQL database configuration
- Basic API endpoints
- Docker containerization
- Git repository initialization

**Commits:**
- Initial project setup
- Add PostgreSQL database
- Fix Docker startup script
- Refactor from IP-based to task-based architecture

### Phase 2: Task-Based Architecture ✅
- Implement semantic task IDs (prod-01-db format)
- Task registration API
- Status history tracking
- Daily metrics aggregation
- Task management endpoints

**Commits:**
- Refactor from IP-based to task-based
- Fix database migration script

### Phase 3: Dashboard System ✅
- Dashboard CRUD operations
- Many-to-many source assignment
- Alert system with keyword detection
- Real-time updates via SSE
- Browser notifications
- Complete frontend UI

**Commits:**
- Implement Phase 3: Dashboard system
- Fix database type casting issues

---

## Known Issues & Solutions

### Issue 1: Database Type Casting in DailyMetrics
**Problem:** PostgreSQL error with text vs character varying in date parameter
**Solution:** Use CAST($2 AS DATE) in SQL query
**Status:** ✅ Fixed in commit 6d63338

### Issue 2: Dashboard Sources Insert Query
**Problem:** Subquery in VALUES clause causing type deduction error
**Solution:** Calculate display_order separately in JavaScript, pass as parameter
**Status:** ✅ Fixed in commit 6d63338

### Issue 3: Keyword Detection Not Triggering
**Problem:** Keywords in messages not creating alerts
**Solution:** Verify keywords table is populated, check database migrations
**Status:** ✅ Fixed - keywords properly inserted in migration

---

## Future Enhancements

### Planned Features
1. **User Authentication**
   - Login system
   - Role-based access control (admin, operator, viewer)
   - Multi-user support

2. **Advanced Filtering**
   - Date range filtering for alerts/history
   - Status-based filtering (active/acknowledged/resolved)
   - Severity filtering

3. **Reports & Analytics**
   - Daily/weekly backup success rates
   - Performance trends
   - Failure analysis
   - Export to CSV/PDF

4. **Integrations**
   - Email notifications
   - Slack/Teams alerts
   - Webhook support for external systems
   - SNMP traps

5. **Configuration Page**
   - Keyword management UI
   - Alert threshold settings
   - Notification preferences
   - Backup policy management

6. **Performance Optimizations**
   - Pagination for alert lists
   - Data aggregation for large datasets
   - Caching layer (Redis)
   - Query optimization

7. **Improved Dashboard Widgets**
   - Drag-and-drop widget arrangement
   - Custom widget types (charts, gauges, progress bars)
   - Widget refresh intervals
   - Data comparison (today vs yesterday)

8. **Monitoring & Observability**
   - Application metrics (uptime, response times)
   - Database query performance
   - SSE connection metrics
   - Alert system health checks

---

## Update Log

### How to Update This Document
**IMPORTANT:** Follow this process when making changes:

1. **When adding a new feature:**
   - Add feature description to [Core Features](#core-features)
   - Update [Database Schema](#database-schema) if new tables needed
   - Add API endpoints to [API Endpoints](#api-endpoints)
   - Update [Frontend Implementation](#frontend-implementation) if UI changes
   - Add Phase to [Development Phases](#development-phases) or update existing phase

2. **When fixing a bug:**
   - Add to [Known Issues & Solutions](#known-issues--solutions)
   - Mark status as ✅ Fixed
   - Include commit hash

3. **When deploying:**
   - Update Docker configuration in [Deployment](#deployment)
   - Document environment variables
   - Note any database migrations

4. **Format:**
   - Use checkmarks (✅) for completed items
   - Use (⏳) for in-progress items
   - Use commit hashes (e.g., `6d63338`) for references
   - Keep timestamps in ISO 8601 format

### Commit History Reference
```
6d63338 - Fix database type casting issues (2025-11-10)
beafdba - Implement Phase 3: Dashboard system (2025-11-10)
7e8d6ff - Fix database migration script (2025-11-09)
4ba1508 - Refactor IP-based to task-based (2025-11-09)
4204339 - Manual server registration system (2025-11-08)
e26c203 - Fix Docker startup (2025-11-08)
e43f709 - Add PostgreSQL database (2025-11-07)
```

### Recent Updates
- **2025-11-10:** Completed Phase 3 implementation - full dashboard system with alerts
- **2025-11-10:** Fixed database type casting issues in DailyMetrics and DashboardSource
- **2025-11-10:** Pushed to GitHub: https://github.com/jmacias14/GuardIT
- **2025-11-10:** Created this comprehensive documentation file

---

## Contact & Support

**Repository:** https://github.com/jmacias14/GuardIT

**For issues/questions:**
1. Check [Known Issues & Solutions](#known-issues--solutions)
2. Review [API Endpoints](#api-endpoints) for correct usage
3. Check database schema matches [Database Schema](#database-schema)
4. Review recent commits in [Commit History Reference](#commit-history-reference)

---

**Last Updated:** 2025-11-10
**Documentation Version:** 1.0
**GuardIT Version:** Phase 3 ✅
