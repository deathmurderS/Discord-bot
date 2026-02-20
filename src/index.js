/**
 * K3I Monitor Bot - Main Application
 * 
 * @author opisboy29
 * @description Main entry point for the K3I Monitor Bot
 */

require('dotenv').config();
const APIServer = require('./api-server');
const logger = require('./utils/logger');

class K3IMonitorBot {
    constructor() {
        this.apiServer = null;
        this.isRunning = false;
    }

    /**
     * Start the K3I Monitor Bot
     */
    async start() {
        try {
            console.log('🚀 Starting K3I Monitor Bot...');
            console.log('='.repeat(60));
            
            // Check environment configuration
            this.validateEnvironment();
            
            // Initialize and start API server
            this.apiServer = new APIServer();
            await this.apiServer.start();
            
            this.isRunning = true;
            console.log('='.repeat(60));
            console.log('✅ K3I Monitor Bot started successfully!');
            console.log('📡 API Server: http://localhost:' + (process.env.PORT || 3001));
            console.log('📊 Status: http://localhost:' + (process.env.PORT || 3001) + '/status');
            console.log('📈 User Count Endpoint: http://localhost:' + (process.env.PORT || 3001) + '/api/k3i/user-count');
            console.log('💡 Send POST request with { "userCount": 42 } to update status');
            console.log('='.repeat(60));
            
        } catch (error) {
            console.error('❌ Failed to start K3I Monitor Bot:', error);
            process.exit(1);
        }
    }

    /**
     * Validate environment configuration
     */
    validateEnvironment() {
        console.log('🔍 Validating environment configuration...');
        
        const required = [
            { key: 'DISCORD_BOT_TOKEN', description: 'Discord bot token' },
            { key: 'DISCORD_SERVER_ID', description: 'Discord server ID' }
        ];

        let hasErrors = false;
        
        for (const config of required) {
            const value = process.env[config.key];
            if (!value) {
                console.error(`❌ Missing required environment variable: ${config.key}`);
                console.error(`💡 Please set ${config.key} in your .env file`);
                hasErrors = true;
            } else {
                console.log(`✅ ${config.key}: Configured`);
            }
        }

        if (hasErrors) {
            console.log('\n📋 Required environment variables:');
            console.log('   DISCORD_BOT_TOKEN - Your Discord bot token');
            console.log('   DISCORD_SERVER_ID - Your Discord server ID');
            console.log('\n💡 Copy .env.example to .env and configure these values');
            process.exit(1);
        }

        // Show optional configuration
        console.log('\n⚙️ Optional configuration:');
        console.log(`   PORT: ${process.env.PORT || '3001'}`);
        console.log(`   STATUS_UPDATE_INTERVAL: ${process.env.STATUS_UPDATE_INTERVAL || '30'} seconds`);
        console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   BACKEND_API_ENDPOINT: ${process.env.BACKEND_API_ENDPOINT || 'Not set'}`);
        
        console.log('\n✅ Environment validation passed');
    }

    /**
     * Stop the bot
     */
    async stop() {
        if (this.isRunning && this.apiServer) {
            console.log('🛑 Stopping K3I Monitor Bot...');
            // The API server handles graceful shutdown through its own process handlers
        }
    }
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    process.exit(0);
});

// Start the bot if this file is run directly
if (require.main === module) {
    const bot = new K3IMonitorBot();
    bot.start().catch(error => {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    });
}

module.exports = K3IMonitorBot;