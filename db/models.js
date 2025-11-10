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

// BackupTask functions
const BackupTask = {
    // Registrar nueva tarea de backup
    async register(taskId, displayName, taskType, description = null, serverId = null, schedule = 'daily', scheduleCron = null, comments = null) {
        const query = `
            INSERT INTO backup_tasks (task_id, display_name, task_type, description, server_id, is_active, schedule, schedule_cron, comments, enabled)
            VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, true)
            RETURNING *;
        `;
        const result = await pool.query(query, [taskId, displayName, taskType, description, serverId, schedule, scheduleCron, comments]);
        return result.rows[0];
    },

    // Obtener todas las tareas
    async getAll() {
        const query = `
            SELECT * FROM backup_tasks ORDER BY created_at DESC;
        `;
        const result = await pool.query(query);
        return result.rows;
    },

    // Obtener tareas por tipo
    async getByType(taskType) {
        const query = `
            SELECT * FROM backup_tasks WHERE task_type = $1 ORDER BY created_at DESC;
        `;
        const result = await pool.query(query, [taskType]);
        return result.rows;
    },

    // Obtener tareas de un servidor
    async getByServer(serverId) {
        const query = `
            SELECT * FROM backup_tasks WHERE server_id = $1 ORDER BY created_at DESC;
        `;
        const result = await pool.query(query, [serverId]);
        return result.rows;
    },

    // Obtener tarea por ID
    async getById(taskId) {
        const query = `
            SELECT * FROM backup_tasks WHERE task_id = $1;
        `;
        const result = await pool.query(query, [taskId]);
        return result.rows[0];
    },

    // Actualizar tarea
    async update(taskId, updateData) {
        const { displayName, description, taskType, serverId, isActive, schedule, scheduleCron, comments, enabled } = updateData;
        const query = `
            UPDATE backup_tasks
            SET display_name = COALESCE($2, display_name),
                description = COALESCE($3, description),
                task_type = COALESCE($4, task_type),
                server_id = COALESCE($5, server_id),
                is_active = COALESCE($6, is_active),
                schedule = COALESCE($7, schedule),
                schedule_cron = COALESCE($8, schedule_cron),
                comments = COALESCE($9, comments),
                enabled = COALESCE($10, enabled),
                updated_at = CURRENT_TIMESTAMP
            WHERE task_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [taskId, displayName, description, taskType, serverId, isActive, schedule, scheduleCron, comments, enabled]);
        return result.rows[0];
    },

    // Actualizar last_seen
    async updateLastSeen(taskId) {
        const query = `
            UPDATE backup_tasks
            SET last_seen = CURRENT_TIMESTAMP
            WHERE task_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [taskId]);
        return result.rows[0];
    },

    // Eliminar tarea
    async delete(taskId) {
        const query = `
            DELETE FROM backup_tasks WHERE task_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [taskId]);
        return result.rows[0];
    }
};

// StatusHistory functions
const StatusHistory = {
    // Agregar nuevo estado al histórico
    async add(taskId, status, message, progress, data) {
        const query = `
            INSERT INTO status_history (task_id, status, message, progress, data)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(query, [
            taskId,
            status,
            message,
            progress,
            data ? JSON.stringify(data) : null
        ]);
        return result.rows[0];
    },

    // Obtener histórico de una tarea
    async getByTaskId(taskId, limit = 100, offset = 0) {
        const query = `
            SELECT * FROM status_history
            WHERE task_id = $1
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3;
        `;
        const result = await pool.query(query, [taskId, limit, offset]);
        return result.rows;
    },

    // Obtener histórico entre fechas
    async getByDateRange(taskId, startDate, endDate, limit = 1000) {
        const query = `
            SELECT * FROM status_history
            WHERE task_id = $1
            AND timestamp BETWEEN $2 AND $3
            ORDER BY timestamp DESC
            LIMIT $4;
        `;
        const result = await pool.query(query, [taskId, startDate, endDate, limit]);
        return result.rows;
    },

    // Obtener estado actual de una tarea
    async getLatest(taskId) {
        const query = `
            SELECT * FROM status_history
            WHERE task_id = $1
            ORDER BY timestamp DESC
            LIMIT 1;
        `;
        const result = await pool.query(query, [taskId]);
        return result.rows[0];
    },

    // Obtener resumen de estados de hoy
    async getTodaysSummary(taskId) {
        const query = `
            SELECT
                status,
                COUNT(*) as count,
                AVG(progress) as avg_progress
            FROM status_history
            WHERE task_id = $1
            AND DATE(timestamp) = CURRENT_DATE
            GROUP BY status;
        `;
        const result = await pool.query(query, [taskId]);
        return result.rows;
    },

    // Obtener estadísticas generales
    async getStats(taskId) {
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
            WHERE task_id = $1;
        `;
        const result = await pool.query(query, [taskId]);
        return result.rows[0];
    }
};

// DailyMetrics functions
const DailyMetrics = {
    // Actualizar métricas diarias
    async updateDaily(taskId, date = null) {
        date = date || new Date().toISOString().split('T')[0];

        const query = `
            INSERT INTO daily_metrics (task_id, date, total_runs, successful_runs, failed_runs)
            SELECT
                $1,
                $2,
                COUNT(*) as total_runs,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_runs,
                COUNT(CASE WHEN status IN ('failed', 'error') THEN 1 END) as failed_runs
            FROM status_history
            WHERE task_id = $1 AND DATE(timestamp) = $2
            ON CONFLICT (task_id, date) DO UPDATE SET
                total_runs = EXCLUDED.total_runs,
                successful_runs = EXCLUDED.successful_runs,
                failed_runs = EXCLUDED.failed_runs,
                created_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const result = await pool.query(query, [taskId, date]);
        return result.rows[0];
    },

    // Obtener métricas de un rango de fechas
    async getByDateRange(taskId, startDate, endDate) {
        const query = `
            SELECT * FROM daily_metrics
            WHERE task_id = $1
            AND date BETWEEN $2 AND $3
            ORDER BY date ASC;
        `;
        const result = await pool.query(query, [taskId, startDate, endDate]);
        return result.rows;
    },

    // Obtener métricas del último mes
    async getLastMonth(taskId) {
        const query = `
            SELECT * FROM daily_metrics
            WHERE task_id = $1
            AND date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY date ASC;
        `;
        const result = await pool.query(query, [taskId]);
        return result.rows;
    }
};

