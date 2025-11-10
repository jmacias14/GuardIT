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
            );
            CREATE INDEX IF NOT EXISTS idx_servers_server_id ON servers(server_id);
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
            );
            CREATE INDEX IF NOT EXISTS idx_backup_tasks_task_id ON backup_tasks(task_id);
            CREATE INDEX IF NOT EXISTS idx_backup_tasks_server_id ON backup_tasks(server_id);
            CREATE INDEX IF NOT EXISTS idx_backup_tasks_task_type ON backup_tasks(task_type);
            CREATE INDEX IF NOT EXISTS idx_backup_tasks_is_active ON backup_tasks(is_active);
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
            );
            CREATE INDEX IF NOT EXISTS idx_status_history_task_id ON status_history(task_id);
            CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON status_history(timestamp);
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
            );
            CREATE INDEX IF NOT EXISTS idx_daily_metrics_task_id ON daily_metrics(task_id);
            CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
        `);
        console.log('✓ Daily metrics table created');

        console.log('✓ Database initialization completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error initializing database:', error);
        process.exit(1);
    }
};

initDB();
