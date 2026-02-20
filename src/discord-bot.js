/**
 * Discord Bot Handler for K3I Monitor Bot
 * 
 * @author opisboy29
 * @description Discord bot handler for updating status with real-time user count
 */

const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const DatabaseHandler = require('./database');

class DiscordBotHandler {
    constructor() {
        this.client = null;
        this.database = null;
        this.isReady = false;
        this.lastStatusUpdate = null;
        this.statusUpdateInterval = parseInt(process.env.STATUS_UPDATE_INTERVAL) || 30;
        this.botName = process.env.BOT_NAME || 'K3I Monitor Bot';
        this.serverId = process.env.DISCORD_SERVER_ID;
        
        // Status update tracking
        this.statusUpdateTimer = null;
        this.lastUserCount = 0;
        this.isUpdatingStatus = false;
    }

    /**
     * Initialize Discord bot and database
     */
    async initialize() {
        try {
            console.log('🤖 Initializing Discord Bot Handler...');
            
            // Initialize database
            this.database = new DatabaseHandler();
            await this.database.initialize();
            
            // Initialize Discord client
            this.client = new Client({
                intents: [
                    GatewayIntentBits.Guilds,
                    GatewayIntentBits.GuildMessages,
                    GatewayIntentBits.MessageContent
                ]
            });

            // Set up event handlers
            this.setupEventHandlers();
            
            // Login to Discord
            const token = process.env.DISCORD_BOT_TOKEN;
            if (!token) {
                throw new Error('DISCORD_BOT_TOKEN not configured');
            }

            await this.client.login(token);
            
            console.log('✅ Discord Bot Handler initialized successfully');
            
        } catch (error) {
            console.error('❌ Discord Bot Handler initialization failed:', error);
            throw error;
        }
    }

    /**
     * Set up Discord event handlers
     */
    setupEventHandlers() {
        this.client.once('ready', async () => {
            console.log(`✅ Bot logged in as ${this.client.user.tag}`);
            this.isReady = true;
            
            // Verify server access
            if (this.serverId) {
                const guild = this.client.guilds.cache.get(this.serverId);
                if (!guild) {
                    console.warn(`⚠️  Bot not in server ${this.serverId}`);
                } else {
                    console.log(`✅ Bot connected to server: ${guild.name}`);
                }
            }
            
            // Start status update loop
            this.startStatusUpdateLoop();
            
            // Set initial status
            await this.updateStatus();
        });

        this.client.on('error', (error) => {
            console.error('❌ Discord client error:', error);
        });

        this.client.on('warn', (warning) => {
            console.warn('⚠️ Discord client warning:', warning);
        });

        this.client.on('disconnect', () => {
            console.warn('⚠️ Discord client disconnected');
            this.isReady = false;
        });

        this.client.on('reconnecting', () => {
            console.log('🔄 Discord client reconnecting...');
        });

        this.client.on('resume', () => {
            console.log('✅ Discord client reconnected');
            this.isReady = true;
        });
    }

    /**
     * Start the status update loop
     */
    startStatusUpdateLoop() {
        if (this.statusUpdateTimer) {
            clearInterval(this.statusUpdateTimer);
        }

        this.statusUpdateTimer = setInterval(async () => {
            if (this.isReady && !this.isUpdatingStatus) {
                await this.updateStatus();
            }
        }, this.statusUpdateInterval * 1000);

        console.log(`⏰ Status update loop started (every ${this.statusUpdateInterval} seconds)`);
    }

    /**
     * Update Discord bot status with current user count
     */
    async updateStatus() {
        if (this.isUpdatingStatus) {
            return; // Prevent concurrent updates
        }

        this.isUpdatingStatus = true;

        try {
            // Get latest user count from database
            const latestData = await this.database.getLatestUserCount();
            
            if (!latestData) {
                // No data available yet, set default status
                await this.setBotStatus('No data available', ActivityType.Watching);
                this.lastUserCount = 0;
                return;
            }

            const userCount = latestData.user_count;
            const timestamp = new Date(latestData.timestamp);
            
            // Format status text
            const statusText = this.formatStatusText(userCount, timestamp);
            
            // Update status
            await this.setBotStatus(statusText, ActivityType.Watching);
            
            // Log status update
            if (userCount !== this.lastUserCount) {
                console.log(`📊 Status updated: ${statusText}`);
                this.lastUserCount = userCount;
            }
            
            this.lastStatusUpdate = new Date();

        } catch (error) {
            console.error('❌ Failed to update status:', error);
        } finally {
            this.isUpdatingStatus = false;
        }
    }

