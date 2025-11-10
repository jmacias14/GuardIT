const pool = require('./config');

// Servidor functions
const Server = {
    // Obtener o crear servidor
    async upsert(serverId, displayName = null) {
        const query = `
            INSERT INTO servers (server_id, display_name)
            VALUES ($1, $2)
            ON CONFLICT (server_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const result = await pool.query(query, [serverId, displayName]);
        return result.rows[0];
    },

    // Obtener todos los servidores
    async getAll() {
        const query = `
            SELECT * FROM servers ORDER BY updated_at DESC;
        `;
        const result = await pool.query(query);
        return result.rows;
    },

    // Obtener servidor por ID
    async getById(serverId) {
        const query = `
            SELECT * FROM servers WHERE server_id = $1;
        `;
        const result = await pool.query(query, [serverId]);
        return result.rows[0];
    },

    // Obtener servidor por IP
    async getByIp(ipAddress) {
        const query = `
            SELECT * FROM servers WHERE ip_address = $1;
        `;
        const result = await pool.query(query, [ipAddress]);
        return result.rows[0];
    },

    // Registrar nuevo servidor
    async register(serverId, displayName, ipAddress, description = null) {
        const query = `
            INSERT INTO servers (server_id, display_name, ip_address, description, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING *;
        `;
        const result = await pool.query(query, [serverId, displayName, ipAddress, description]);
        return result.rows[0];
    },

    // Actualizar servidor
    async update(serverId, updateData) {
        const { displayName, description, isActive } = updateData;
        const query = `
            UPDATE servers
            SET display_name = COALESCE($2, display_name),
                description = COALESCE($3, description),
                is_active = COALESCE($4, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE server_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [serverId, displayName, description, isActive]);
        return result.rows[0];
    },

    // Actualizar last_seen
    async updateLastSeen(serverId) {
        const query = `
            UPDATE servers
            SET last_seen = CURRENT_TIMESTAMP
            WHERE server_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [serverId]);
        return result.rows[0];
    },

    // Eliminar servidor
    async delete(serverId) {
        const query = `
            DELETE FROM servers WHERE server_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [serverId]);
        return result.rows[0];
    }
};

// StatusHistory functions
const StatusHistory = {
    // Agregar nuevo estado al histórico
    async add(serverId, status, message, progress, data, lastUpdate) {
        // Primero asegurarse de que el servidor existe
        await Server.upsert(serverId);

        const query = `
            INSERT INTO status_history (server_id, status, message, progress, data, last_update)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const result = await pool.query(query, [
            serverId,
            status,
            message,
            progress,
            data ? JSON.stringify(data) : null,
            lastUpdate
        ]);
        return result.rows[0];
    },

    // Obtener histórico de un servidor
    async getByServerId(serverId, limit = 100, offset = 0) {
        const query = `
            SELECT * FROM status_history
            WHERE server_id = $1
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3;
        `;
        const result = await pool.query(query, [serverId, limit, offset]);
        return result.rows;
    },

    // Obtener histórico entre fechas
    async getByDateRange(serverId, startDate, endDate, limit = 1000) {
        const query = `
            SELECT * FROM status_history
            WHERE server_id = $1
            AND timestamp BETWEEN $2 AND $3
            ORDER BY timestamp DESC
            LIMIT $4;
        `;
        const result = await pool.query(query, [serverId, startDate, endDate, limit]);
        return result.rows;
    },

    // Obtener estado actual de un servidor
    async getLatest(serverId) {
        const query = `
            SELECT * FROM status_history
            WHERE server_id = $1
            ORDER BY timestamp DESC
            LIMIT 1;
        `;
        const result = await pool.query(query, [serverId]);
        return result.rows[0];
    },

    // Obtener resumen de estados de hoy
    async getTodaysSummary(serverId) {
        const query = `
            SELECT
                status,
                COUNT(*) as count,
                AVG(progress) as avg_progress
            FROM status_history
            WHERE server_id = $1
            AND DATE(timestamp) = CURRENT_DATE
            GROUP BY status;
        `;
        const result = await pool.query(query, [serverId]);
        return result.rows;
    },

    // Obtener estadísticas generales
    async getStats(serverId) {
        const query = `
            SELECT
                COUNT(*) as total_events,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status IN ('failed', 'error') THEN 1 END) as failed,
                COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
                COUNT(CASE WHEN status = 'warning' THEN 1 END) as warning,
                MIN(timestamp) as first_event,
                MAX(timestamp) as last_event
            FROM status_history
            WHERE server_id = $1;
        `;
        const result = await pool.query(query, [serverId]);
        return result.rows[0];
    }
};

// DailyMetrics functions
const DailyMetrics = {
    // Actualizar métricas diarias
    async updateDaily(serverId, date = null) {
        date = date || new Date().toISOString().split('T')[0];

        const query = `
            INSERT INTO daily_metrics (server_id, date, total_runs, successful_runs, failed_runs)
            SELECT
                $1,
                $2,
                COUNT(*) as total_runs,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_runs,
                COUNT(CASE WHEN status IN ('failed', 'error') THEN 1 END) as failed_runs
            FROM status_history
            WHERE server_id = $1 AND DATE(timestamp) = $2
            ON CONFLICT (server_id, date) DO UPDATE SET
                total_runs = EXCLUDED.total_runs,
                successful_runs = EXCLUDED.successful_runs,
                failed_runs = EXCLUDED.failed_runs,
                created_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const result = await pool.query(query, [serverId, date]);
        return result.rows[0];
    },

    // Obtener métricas de un rango de fechas
    async getByDateRange(serverId, startDate, endDate) {
        const query = `
            SELECT * FROM daily_metrics
            WHERE server_id = $1
            AND date BETWEEN $2 AND $3
            ORDER BY date ASC;
        `;
        const result = await pool.query(query, [serverId, startDate, endDate]);
        return result.rows;
    },

    // Obtener métricas del último mes
    async getLastMonth(serverId) {
        const query = `
            SELECT * FROM daily_metrics
            WHERE server_id = $1
            AND date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY date ASC;
        `;
        const result = await pool.query(query, [serverId]);
        return result.rows;
    }
};

module.exports = {
    pool,
    Server,
    StatusHistory,
    DailyMetrics
};
