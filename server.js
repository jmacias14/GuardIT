const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store for backup statuses (in-memory)
let backupStatuses = {};

// SSE clients
let sseClients = [];

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

// Receive status updates from backup scripts
app.post('/api/status/:serverId', (req, res) => {
    const { serverId } = req.params;
    const { status, message, progress, data } = req.body;
    
    const statusUpdate = {
        status: status || 'unknown',
        message: message || '',
        progress: progress || 0,
        data: data || null,
        timestamp: new Date().toISOString(),
        lastUpdate: new Date().toLocaleString()
    };
    
    backupStatuses[serverId] = statusUpdate;
    
    console.log(`[${serverId}] ${status}: ${message}`);
    
    // Broadcast to all connected browsers via SSE
    broadcastUpdate(serverId, statusUpdate);
    
    res.json({ success: true });
});

// Get status of a specific server
app.get('/api/status/:serverId', (req, res) => {
    const { serverId } = req.params;
    res.json(backupStatuses[serverId] || { status: 'no_data' });
});

// Get all statuses
app.get('/api/status', (req, res) => {
    res.json(backupStatuses);
});

// Clear status for a server
app.delete('/api/status/:serverId', (req, res) => {
    const { serverId } = req.params;
    delete backupStatuses[serverId];
    
    // Broadcast deletion
    broadcastUpdate(serverId, null);
    
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
        trackedServers: Object.keys(backupStatuses).length
    });
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