    /**
     * Set Discord bot status
     * @param {string} text - Status text
     * @param {ActivityType} type - Activity type
     */
    async setBotStatus(text, type = ActivityType.Watching) {
        if (!this.isReady || !this.client.user) {
            return;
        }

        try {
            await this.client.user.setActivity(text, {
                type: type
            });
        } catch (error) {
            console.error('❌ Failed to set bot status:', error);
        }
    }

    /**
     * Format status text with user count and timestamp
     * @param {number} userCount - Current user count
     * @param {Date} timestamp - Timestamp of the data
     */
    formatStatusText(userCount, timestamp) {
        const now = new Date();
        const timeDiff = Math.floor((now - timestamp) / 1000); // seconds
        
        let timeText = '';
        if (timeDiff < 60) {
            timeText = `${timeDiff}s ago`;
        } else if (timeDiff < 3600) {
            timeText = `${Math.floor(timeDiff / 60)}m ago`;
        } else {
            timeText = `${Math.floor(timeDiff / 3600)}h ago`;
        }

        // Format user count with commas
        const formattedCount = userCount.toLocaleString();
        
        return `${formattedCount} users online (${timeText})`;
    }

    /**
     * Handle manual user count update
     * @param {number} userCount - New user count
     * @param {string} source - Source of the update
     */
    async handleUserCountUpdate(userCount, source = 'api') {
        try {
            // Validate user count
            if (!Number.isInteger(userCount) || userCount < 0) {
                throw new Error('Invalid user count: must be non-negative integer');
            }

            // Insert into database
            await this.database.insertUserCount(userCount, source);
            
            // Update status immediately
            const timestamp = new Date();
            const statusText = this.formatStatusText(userCount, timestamp);
            await this.setBotStatus(statusText, ActivityType.Watching);
            
            console.log(`📊 Manual update: ${userCount} users (${source})`);
            
            return { success: true, userCount, timestamp: timestamp.toISOString() };
            
        } catch (error) {
            console.error('❌ Failed to handle user count update:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get current bot status information
     */
    getStatusInfo() {
        return {
            isReady: this.isReady,
            lastStatusUpdate: this.lastStatusUpdate,
            lastUserCount: this.lastUserCount,
            statusUpdateInterval: this.statusUpdateInterval,
            serverId: this.serverId,
            botName: this.botName
        };
    }

    /**
     * Get statistics for display
     */
    async getStatistics() {
        try {
            const todayStats = await this.database.getTodayStats();
            const latestData = await this.database.getLatestUserCount();
            const historicalData = await this.database.getHistoricalData(1); // Last 1 hour
            
            return {
                current: {
                    userCount: latestData ? latestData.user_count : 0,
                    timestamp: latestData ? latestData.timestamp : null
                },
                today: todayStats || {
                    max_users: 0,
                    min_users: 0,
                    avg_users: 0,
                    total_records: 0
                },
                recent: historicalData.slice(-10), // Last 10 records
                status: this.getStatusInfo()
            };
        } catch (error) {
            console.error('❌ Failed to get statistics:', error);
            return null;
        }
    }

    /**
     * Test database connection and bot status
     */
    async testConnection() {
        try {
            // Test database
            const dbStats = await this.database.getDatabaseStats();
            
            // Test bot status
            const statusInfo = this.getStatusInfo();
            
            return {
                database: {
                    connected: true,
                    totalRecords: dbStats.total_records,
                    summaryRecords: dbStats.summary_records,
                    firstRecord: dbStats.first_record,
                    lastRecord: dbStats.last_record
                },
                bot: {
                    connected: this.isReady,
                    status: statusInfo
                },
                success: true
            };
        } catch (error) {
            return {
                database: { connected: false, error: error.message },
                bot: { connected: false },
                success: false
            };
        }
    }

    /**
     * Close bot and database connections
     */
    async close() {
        try {
            console.log('🛑 Closing Discord Bot Handler...');
            
            // Stop status update loop
            if (this.statusUpdateTimer) {
                clearInterval(this.statusUpdateTimer);
                this.statusUpdateTimer = null;
            }
            
            // Disconnect Discord client
            if (this.client && this.client.isReady()) {
                await this.client.destroy();
                console.log('✅ Discord client disconnected');
            }
            
            // Close database
            if (this.database) {
                await this.database.close();
                console.log('✅ Database connection closed');
            }
            
            console.log('✅ Discord Bot Handler closed successfully');
            
        } catch (error) {
            console.error('❌ Failed to close Discord Bot Handler:', error);
        }
    }
}

module.exports = DiscordBotHandler;