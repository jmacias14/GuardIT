const pool = require('./config');

const initDB = async () => {
    try {
        console.log('Initializing database...');

        // Crear tabla de servidores
        await pool.query(`
            CREATE TABLE IF NOT EXISTS servers (
                id SERIAL PRIMARY KEY,
                server_id VARCHAR(255) UNIQUE NOT NULL,
                display_name VARCHAR(255),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ Servers table created');

        // Crear tabla de histórico de estados
        await pool.query(`
            CREATE TABLE IF NOT EXISTS status_history (
                id SERIAL PRIMARY KEY,
                server_id VARCHAR(255) NOT NULL REFERENCES servers(server_id),
                status VARCHAR(50) NOT NULL,
                message TEXT,
                progress INTEGER,
                data JSONB,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_update TIMESTAMP,
                FOREIGN KEY (server_id) REFERENCES servers(server_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_status_history_server_id ON status_history(server_id);
            CREATE INDEX IF NOT EXISTS idx_status_history_timestamp ON status_history(timestamp);
        `);
        console.log('✓ Status history table created');

        // Crear tabla de métricas/resumen diario
        await pool.query(`
            CREATE TABLE IF NOT EXISTS daily_metrics (
                id SERIAL PRIMARY KEY,
                server_id VARCHAR(255) NOT NULL REFERENCES servers(server_id),
                date DATE NOT NULL,
                total_runs INTEGER DEFAULT 0,
                successful_runs INTEGER DEFAULT 0,
                failed_runs INTEGER DEFAULT 0,
                avg_duration INTERVAL,
                uptime_percentage DECIMAL(5, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(server_id, date),
                FOREIGN KEY (server_id) REFERENCES servers(server_id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_daily_metrics_server_id ON daily_metrics(server_id);
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
