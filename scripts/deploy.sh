#!/bin/bash

# K3I Monitor Bot Deployment Script
# 
# @author opisboy29
# @description Automated deployment script for K3I Monitor Bot

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/deployment.log"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$LOG_FILE"
}

# Check if running as root (for system-wide installations)
check_permissions() {
    if [[ $EUID -eq 0 ]]; then
        warn "Running as root. This script will install system-wide."
        INSTALL_TYPE="system"
    else
        info "Running as user. This script will install locally."
        INSTALL_TYPE="user"
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 16+ first."
    fi
    
    NODE_VERSION=$(node -v)
    log "Node.js version: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm first."
    fi
    
    NPM_VERSION=$(npm -v)
    log "npm version: $NPM_VERSION"
    
    # Check if PM2 is installed (optional)
    if command -v pm2 &> /dev/null; then
        PM2_VERSION=$(pm2 -v)
        log "PM2 version: $PM2_VERSION"
        PM2_INSTALLED=true
    else
        warn "PM2 not found. Will install PM2 for production deployment."
        PM2_INSTALLED=false
    fi
}

# Create backup
create_backup() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
    fi
    
    BACKUP_NAME="k3i-monitor-bot-backup-$TIMESTAMP"
    BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
    
    log "Creating backup at: $BACKUP_PATH"
    
    # Create backup excluding node_modules and logs
    tar -czf "$BACKUP_PATH.tar.gz" \
        --exclude="node_modules" \
        --exclude="logs" \
        --exclude="backups" \
        --exclude=".git" \
        -C "$PROJECT_DIR" .
    
    if [ $? -eq 0 ]; then
        log "Backup created successfully: $BACKUP_PATH.tar.gz"
    else
        warn "Backup creation failed, but continuing with deployment"
    fi
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    cd "$PROJECT_DIR"
    
    # Install dependencies
    npm install
    
    if [ $? -eq 0 ]; then
        log "Dependencies installed successfully"
    else
        error "Failed to install dependencies"
    fi
}

# Setup environment
setup_environment() {
    log "Setting up environment..."
    
    # Check if .env exists
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        if [ -f "$PROJECT_DIR/.env.example" ]; then
            log "Copying .env.example to .env"
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            warn "Please edit .env file with your configuration"
        else
            error "No .env.example file found"
        fi
    else
        log "Environment file already exists"
    fi
}

# Validate configuration
validate_configuration() {
    log "Validating configuration..."
    
    # Check required environment variables
    if [ -f "$PROJECT_DIR/.env" ]; then
        source "$PROJECT_DIR/.env"
        
        if [ -z "$DISCORD_BOT_TOKEN" ]; then
            error "DISCORD_BOT_TOKEN is not set in .env file"
        fi
        
        if [ -z "$DISCORD_SERVER_ID" ]; then
            error "DISCORD_SERVER_ID is not set in .env file"
        fi
        
        log "Configuration validation passed"
    else
        warn "No .env file found, skipping configuration validation"
    fi
}

# Install PM2 (if needed)
install_pm2() {
    if [ "$PM2_INSTALLED" = false ]; then
        log "Installing PM2 globally..."
        
        if [ "$INSTALL_TYPE" = "system" ]; then
            npm install -g pm2
        else
            npm install -g --user pm2
        fi
        
        if [ $? -eq 0 ]; then
            log "PM2 installed successfully"
        else
            error "Failed to install PM2"
        fi
    fi
}

# Setup PM2 ecosystem
setup_pm2() {
    log "Setting up PM2 ecosystem..."
    
    cat > "$PROJECT_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'k3i-monitor-bot',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    node_args: '--max_old_space_size=1024',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 5,
    restart_delay: 4000,
    kill_timeout: 5000,
    listen_timeout: 8000,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

    log "PM2 ecosystem configuration created"
}

# Start the bot
start_bot() {
    log "Starting K3I Monitor Bot..."
    
    cd "$PROJECT_DIR"
    
    # Check if bot is already running
    if pm2 list | grep -q "k3i-monitor-bot"; then
        log "Bot is already running, restarting..."
        pm2 restart k3i-monitor-bot
    else
        log "Starting bot for the first time..."
        pm2 start ecosystem.config.js
    fi
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup
    pm2 startup
    
    log "Bot started successfully"
    log "Use 'pm2 status' to check status"
    log "Use 'pm2 logs k3i-monitor-bot' to view logs"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Wait for bot to start
    sleep 5
    
    # Check if bot is running
    if pm2 list | grep -q "k3i-monitor-bot.*online"; then
        log "✅ Bot is running and online"
    else
        warn "⚠️ Bot may not be fully started yet"
    fi
    
    # Check API endpoint (if available)
    PORT=$(grep "^PORT=" "$PROJECT_DIR/.env" | cut -d'=' -f2)
    PORT=${PORT:-3001}
    
    if curl -s "http://localhost:$PORT/health" > /dev/null; then
        log "✅ API endpoint is responding"
    else
        warn "⚠️ API endpoint may not be ready yet"
    fi
}

# Show deployment summary
show_summary() {
    log "Deployment completed successfully!"
    echo ""
    echo "📊 Deployment Summary:"
    echo "   Project Directory: $PROJECT_DIR"
    echo "   Log File: $LOG_FILE"
    echo "   Backup: $BACKUP_DIR"
    echo ""
    echo "🚀 Bot Management Commands:"
    echo "   pm2 status                    # Check bot status"
    echo "   pm2 logs k3i-monitor-bot      # View bot logs"
    echo "   pm2 restart k3i-monitor-bot   # Restart bot"
    echo "   pm2 stop k3i-monitor-bot      # Stop bot"
    echo ""
    echo "🌐 API Endpoints:"
    echo "   http://localhost:3001/health  # Health check"
    echo "   http://localhost:3001/status  # Bot status"
    echo ""
    echo "💡 Next Steps:"
    echo "   1. Edit .env file with your Discord bot configuration"
    echo "   2. Invite your bot to your Discord server"
    echo "   3. Test the API endpoints"
    echo "   4. Configure your NestJS backend to send user count data"
    echo ""
}

# Cleanup old backups
cleanup_old_backups() {
    if [ -d "$BACKUP_DIR" ]; then
        log "Cleaning up old backups (keeping last 5)..."
        
        # Keep only the 5 most recent backup files
        ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm
        
        if [ $? -eq 0 ]; then
            log "Old backups cleaned up"
        else
            warn "Failed to clean up old backups"
        fi
    fi
}

# Main deployment function
main() {
    echo "🤖 K3I Monitor Bot Deployment Script"
    echo "===================================="
    echo ""
    
    # Initialize log file
    echo "Deployment started at $(date)" > "$LOG_FILE"
    
    # Run deployment steps
    check_permissions
    check_prerequisites
    create_backup
    install_dependencies
    setup_environment
    validate_configuration
    install_pm2
    setup_pm2
    start_bot
    health_check
    cleanup_old_backups
    show_summary
    
    log "Deployment completed successfully!"
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"