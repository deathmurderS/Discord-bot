/**
 * Advanced Logger for K3I Monitor Bot
 * 
 * @author opisboy29
 * @description Enhanced logging utility with file rotation and structured logging
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logsDir = path.join(process.cwd(), 'logs');
        this.logFile = process.env.LOG_FILE || path.join(this.logsDir, 'k3i-monitor.log');
        this.enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.useColors = process.env.LOG_COLORS !== 'false';
        
        this.ensureLogsDirectory();
    }

    ensureLogsDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    getTimestamp() {
        return new Date().toISOString();
    }

    shouldLog(level) {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        
        return messageLevelIndex <= currentLevelIndex;
    }

    getColorCode(level) {
        if (!this.useColors) return '';
        
        const colors = {
            error: '\x1b[31m',    // Red
            warn: '\x1b[33m',     // Yellow
            info: '\x1b[36m',     // Cyan
            debug: '\x1b[35m',    // Magenta
            success: '\x1b[32m',  // Green
            status: '\x1b[34m'    // Blue
        };
        
        return colors[level] || '';
    }

    resetColor() {
        return this.useColors ? '\x1b[0m' : '';
    }

    formatMessage(level, message, extra = null) {
        const timestamp = this.getTimestamp();
        const pid = process.pid;
        let formattedMessage = `[${timestamp}] [PID:${pid}] [${level.toUpperCase()}] ${message}`;
        
        if (extra) {
            if (extra instanceof Error) {
                formattedMessage += `\n${extra.stack}`;
            } else if (typeof extra === 'object') {
                formattedMessage += `\n${JSON.stringify(extra, null, 2)}`;
            } else {
                formattedMessage += ` ${extra}`;
            }
        }
        
        return formattedMessage;
    }

    writeToFile(message) {
        if (!this.enableFileLogging) return;
        
        const logMessage = message + '\n';
        
        fs.appendFile(this.logFile, logMessage, (err) => {
            if (err) {
                console.error('Failed to write to log file:', err);
            }
        });
        
        // Check if log file needs rotation
        this.rotateLogFileIfNeeded();
    }

    rotateLogFileIfNeeded() {
        const maxSize = 50 * 1024 * 1024; // 50MB
        const filePath = this.logFile;
        
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > maxSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = `${filePath}.${timestamp}.backup`;
                
                fs.renameSync(filePath, backupPath);
                console.log(`Log file rotated: ${path.basename(filePath)} -> ${path.basename(backupPath)}`);
                
                // Keep only last 5 backup files
                this.cleanupOldLogFiles();
            }
        }
    }

    cleanupOldLogFiles() {
        const files = fs.readdirSync(this.logsDir)
            .filter(file => file.startsWith(path.basename(this.logFile)) && file.includes('.backup'))
            .map(file => ({
                name: file,
                path: path.join(this.logsDir, file),
                mtime: fs.statSync(path.join(this.logsDir, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

        // Keep only the 5 most recent backup files
        files.slice(5).forEach(file => {
            fs.unlinkSync(file.path);
            console.log(`Cleaned up old log backup: ${file.name}`);
        });
    }

    log(level, message, extra = null) {
        if (!this.shouldLog(level)) return;
        
        const colorCode = this.getColorCode(level);
        const resetCode = this.resetColor();
        const formatted = this.formatMessage(level, message, extra);
        
        // Console output with color
        console.log(`${colorCode}${formatted}${resetCode}`);
        
        // File output without color
        this.writeToFile(formatted);
    }

    error(message, extra = null) {
        this.log('error', message, extra);
    }

    warn(message, extra = null) {
        this.log('warn', message, extra);
    }

    info(message, extra = null) {
        this.log('info', message, extra);
    }

    debug(message, extra = null) {
        this.log('debug', message, extra);
    }

    success(message, extra = null) {
        this.log('success', message, extra);
    }

    status(message, extra = null) {
        this.log('status', message, extra);
    }

    // Application lifecycle logging
    startup(botName, version) {
        this.info('='.repeat(60));
        this.success(`${botName} v${version} Starting Up`);
        this.info(`Startup Time: ${this.getTimestamp()}`);
        this.info(`Node.js: ${process.version}`);
        this.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        this.info(`Working Directory: ${process.cwd()}`);
        this.info(`Process ID: ${process.pid}`);
        this.info('='.repeat(60));
    }

    shutdown(botName) {
        this.info('='.repeat(60));
        this.warn(`${botName} Shutting Down`);
        this.info(`Shutdown Time: ${this.getTimestamp()}`);
        this.info('='.repeat(60));
    }

    // Structured logging for API requests
    apiRequest(method, path, statusCode, responseTime) {
        const level = statusCode >= 400 ? 'warn' : 'info';
        const message = `${method} ${path} - ${statusCode} (${responseTime}ms)`;
        this.log(level, message);
    }

    // Database operation logging
    dbOperation(operation, table, success, duration) {
        const level = success ? 'info' : 'error';
        const status = success ? 'SUCCESS' : 'FAILED';
        const message = `DB ${operation} on ${table} - ${status} (${duration}ms)`;
        this.log(level, message);
    }

    // Discord bot operation logging
    discordOperation(operation, success, details) {
        const level = success ? 'info' : 'error';
        const status = success ? 'SUCCESS' : 'FAILED';
        const message = `Discord ${operation} - ${status}`;
        this.log(level, message, details);
    }
}

// Export singleton instance
module.exports = new Logger();