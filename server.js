const express = require('express');
const cors = require('cors');
const { StatusHistory, Server, DailyMetrics } = require('./db/models');

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

// Receive status updates from backup scripts
app.post('/api/status/:serverId', async (req, res) => {
    const { serverId } = req.params;
    const { status, message, progress, data } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    const statusUpdate = {
        status: status || 'unknown',
        message: message || '',
        progress: progress || 0,
        data: data || null,
        timestamp: new Date().toISOString(),
        lastUpdate: new Date().toLocaleString()
    };

    // Validar servidor registrado si BD está lista
    if (dbReady) {
        try {
            const server = await Server.getById(serverId);
            if (!server) {
                console.warn(`[${serverId}] Status update from unregistered server from ${clientIp}`);
                return res.status(404).json({ error: 'Server not registered' });
            }

            if (!server.is_active) {
                console.warn(`[${serverId}] Status update from inactive server from ${clientIp}`);
                return res.status(403).json({ error: 'Server is not active' });
            }

            // Validar IP si está configurada
            if (server.ip_address && server.ip_address !== clientIp) {
                // Permitir IPv6 loopback y IPv4 loopback para testing
                const isLoopback = clientIp === '::1' || clientIp === '127.0.0.1' ||
                                 clientIp === '::ffff:127.0.0.1';
                const registeredIp = server.ip_address;

                if (!isLoopback && registeredIp !== clientIp) {
                    console.warn(`[${serverId}] IP mismatch: registered ${registeredIp}, received from ${clientIp}`);
                    // Log pero permitir - puede haber NAT u otros problemas de red
                    console.warn(`⚠️  Allowing due to potential network configuration`);
                }
            }

            // Actualizar last_seen
            await Server.updateLastSeen(serverId);
        } catch (error) {
            console.error('Error validating server:', error);
            return res.status(500).json({ error: 'Server validation error' });
        }
    }

    backupStatuses[serverId] = statusUpdate;

    console.log(`[${serverId}] ${status}: ${message}`);

    // Guardar en BD si está lista
    if (dbReady) {
        try {
            await StatusHistory.add(serverId, status, message, progress, data, new Date());

            // Actualizar métricas diarias
            if (status === 'completed' || status === 'failed' || status === 'error') {
                await DailyMetrics.updateDaily(serverId);
            }
        } catch (error) {
            console.error('Error saving to database:', error);
        }
    }

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
        trackedServers: Object.keys(backupStatuses).length,
        dbReady: dbReady
    });
});

// ============================================
// History & Statistics Endpoints
// ============================================

// Get history for a specific server
app.get('/api/history/:serverId', async (req, res) => {
    const { serverId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const history = await StatusHistory.getByServerId(serverId, limit, offset);
        res.json(history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get history between dates
app.get('/api/history/:serverId/range', async (req, res) => {
    const { serverId } = req.params;
    const { startDate, endDate } = req.query;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const history = await StatusHistory.getByDateRange(serverId, startDate, endDate);
        res.json(history);
    } catch (error) {
        console.error('Error fetching date range history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get server statistics
app.get('/api/stats/:serverId', async (req, res) => {
    const { serverId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const stats = await StatusHistory.getStats(serverId);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get today's summary for a server
app.get('/api/summary/:serverId/today', async (req, res) => {
    const { serverId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const summary = await StatusHistory.getTodaysSummary(serverId);
        res.json(summary);
    } catch (error) {
        console.error('Error fetching today summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get daily metrics
app.get('/api/metrics/:serverId/daily', async (req, res) => {
    const { serverId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const metrics = await DailyMetrics.getLastMonth(serverId);
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching daily metrics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get list of all servers
app.get('/api/servers', async (req, res) => {
    try {
        if (!dbReady) {
            // Si BD no está lista, devolver servidores del estado actual
            return res.json(Object.keys(backupStatuses).map(id => ({ server_id: id })));
        }
        const servers = await Server.getAll();
        res.json(servers);
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get specific server
app.get('/api/servers/:serverId', async (req, res) => {
    const { serverId } = req.params;
    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }
        const server = await Server.getById(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        res.json(server);
    } catch (error) {
        console.error('Error fetching server:', error);
        res.status(500).json({ error: error.message });
    }
});

// Register a new server
app.post('/api/servers/register', async (req, res) => {
    const { serverId, displayName, ipAddress, description } = req.body;

    // Validación de parámetros requeridos
    if (!serverId || !displayName || !ipAddress) {
        return res.status(400).json({
            error: 'Missing required fields: serverId, displayName, ipAddress'
        });
    }

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        // Verificar si el servidor ya existe
        const existing = await Server.getById(serverId);
        if (existing) {
            return res.status(409).json({ error: 'Server ID already exists' });
        }

        // Verificar si la IP ya está registrada
        const existingIp = await Server.getByIp(ipAddress);
        if (existingIp) {
            return res.status(409).json({
                error: 'IP address already registered for another server'
            });
        }

        // Registrar nuevo servidor
        const server = await Server.register(serverId, displayName, ipAddress, description);
        console.log(`✓ Server registered: ${serverId} (${ipAddress})`);
        res.status(201).json(server);
    } catch (error) {
        console.error('Error registering server:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update server
app.put('/api/servers/:serverId', async (req, res) => {
    const { serverId } = req.params;
    const { displayName, description, isActive } = req.body;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const server = await Server.getById(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const updated = await Server.update(serverId, { displayName, description, isActive });
        console.log(`✓ Server updated: ${serverId}`);
        res.json(updated);
    } catch (error) {
        console.error('Error updating server:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete server
app.delete('/api/servers/:serverId', async (req, res) => {
    const { serverId } = req.params;

    try {
        if (!dbReady) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const server = await Server.getById(serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        await Server.delete(serverId);
        // También limpiar el estado en memoria
        delete backupStatuses[serverId];
        console.log(`✓ Server deleted: ${serverId}`);
        res.json({ success: true, message: `Server ${serverId} deleted` });
    } catch (error) {
        console.error('Error deleting server:', error);
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