// Dashboard functions
const Dashboard = {
    // Crear nuevo dashboard
    async create(dashboardId, displayName, description = null) {
        const query = `
            INSERT INTO dashboards (dashboard_id, display_name, description, is_active)
            VALUES ($1, $2, $3, true)
            RETURNING *;
        `;
        const result = await pool.query(query, [dashboardId, displayName, description]);
        return result.rows[0];
    },

    // Obtener todos los dashboards
    async getAll() {
        const query = `
            SELECT * FROM dashboards ORDER BY created_at DESC;
        `;
        const result = await pool.query(query);
        return result.rows;
    },

    // Obtener dashboard por ID
    async getById(dashboardId) {
        const query = `
            SELECT * FROM dashboards WHERE dashboard_id = $1;
        `;
        const result = await pool.query(query, [dashboardId]);
        return result.rows[0];
    },

    // Actualizar dashboard
    async update(dashboardId, updateData) {
        const { displayName, description, isActive } = updateData;
        const query = `
            UPDATE dashboards
            SET display_name = COALESCE($2, display_name),
                description = COALESCE($3, description),
                is_active = COALESCE($4, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE dashboard_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [dashboardId, displayName, description, isActive]);
        return result.rows[0];
    },

    // Eliminar dashboard
    async delete(dashboardId) {
        const query = `
            DELETE FROM dashboards WHERE dashboard_id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [dashboardId]);
        return result.rows[0];
    }
};

