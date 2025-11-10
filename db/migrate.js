const pool = require('./config');

const initDB = async () => {
    try {
        console.log('Initializing database...');

        // Crear tabla de servidores (optional grouping reference)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS servers (
                id SERIAL PRIMARY KEY,
                server_id VARCHAR(255) UNIQUE NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                last_seen TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_servers_server_id ON servers(server_id)
        `);
        console.log('✓ Servers table created');

        // Crear tabla de tareas de backup
        await pool.query(`
            CREATE TABLE IF NOT EXISTS backup_tasks (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(255) UNIQUE NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                description TEXT,
                task_type VARCHAR(50),
                server_id VARCHAR(255) REFERENCES servers(server_id) ON DELETE SET NULL,
                is_active BOOLEAN DEFAULT true,
                last_seen TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_backup_tasks_task_id ON backup_tasks(task_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_backup_tasks_server_id ON backup_tasks(server_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_backup_tasks_task_type ON backup_tasks(task_type)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_backup_tasks_is_active ON backup_tasks(is_active)
        `);
        console.log('✓ Backup tasks table created');

        // Crear tabla de histórico de estados
        await pool.query(`
            CREATE TABLE IF NOT EXISTS status_history (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(255) NOT NULL REFERENCES backup_tasks(task_id),
                status VARCHAR(50) NOT NULL,
                message TEXT,
                progress INTEGER,
                data JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES backup_tasks(task_id) ON DELETE CASCADE
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_status_history_task_id ON status_history(task_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON status_history(timestamp)
        `);
        console.log('✓ Status history table created');

        // Crear tabla de métricas/resumen diario
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_metrics (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(255) NOT NULL REFERENCES backup_tasks(task_id),
                date DATE NOT NULL,
                total_runs INTEGER DEFAULT 0,
                successful_runs INTEGER DEFAULT 0,
                failed_runs INTEGER DEFAULT 0,
                avg_duration INTERVAL,
                uptime_percentage DECIMAL(5, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(task_id, date),
                FOREIGN KEY (task_id) REFERENCES backup_tasks(task_id) ON DELETE CASCADE
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_daily_metrics_task_id ON daily_metrics(task_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date)
        `);
        console.log('✓ Daily metrics table created');

        // Agregar campos adicionales a backup_tasks si no existen
        await pool.query(`
            ALTER TABLE backup_tasks
            ADD COLUMN IF NOT EXISTS schedule VARCHAR(50) DEFAULT 'daily',
            ADD COLUMN IF NOT EXISTS schedule_cron VARCHAR(255),
            ADD COLUMN IF NOT EXISTS comments TEXT,
            ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true
        `);
        console.log('✓ Backup tasks columns updated');

        // Crear tabla de dashboards
        await pool.query(`
            CREATE TABLE IF NOT EXISTS dashboards (
                id SERIAL PRIMARY KEY,
                dashboard_id VARCHAR(255) UNIQUE NOT NULL,
                display_name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_dashboards_dashboard_id ON dashboards(dashboard_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_dashboards_is_active ON dashboards(is_active)
        `);
        console.log('✓ Dashboards table created');

        // Crear tabla de asignaciones de fuentes a dashboards
        await pool.query(`
            CREATE TABLE IF NOT EXISTS dashboard_sources (
                id SERIAL PRIMARY KEY,
                dashboard_id VARCHAR(255) NOT NULL REFERENCES dashboards(dashboard_id) ON DELETE CASCADE,
                task_id VARCHAR(255) NOT NULL REFERENCES backup_tasks(task_id) ON DELETE CASCADE,
                display_order INTEGER DEFAULT 0,
                widget_type VARCHAR(50) DEFAULT 'status',
                widget_config JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(dashboard_id, task_id, widget_type)
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_dashboard_sources_dashboard_id ON dashboard_sources(dashboard_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_dashboard_sources_task_id ON dashboard_sources(task_id)
        `);
        console.log('✓ Dashboard sources table created');

        // Crear tabla de palabras clave para alertas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS keywords (
                id SERIAL PRIMARY KEY,
                keyword VARCHAR(100) UNIQUE NOT NULL,
                alert_type VARCHAR(50) NOT NULL,
                severity INTEGER DEFAULT 0,
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword)
        `);
        console.log('✓ Keywords table created');

        // Crear tabla de alertas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alerts (
                id SERIAL PRIMARY KEY,
                task_id VARCHAR(255) NOT NULL REFERENCES backup_tasks(task_id) ON DELETE CASCADE,
                alert_type VARCHAR(50) NOT NULL,
                keyword VARCHAR(100),
                message TEXT,
                status VARCHAR(50) DEFAULT 'active',
                severity INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP
            )
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_alerts_task_id ON alerts(task_id)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON alerts(alert_type)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at)
        `);
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)
        `);
        console.log('✓ Alerts table created');

        // Insertar palabras clave por defecto
        const keywords = [
            { keyword: 'error', alert_type: 'error', severity: 5, description: 'Critical error occurred' },
            { keyword: 'critical', alert_type: 'critical', severity: 5, description: 'Critical issue detected' },
            { keyword: 'failed', alert_type: 'error', severity: 4, description: 'Task failed' },
            { keyword: 'warning', alert_type: 'warning', severity: 3, description: 'Warning condition' },
            { keyword: 'incomplete', alert_type: 'warning', severity: 2, description: 'Incomplete execution' },
            { keyword: 'success', alert_type: 'success', severity: 1, description: 'Successful execution' },
            { keyword: 'completed', alert_type: 'success', severity: 1, description: 'Task completed' },
            { keyword: 'progress', alert_type: 'info', severity: 0, description: 'Progress update' },
            { keyword: 'timeout', alert_type: 'warning', severity: 4, description: 'Task timeout' },
            { keyword: 'retry', alert_type: 'warning', severity: 2, description: 'Retry attempt' },
            { keyword: 'files', alert_type: 'info', severity: 0, description: 'File operation info' },
            { keyword: 'speed', alert_type: 'info', severity: 0, description: 'Speed/performance metric' },
            { keyword: 'skipped', alert_type: 'warning', severity: 2, description: 'Task skipped' }
        ];

        for (const kw of keywords) {
            await pool.query(
                `INSERT INTO keywords (keyword, alert_type, severity, description, is_active)
                 VALUES ($1, $2, $3, $4, true)
                 ON CONFLICT (keyword) DO NOTHING`,
                [kw.keyword, kw.alert_type, kw.severity, kw.description]
            );
        }
        console.log('✓ Default keywords inserted');

        console.log('✓ Database initialization completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
};

initDB();
