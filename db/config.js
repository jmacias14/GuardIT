const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'guardit',
    password: process.env.DB_PASSWORD || 'guardit_secure_password_123',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'guardit'
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = pool;