// Dashboard Source functions (Many-to-Many assignment)
const DashboardSource = {
    // Agregar fuente a dashboard
    async add(dashboardId, taskId, widgetType = 'status', widgetConfig = null) {
        const query = `
            INSERT INTO dashboard_sources (dashboard_id, task_id, widget_type, widget_config, display_order)
            VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM dashboard_sources WHERE dashboard_id = $1))
            ON CONFLICT (dashboard_id, task_id, widget_type) DO UPDATE
            SET widget_config = $4, updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const result = await pool.query(query, [dashboardId, taskId, widgetType, widgetConfig ? JSON.stringify(widgetConfig) : null]);
        return result.rows[0];
    },

    // Obtener todas las fuentes de un dashboard
    async getByDashboard(dashboardId) {
        const query = `
            SELECT ds.*, bt.display_name, bt.task_type, bt.description
            FROM dashboard_sources ds
            JOIN backup_tasks bt ON ds.task_id = bt.task_id
            WHERE ds.dashboard_id = $1
            ORDER BY ds.display_order ASC;
        `;
        const result = await pool.query(query, [dashboardId]);
        return result.rows;
    },

    // Obtener una fuente específica
    async get(dashboardId, taskId, widgetType) {
        const query = `
            SELECT ds.*, bt.display_name, bt.task_type
            FROM dashboard_sources ds
            JOIN backup_tasks bt ON ds.task_id = bt.task_id
            WHERE ds.dashboard_id = $1 AND ds.task_id = $2 AND ds.widget_type = $3;
        `;
        const result = await pool.query(query, [dashboardId, taskId, widgetType]);
        return result.rows[0];
    },

    // Actualizar configuración de widget
    async updateWidget(dashboardId, taskId, widgetType, widgetConfig) {
        const query = `
            UPDATE dashboard_sources
            SET widget_config = $4
            WHERE dashboard_id = $1 AND task_id = $2 AND widget_type = $3
            RETURNING *;
        `;
        const result = await pool.query(query, [dashboardId, taskId, widgetType, widgetConfig ? JSON.stringify(widgetConfig) : null]);
        return result.rows[0];
    },

    // Eliminar fuente de dashboard
    async remove(dashboardId, taskId, widgetType = null) {
        let query, params;
        if (widgetType) {
            query = `
                DELETE FROM dashboard_sources
                WHERE dashboard_id = $1 AND task_id = $2 AND widget_type = $3
                RETURNING *;
            `;
            params = [dashboardId, taskId, widgetType];
        } else {
            query = `
                DELETE FROM dashboard_sources
                WHERE dashboard_id = $1 AND task_id = $2
                RETURNING *;
            `;
            params = [dashboardId, taskId];
        }
        const result = await pool.query(query, params);
        return result.rows;
    }
};

// Alerts functions
const Alert = {
    // Crear alerta
    async create(taskId, alertType, keyword, message, severity) {
        const query = `
            INSERT INTO alerts (task_id, alert_type, keyword, message, status, severity)
            VALUES ($1, $2, $3, $4, 'active', $5)
            RETURNING *;
        `;
        const result = await pool.query(query, [taskId, alertType, keyword, message, severity]);
        return result.rows[0];
    },

    // Obtener todas las alertas activas
    async getAllActive(limit = 100) {
        const query = `
            SELECT a.*, bt.display_name, bt.task_type
            FROM alerts a
            JOIN backup_tasks bt ON a.task_id = bt.task_id
            WHERE a.status = 'active'
            ORDER BY a.severity DESC, a.created_at DESC
            LIMIT $1;
        `;
        const result = await pool.query(query, [limit]);
        return result.rows;
    },

    // Obtener alertas de una tarea
    async getByTask(taskId, status = null, limit = 50) {
        let query, params;
        if (status) {
            query = `
                SELECT * FROM alerts
                WHERE task_id = $1 AND status = $2
                ORDER BY created_at DESC
                LIMIT $3;
            `;
            params = [taskId, status, limit];
        } else {
            query = `
                SELECT * FROM alerts
                WHERE task_id = $1
                ORDER BY created_at DESC
                LIMIT $2;
            `;
            params = [taskId, limit];
        }
        const result = await pool.query(query, params);
        return result.rows;
    },

    // Reconocer alerta
    async acknowledge(alertId) {
        const query = `
            UPDATE alerts
            SET status = 'acknowledged'
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [alertId]);
        return result.rows[0];
    },

    // Resolver alerta
    async resolve(alertId) {
        const query = `
            UPDATE alerts
            SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [alertId]);
        return result.rows[0];
    },

    // Obtener alertas recientes para una tarea
    async getRecent(taskId, hoursBack = 24) {
        const query = `
            SELECT * FROM alerts
            WHERE task_id = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 hour' * $2
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query, [taskId, hoursBack]);
        return result.rows;
    }
};

// Keywords functions
const Keyword = {
    // Obtener todas las palabras clave
    async getAll() {
        const query = `
            SELECT * FROM keywords WHERE is_active = true ORDER BY keyword ASC;
        `;
        const result = await pool.query(query);
        return result.rows;
    },

    // Obtener palabra clave por nombre
    async get(keyword) {
        const query = `
            SELECT * FROM keywords WHERE LOWER(keyword) = LOWER($1);
        `;
        const result = await pool.query(query, [keyword]);
        return result.rows[0];
    },

    // Crear palabra clave personalizada
    async create(keyword, alertType, severity, description = null) {
        const query = `
            INSERT INTO keywords (keyword, alert_type, severity, description, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING *;
        `;
        const result = await pool.query(query, [keyword, alertType, severity, description]);
        return result.rows[0];
    },

    // Actualizar palabra clave
    async update(keywordId, updateData) {
        const { severity, description, isActive } = updateData;
        const query = `
            UPDATE keywords
            SET severity = COALESCE($2, severity),
                description = COALESCE($3, description),
                is_active = COALESCE($4, is_active)
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [keywordId, severity, description, isActive]);
        return result.rows[0];
    },

    // Eliminar palabra clave
    async delete(keywordId) {
        const query = `
            DELETE FROM keywords WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [keywordId]);
        return result.rows[0];
    },

    // Detectar palabras clave en un mensaje
    async detectKeywords(message) {
        const keywords = await this.getAll();
        const detected = [];

        const lowerMessage = message.toLowerCase();
        for (const kw of keywords) {
            if (lowerMessage.includes(kw.keyword.toLowerCase())) {
                detected.push(kw);
            }
        }

        return detected;
    }
};

module.exports = {
    pool,
    Server,
    BackupTask,
    StatusHistory,
    DailyMetrics,
    Dashboard,
    DashboardSource,
    Alert,
    Keyword
};
