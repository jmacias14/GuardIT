const express = require('express');
const cors = require('cors');
const { StatusHistory, BackupTask, DailyMetrics, Dashboard, DashboardSource, Alert, Keyword } = require('./db/models');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store for backup statuses (in-memory)
let backupStatuses = {};

// SSE clients
let sseClients = [];

// Flag para saber si la DB está lista
let dbReady = false;
setTimeout(() => {
    dbReady = true;
    console.log('✓ Database ready for operations');
}, 2000);

// SSE endpoint - browsers connect here for real-time updates
app.get('/events', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send initial connection message
    res.write('data: {"type":"connected","message":"SSE connection established"}\n\n');
    
    // Send current status of all servers
    res.write(`data: ${JSON.stringify({
        type: 'initial',
        statuses: backupStatuses
    })}\n\n`);
    
    // Add this client to the list
    sseClients.push(res);
    
    console.log(`SSE client connected. Total clients: ${sseClients.length}`);
    
    // Remove client when they disconnect
    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
        console.log(`SSE client disconnected. Total clients: ${sseClients.length}`);
    });
});

// Broadcast update to all connected SSE clients
function broadcastUpdate(serverId, status) {
    const message = {
        type: 'update',
        serverId: serverId,
        status: status
    };
    
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify(message)}\n\n`);
    });
}

// Receive status updates from backup tasks
app.post('/api/status/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const { status, message, progress, data } = req.body;

    const statusUpdate = {
        status: status || 'unknown',
        message: message || '',
        progress: progress || 0,
        data: data || null,
        timestamp: new Date().toISOString(),
        lastUpdate: new Date().toLocaleString()
    };

    // Validar tarea registrada si BD está lista
    if (dbReady) {
        try {
            const task = await BackupTask.getById(taskId);
            if (!task) {
                console.warn(`[${taskId}] Status update from unregistered task`);
                return res.status(404).json({ error: 'Task not registered' });
            }

            if (!task.is_active) {
                console.warn(`[${taskId}] Status update from inactive task`);
                return res.status(403).json({ error: 'Task is not active' });
            }

            // Actualizar last_seen
            await BackupTask.updateLastSeen(taskId);
        } catch (error) {
            console.error('Error validating task:', error);
            return res.status(500).json({ error: 'Task validation error' });
        }
    }

    backupStatuses[taskId] = statusUpdate;

    console.log(`[${taskId}] ${status}: ${message}`);

    // Guardar en BD si está lista
    if (dbReady) {
        try {
            await StatusHistory.add(taskId, status, message, progress, data);

            // Actualizar métricas diarias
            if (status === 'completed' || status === 'failed' || status === 'error') {
                await DailyMetrics.updateDaily(taskId);
            }

            // Detectar palabras clave y crear alertas
            if (message) {
                try {
                    const detectedKeywords = await Keyword.detectKeywords(message);
                    for (const kw of detectedKeywords) {
                        const alert = await Alert.create(
                            taskId,
                            kw.alert_type,
                            kw.keyword,
                            message,
                            kw.severity
                        );
                        console.log(`[${taskId}] Alert created for keyword: ${kw.keyword}`);

                        // Send browser notification for error/critical alerts
                        if (kw.alert_type === 'error' || kw.alert_type === 'critical') {
                            const task = await BackupTask.getById(taskId);
                            broadcastUpdate('alert', {
                                type: 'alert_notification',
                                taskId: taskId,
                                taskName: task?.display_name || taskId,
                                alertType: kw.alert_type,
                                message: message,
                                severity: kw.severity,
                                keyword: kw.keyword,
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error detecting keywords/creating alerts:', error);
                }
            }
        } catch (error) {
            console.error('Error saving to database:', error);
        }
    }

    // Broadcast to all connected browsers via SSE
    broadcastUpdate(taskId, statusUpdate);

    res.json({ success: true });
});

// Get status of a specific task
app.get('/api/status/:taskId', (req, res) => {
    const { taskId } = req.params;
    res.json(backupStatuses[taskId] || { status: 'no_data' });
});

// Get all statuses
app.get('/api/status', (req, res) => {
    res.json(backupStatuses);
});

// Clear status for a task
app.delete('/api/status/:taskId', (req, res) => {
    const { taskId } = req.params;
    delete backupStatuses[taskId];

    // Broadcast deletion
    broadcastUpdate(taskId, null);

    res.json({ success: true });
});

// Clear all statuses
app.delete('/api/status', (req, res) => {
    backupStatuses = {};
    
    // Broadcast clear all
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'clear_all' })}\n\n`);
    });
    
    res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        connectedClients: sseClients.length,
        trackedServers: Object.keys(backupStatuses).length,
        dbReady: dbReady
    });
});

