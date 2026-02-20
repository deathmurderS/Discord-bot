/**
 * API Server for K3I Monitor Bot
 * 
 * @author opisboy29
 * @description Express server to receive user count data from backend and provide monitoring endpoints
 */

const express = require('express');
const cors = require('cors');
const DatabaseHandler = require('./database');
const DiscordBotHandler = require('./discord-bot');

class APIServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.port = process.env.PORT || 3001;
        this.database = null;
        this.discordBot = null;
        
        // Configuration
        this.enableCORS = process.env.ENABLE_CORS === 'true';
        this.apiTimeout = parseInt(process.env.API_TIMEOUT) || 5000;
        this.backendAPIEndpoint = process.env.BACKEND_API_ENDPOINT;
        this.apiToken = process.env.BACKEND_API_TOKEN;
    }

    /**
     * Initialize API server
     */
    async initialize() {
        try {
            console.log('🌐 Initializing API Server...');
            
            // Setup Express app
            this.setupMiddleware();
            this.setupRoutes();
            
            // Initialize database
            this.database = new DatabaseHandler();
            await this.database.initialize();
            
            // Initialize Discord bot
            this.discordBot = new DiscordBotHandler();
            await this.discordBot.initialize();
            
            console.log('✅ API Server initialized successfully');
            
        } catch (error) {
            console.error('❌ API Server initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // CORS
        if (this.enableCORS) {
            this.app.use(cors({
                origin: '*',
                methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
            }));
        }

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging
        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            console.log(`📡 ${timestamp} ${req.method} ${req.path}`);
            next();
        });

        // API key validation middleware
        this.app.use('/api/k3i', (req, res, next) => {
            if (this.apiToken) {
                const token = req.headers['x-api-key'] || req.headers['authorization'];
                if (!token || token !== this.apiToken) {
                    return res.status(401).json({ 
                        success: false, 
                        error: 'Unauthorized: Invalid API token' 
                    });
                }
            }
            next();
        });
    }

    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: require('../package.json').version
            });
        });

        // Status endpoint
        this.app.get('/status', async (req, res) => {
            try {
                const stats = await this.discordBot.getStatistics();
                const connection = await this.discordBot.testConnection();
                
                res.json({
                    success: true,
                    statistics: stats,
                    connection: connection,
                    config: {
                        port: this.port,
                        enableCORS: this.enableCORS,
                        apiTimeout: this.apiTimeout,
                        backendAPIEndpoint: this.backendAPIEndpoint
                    }
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Database stats endpoint
        this.app.get('/api/k3i/stats', async (req, res) => {
            try {
                const stats = await this.database.getDatabaseStats();
                const todayStats = await this.database.getTodayStats();
                const dailySummary = await this.database.getDailySummary(7);
                
                res.json({
                    success: true,
                    database: stats,
                    today: todayStats,
                    dailySummary: dailySummary
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // User count endpoint (for receiving data from backend)
        this.app.post('/api/k3i/user-count', async (req, res) => {
            try {
                const { userCount, source = 'api', timestamp } = req.body;
                
                // Validate input
                if (!userCount && userCount !== 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'userCount is required'
                    });
                }

                if (!Number.isInteger(userCount) || userCount < 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'userCount must be a non-negative integer'
                    });
                }

                // Handle user count update
                const result = await this.discordBot.handleUserCountUpdate(userCount, source);
                
                if (result.success) {
                    res.json({
                        success: true,
                        message: 'User count updated successfully',
                        data: result
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        error: result.error
                    });
                }
                
            } catch (error) {
                console.error('❌ Error handling user count update:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Manual user count endpoint (for testing)
        this.app.post('/api/k3i/manual-count', async (req, res) => {
            try {
                const { userCount, source = 'manual' } = req.body;
                
                // Validate input
                if (!userCount && userCount !== 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'userCount is required'
                    });
                }

                if (!Number.isInteger(userCount) || userCount < 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'userCount must be a non-negative integer'
                    });
                }

                // Handle manual update
                const result = await this.discordBot.handleUserCountUpdate(userCount, source);
                
                if (result.success) {
                    res.json({
                        success: true,
                        message: 'Manual user count updated successfully',
                        data: result
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        error: result.error
                    });
                }
                
            } catch (error) {
                console.error('❌ Error handling manual user count update:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get current user count
        this.app.get('/api/k3i/current', async (req, res) => {
            try {
                const latestData = await this.database.getLatestUserCount();
                
                if (latestData) {
                    res.json({
                        success: true,
                        data: {
                            userCount: latestData.user_count,
                            timestamp: latestData.timestamp,
                            source: latestData.source
                        }
                    });
                } else {
                    res.json({
                        success: true,
                        data: {
                            userCount: 0,
                            timestamp: null,
                            source: null
                        }
                    });
                }
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get historical data
        this.app.get('/api/k3i/history', async (req, res) => {
            try {
                const hours = parseInt(req.query.hours) || 24;
                const data = await this.database.getHistoricalData(hours);
                
                res.json({
                    success: true,
                    data: data,
                    hours: hours
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get daily summary
        this.app.get('/api/k3i/daily', async (req, res) => {
            try {
                const days = parseInt(req.query.days) || 7;
                const summary = await this.database.getDailySummary(days);
                
                res.json({
                    success: true,
                    data: summary,
                    days: days
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Test endpoint (for testing API connectivity)
        this.app.get('/api/k3i/test', (req, res) => {
            res.json({
                success: true,
                message: 'API is working correctly',
                timestamp: new Date().toISOString(),
                endpoint: '/api/k3i/test'
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                path: req.path
            });
        });

        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('❌ API Error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        });
    }

    /**
     * Start the API server
     */
    async start() {
        try {
            await this.initialize();
            
            this.server = this.app.listen(this.port, () => {
                console.log(`🌐 API Server running on port ${this.port}`);
                console.log(`📡 Health check: http://localhost:${this.port}/health`);
                console.log(`📊 Status: http://localhost:${this.port}/status`);
                console.log(`📈 User count endpoint: http://localhost:${this.port}/api/k3i/user-count`);
            });
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
        } catch (error) {
            console.error('❌ Failed to start API server:', error);
            throw error;
        }
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
            
            try {
                // Stop accepting new requests
                if (this.server) {
                    this.server.close(async () => {
                        console.log('✅ HTTP server closed');
                        
                        // Close Discord bot and database
                        if (this.discordBot) {
                            await this.discordBot.close();
                        }
                        
                        if (this.database) {
                            await this.database.close();
                        }
                        
                        console.log('✅ All connections closed');
                        process.exit(0);
                    });
                }
                
                // Force exit after 10 seconds
                setTimeout(() => {
                    console.error('❌ Force exit after timeout');
                    process.exit(1);
                }, 10000);
                
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }

    /**
     * Test API connectivity
     */
    async testAPI() {
        try {
            const response = await fetch(`http://localhost:${this.port}/api/k3i/test`);
            const data = await response.json();
            
            return {
                success: data.success,
                message: data.message,
                timestamp: data.timestamp
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = APIServer;