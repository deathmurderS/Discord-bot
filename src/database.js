/**
 * Database Handler for K3I Monitor Bot
 * 
 * @author opisboy29
 * @description SQLite database handler for storing historical user count data
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseHandler {
    constructor() {
        this.db = null;
        this.dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'k3i_monitor.db');
        this.logging = process.env.DATABASE_LOGGING === 'true';
    }

    /**
     * Initialize database connection and create tables
     */
    async initialize() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Open database connection
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Database connection failed:', err.message);
                    throw err;
                }
                console.log('✅ Database connected successfully');
            });

            // Create tables
            await this.createTables();
            
            // Setup periodic cleanup
            this.setupCleanup();
            
            console.log('✅ Database initialization completed');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create necessary database tables
     */
    async createTables() {
        return new Promise((resolve, reject) => {
            const createTablesSQL = `
                CREATE TABLE IF NOT EXISTS user_counts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_count INTEGER NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    source TEXT DEFAULT 'api'
                );

                CREATE TABLE IF NOT EXISTS daily_summary (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    max_users INTEGER NOT NULL,
                    min_users INTEGER NOT NULL,
                    avg_users REAL NOT NULL,
                    total_records INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(date)
                );

                CREATE INDEX IF NOT EXISTS idx_user_counts_timestamp ON user_counts(timestamp);
                CREATE INDEX IF NOT EXISTS idx_user_counts_date ON user_counts(date(timestamp));
            `;

            this.db.exec(createTablesSQL, (err) => {
                if (err) {
                    console.error('❌ Failed to create tables:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Database tables created successfully');
                    resolve();
                }
            });
        });
    }

    /**
     * Insert user count record
     * @param {number} userCount - Number of users currently logged in
     * @param {string} source - Source of the data (api, test, manual)
     */
    async insertUserCount(userCount, source = 'api') {
        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO user_counts (user_count, source) VALUES (?, ?)`;
            
            this.db.run(sql, [userCount, source], function(err) {
                if (err) {
                    console.error('❌ Failed to insert user count:', err.message);
                    reject(err);
                } else {
                    if (this.logging) {
                        console.log(`📝 Inserted user count: ${userCount} (${source})`);
                    }
                    resolve(this.lastID);
                }
            });
        });
    }

    /**
     * Get latest user count
     */
    async getLatestUserCount() {
        return new Promise((resolve, reject) => {
            const sql = `SELECT user_count, timestamp FROM user_counts ORDER BY timestamp DESC LIMIT 1`;
            
            this.db.get(sql, [], (err, row) => {
                if (err) {
                    console.error('❌ Failed to get latest user count:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get user count statistics for today
     */
    async getTodayStats() {
        return new Promise((resolve, reject) => {
            const today = new Date().toISOString().split('T')[0];
            const sql = `
                SELECT 
                    MAX(user_count) as max_users,
                    MIN(user_count) as min_users,
                    AVG(user_count) as avg_users,
                    COUNT(*) as total_records
                FROM user_counts 
                WHERE date(timestamp) = ?
            `;

            this.db.get(sql, [today], (err, row) => {
                if (err) {
                    console.error('❌ Failed to get today stats:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get user count statistics for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     */
    async getDateStats(date) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    MAX(user_count) as max_users,
                    MIN(user_count) as min_users,
                    AVG(user_count) as avg_users,
                    COUNT(*) as total_records
                FROM user_counts 
                WHERE date(timestamp) = ?
            `;

            this.db.get(sql, [date], (err, row) => {
                if (err) {
                    console.error('❌ Failed to get date stats:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Get historical data for the last N hours
     * @param {number} hours - Number of hours to look back
     */
    async getHistoricalData(hours = 24) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    user_count,
                    timestamp
                FROM user_counts 
                WHERE timestamp >= datetime('now', '-${hours} hours')
                ORDER BY timestamp ASC
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('❌ Failed to get historical data:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Get daily summary statistics
     * @param {number} days - Number of days to look back
     */
    async getDailySummary(days = 7) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    date,
                    max_users,
                    min_users,
                    ROUND(avg_users, 2) as avg_users,
                    total_records,
                    created_at
                FROM daily_summary 
                WHERE date >= date('now', '-${days} days')
                ORDER BY date DESC
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('❌ Failed to get daily summary:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Update daily summary for today
     */
    async updateDailySummary() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const stats = await this.getTodayStats();
            
            if (stats && stats.total_records > 0) {
                const sql = `
                    INSERT OR REPLACE INTO daily_summary 
                    (date, max_users, min_users, avg_users, total_records)
                    VALUES (?, ?, ?, ?, ?)
                `;

                await new Promise((resolve, reject) => {
                    this.db.run(sql, [
                        today,
                        stats.max_users,
                        stats.min_users,
                        Math.round(stats.avg_users * 100) / 100,
                        stats.total_records
                    ], (err) => {
                        if (err) {
                            console.error('❌ Failed to update daily summary:', err.message);
                            reject(err);
                        } else {
                            console.log(`📊 Daily summary updated for ${today}`);
                            resolve();
                        }
                    });
                });
            }
        } catch (error) {
            console.error('❌ Failed to update daily summary:', error);
        }
    }

    /**
     * Cleanup old records (keep last 30 days)
     */
    async cleanupOldRecords() {
        try {
            const sql = `DELETE FROM user_counts WHERE timestamp < datetime('now', '-30 days')`;
            
            await new Promise((resolve, reject) => {
                this.db.run(sql, [], (err) => {
                    if (err) {
                        console.error('❌ Failed to cleanup old records:', err.message);
                        reject(err);
                    } else {
                        console.log('🧹 Old records cleaned up');
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.error('❌ Cleanup failed:', error);
        }
    }

    /**
     * Get database statistics
     */
    async getDatabaseStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    (SELECT COUNT(*) FROM user_counts) as total_records,
                    (SELECT COUNT(*) FROM daily_summary) as summary_records,
                    (SELECT MIN(timestamp) FROM user_counts) as first_record,
                    (SELECT MAX(timestamp) FROM user_counts) as last_record
            `;

            this.db.get(sql, [], (err, row) => {
                if (err) {
                    console.error('❌ Failed to get database stats:', err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Setup periodic cleanup (daily at 2 AM)
     */
    setupCleanup() {
        const cron = require('node-cron');
        
        // Run cleanup daily at 2 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('🧹 Running scheduled database cleanup...');
            await this.cleanupOldRecords();
            await this.updateDailySummary();
        });

        console.log('⏰ Database cleanup scheduled for daily at 2 AM');
    }

    /**
     * Close database connection
     */
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('❌ Failed to close database:', err.message);
                        reject(err);
                    } else {
                        console.log('✅ Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = DatabaseHandler;