// ============================================
// History & Statistics Endpoints
// ============================================

// Get history for a specific task
app.get('/api/history/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const history = await StatusHistory.getByTaskId(taskId, limit, offset);
        res.json(history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get history between dates
app.get('/api/history/:taskId/range', async (req, res) => {
    const { taskId } = req.params;
    const { startDate, endDate } = req.query;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const history = await StatusHistory.getByDateRange(taskId, startDate, endDate);
        res.json(history);
    } catch (error) {
        console.error('Error fetching date range history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get task statistics
app.get('/api/stats/:taskId', async (req, res) => {
    const { taskId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const stats = await StatusHistory.getStats(taskId);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get today's summary for a task
app.get('/api/summary/:taskId/today', async (req, res) => {
    const { taskId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const summary = await StatusHistory.getTodaysSummary(taskId);
        res.json(summary);
    } catch (error) {
        console.error('Error fetching today summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get daily metrics
app.get('/api/metrics/:taskId/daily', async (req, res) => {
    const { taskId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const metrics = await DailyMetrics.getLastMonth(taskId);
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching daily metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Backup Tasks Management
// ============================================

// Get list of all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        if (!dbReady) {
            return res.json(Object.keys(backupStatuses).map(id => ({ task_id: id })));
        }
        const tasks = await BackupTask.getAll();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get tasks by type
app.get('/api/tasks/type/:taskType', async (req, res) => {
    const { taskType } = req.params;
    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const tasks = await BackupTask.getByType(taskType);
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks by type:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get specific task
app.get('/api/tasks/:taskId', async (req, res) => {
    const { taskId } = req.params;
    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const task = await BackupTask.getById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: error.message });
    }
});

// Register a new backup task
app.post('/api/tasks/register', async (req, res) => {
    const { taskId, displayName, taskType, description, serverId, schedule, scheduleCron, comments } = req.body;

    // Validación de parámetros requeridos
    if (!taskId || !displayName) {
        return res.status(400).json({
            error: 'Missing required fields: taskId, displayName'
        });
    }

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        // Verificar si la tarea ya existe
        const existing = await BackupTask.getById(taskId);
        if (existing) {
            return res.status(409).json({ error: 'Task ID already exists' });
        }

        // Registrar nueva tarea
        const task = await BackupTask.register(taskId, displayName, taskType, description, serverId, schedule, scheduleCron, comments);
        console.log(`✓ Task registered: ${taskId}`);
        res.status(201).json(task);
    } catch (error) {
        console.error('Error registering task:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update task
app.put('/api/tasks/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const { displayName, description, taskType, serverId, isActive, schedule, scheduleCron, comments, enabled } = req.body;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const task = await BackupTask.getById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const updated = await BackupTask.update(taskId, { displayName, description, taskType, serverId, isActive, schedule, scheduleCron, comments, enabled });
        console.log(`✓ Task updated: ${taskId}`);
        res.json(updated);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete task
app.delete('/api/tasks/:taskId', async (req, res) => {
    const { taskId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const task = await BackupTask.getById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        await BackupTask.delete(taskId);
        // También limpiar el estado en memoria
        delete backupStatuses[taskId];
        console.log(`✓ Task deleted: ${taskId}`);
        res.json({ success: true, message: `Task ${taskId} deleted` });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Grafana JSON API Datasource Endpoints
// ============================================

// Root endpoint - Grafana health check
app.all('/grafana', (req, res) => {
    res.status(200).send('OK');
});

// Search/Metrics endpoint - Returns list of available servers/metrics
app.post('/grafana/search', (req, res) => {
    const servers = Object.keys(backupStatuses).map(server => ({
        text: server,
        value: server
    }));
    res.json(servers);
});

// Metrics endpoint - Alternative endpoint name for some Grafana datasources
app.post('/grafana/metrics', (req, res) => {
    const servers = Object.keys(backupStatuses).map(server => ({
        text: server,
        value: server
    }));
    res.json(servers);
});

// Query endpoint - Returns time series data for Grafana
app.post('/grafana/query', (req, res) => {
    const { targets } = req.body;

    const results = targets.map(target => {
        const serverId = target.target;
        const status = backupStatuses[serverId];

        if (!status) {
            return {
                target: serverId,
                datapoints: []
            };
        }

        // Convert status to numeric values for Grafana
        const statusValue = {
            'completed': 100,
            'running': 50,
            'warning': 25,
            'failed': 0,
            'error': 0,
            'no_data': -1
        }[status.status] || -1;

        const timestamp = new Date(status.timestamp).getTime();

        return {
            target: serverId,
            datapoints: [
                [statusValue, timestamp],
                [status.progress || 0, timestamp]
            ]
        };
    });

    res.json(results);
});

// Annotations endpoint - For marking events in Grafana
app.post('/grafana/annotations', (req, res) => {
    const annotations = [];

    Object.entries(backupStatuses).forEach(([serverId, status]) => {
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'error') {
            annotations.push({
                annotation: 'Backup Status',
                time: new Date(status.timestamp).getTime(),
                title: serverId,
                tags: [status.status],
                text: status.message
            });
        }
    });

    res.json(annotations);
});

// Table endpoint - Returns current status as table data
app.post('/grafana/table', (req, res) => {
    const columns = [
        { text: 'Server', type: 'string' },
        { text: 'Status', type: 'string' },
        { text: 'Message', type: 'string' },
        { text: 'Progress', type: 'number' },
        { text: 'Last Update', type: 'time' }
    ];

    const rows = Object.entries(backupStatuses).map(([serverId, status]) => [
        serverId,
        status.status,
        status.message || '',
        status.progress || 0,
        new Date(status.timestamp).getTime()
    ]);

    res.json([{
        columns: columns,
        rows: rows,
        type: 'table'
    }]);
});

// ============================================
// Dashboard Management Endpoints
// ============================================

// Get all dashboards
app.get('/api/dashboards', async (req, res) => {
    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const dashboards = await Dashboard.getAll();
        res.json(dashboards);
    } catch (error) {
        console.error('Error fetching dashboards:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new dashboard
app.post('/api/dashboards/create', async (req, res) => {
    const { dashboardId, displayName, description } = req.body;

    if (!dashboardId || !displayName) {
        return res.status(400).json({
            error: 'Missing required fields: dashboardId, displayName'
        });
    }

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const existing = await Dashboard.getById(dashboardId);
        if (existing) {
            return res.status(409).json({ error: 'Dashboard ID already exists' });
        }

        const dashboard = await Dashboard.create(dashboardId, displayName, description);
        console.log(`✓ Dashboard created: ${dashboardId}`);
        res.status(201).json(dashboard);
    } catch (error) {
        console.error('Error creating dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get dashboard by ID with sources
app.get('/api/dashboards/:dashboardId', async (req, res) => {
    const { dashboardId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const dashboard = await Dashboard.getById(dashboardId);
        if (!dashboard) {
            return res.status(404).json({ error: 'Dashboard not found' });
        }

        const sources = await DashboardSource.getByDashboard(dashboardId);
        res.json({ ...dashboard, sources });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update dashboard
app.put('/api/dashboards/:dashboardId', async (req, res) => {
    const { dashboardId } = req.params;
    const { displayName, description, isActive } = req.body;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const dashboard = await Dashboard.getById(dashboardId);
        if (!dashboard) {
            return res.status(404).json({ error: 'Dashboard not found' });
        }

        const updated = await Dashboard.update(dashboardId, { displayName, description, isActive });
        console.log(`✓ Dashboard updated: ${dashboardId}`);
        res.json(updated);
    } catch (error) {
        console.error('Error updating dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete dashboard
app.delete('/api/dashboards/:dashboardId', async (req, res) => {
    const { dashboardId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const dashboard = await Dashboard.getById(dashboardId);
        if (!dashboard) {
            return res.status(404).json({ error: 'Dashboard not found' });
        }

        await Dashboard.delete(dashboardId);
        console.log(`✓ Dashboard deleted: ${dashboardId}`);
        res.json({ success: true, message: `Dashboard ${dashboardId} deleted` });
    } catch (error) {
        console.error('Error deleting dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Dashboard Sources (Many-to-Many) Endpoints
// ============================================

// Add source to dashboard
app.post('/api/dashboards/:dashboardId/sources', async (req, res) => {
    const { dashboardId } = req.params;
    const { taskId, widgetType = 'status', widgetConfig } = req.body;

    if (!taskId) {
        return res.status(400).json({ error: 'Missing required field: taskId' });
    }

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        // Verify dashboard exists
        const dashboard = await Dashboard.getById(dashboardId);
        if (!dashboard) {
            return res.status(404).json({ error: 'Dashboard not found' });
        }

        // Verify task exists
        const task = await BackupTask.getById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const source = await DashboardSource.add(dashboardId, taskId, widgetType, widgetConfig);
        console.log(`✓ Source added to dashboard: ${dashboardId} <- ${taskId}`);
        res.status(201).json(source);
    } catch (error) {
        console.error('Error adding source to dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update widget configuration
app.put('/api/dashboards/:dashboardId/sources/:taskId', async (req, res) => {
    const { dashboardId, taskId } = req.params;
    const { widgetType = 'status', widgetConfig } = req.body;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const source = await DashboardSource.get(dashboardId, taskId, widgetType);
        if (!source) {
            return res.status(404).json({ error: 'Source not found' });
        }

        const updated = await DashboardSource.updateWidget(dashboardId, taskId, widgetType, widgetConfig);
        res.json(updated);
    } catch (error) {
        console.error('Error updating widget:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove source from dashboard
app.delete('/api/dashboards/:dashboardId/sources/:taskId', async (req, res) => {
    const { dashboardId, taskId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        await DashboardSource.remove(dashboardId, taskId);
        console.log(`✓ Source removed from dashboard: ${dashboardId} -> ${taskId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error removing source from dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Alerts Endpoints
// ============================================

// Get all active alerts (Global Alerts Dashboard)
app.get('/api/alerts', async (req, res) => {
    const { limit = 100 } = req.query;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const alerts = await Alert.getAllActive(limit);
        res.json(alerts);
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get alerts for specific task
app.get('/api/alerts/:taskId', async (req, res) => {
    const { taskId } = req.params;
    const { status, limit = 50 } = req.query;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const alerts = await Alert.getByTask(taskId, status, limit);
        res.json(alerts);
    } catch (error) {
        console.error('Error fetching task alerts:', error);
        res.status(500).json({ error: error.message });
    }
});

// Acknowledge alert
app.post('/api/alerts/:alertId/acknowledge', async (req, res) => {
    const { alertId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const alert = await Alert.acknowledge(alertId);
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        console.log(`✓ Alert acknowledged: ${alertId}`);
        res.json(alert);
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resolve alert
app.post('/api/alerts/:alertId/resolve', async (req, res) => {
    const { alertId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const alert = await Alert.resolve(alertId);
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        console.log(`✓ Alert resolved: ${alertId}`);
        res.json(alert);
    } catch (error) {
        console.error('Error resolving alert:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Keywords Management Endpoints
// ============================================

// Get all active keywords
app.get('/api/keywords', async (req, res) => {
    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const keywords = await Keyword.getAll();
        res.json(keywords);
    } catch (error) {
        console.error('Error fetching keywords:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create custom keyword
app.post('/api/keywords', async (req, res) => {
    const { keyword, alertType, severity, description } = req.body;

    if (!keyword || !alertType) {
        return res.status(400).json({
            error: 'Missing required fields: keyword, alertType'
        });
    }

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const existing = await Keyword.get(keyword);
        if (existing) {
            return res.status(409).json({ error: 'Keyword already exists' });
        }

        const kw = await Keyword.create(keyword, alertType, severity || 0, description);
        console.log(`✓ Keyword created: ${keyword}`);
        res.status(201).json(kw);
    } catch (error) {
        console.error('Error creating keyword:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update keyword
app.put('/api/keywords/:keywordId', async (req, res) => {
    const { keywordId } = req.params;
    const { severity, description, isActive } = req.body;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const updated = await Keyword.update(keywordId, { severity, description, isActive });
        if (!updated) {
            return res.status(404).json({ error: 'Keyword not found' });
        }

        res.json(updated);
    } catch (error) {
        console.error('Error updating keyword:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete keyword
app.delete('/api/keywords/:keywordId', async (req, res) => {
    const { keywordId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const deleted = await Keyword.delete(keywordId);
        if (!deleted) {
            return res.status(404).json({ error: 'Keyword not found' });
        }

        console.log(`✓ Keyword deleted: ${keywordId}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting keyword:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('🚀 GuardIT API Started');
    console.log('='.repeat(50));
    console.log(`📡 API running on http://localhost:${PORT}`);
    console.log(`🌐 Web UI: http://localhost:${PORT}`);
    console.log(`📊 SSE endpoint: http://localhost:${PORT}/events`);
    console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
    console.log('='.repeat(50));
});
