#!/bin/bash

# K3I Monitor Bot Monitoring Script
# 
# @author opisboy29
# @description Monitoring script for K3I Monitor Bot health and performance

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
LOG_FILE="$PROJECT_DIR/monitoring.log"
PORT=$(grep "^PORT=" "$PROJECT_DIR/.env" 2>/dev/null | cut -d'=' -f2)
PORT=${PORT:-3001}
CHECK_INTERVAL=60  # seconds
ALERT_THRESHOLD=3  # consecutive failures before alerting

# Counters
FAILURE_COUNT=0
LAST_ALERT_TIME=0
ALERT_COOLDOWN=300  # 5 minutes in seconds

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
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1" >> "$LOG_FILE"
}

# Check if bot is running via PM2
check_pm2_status() {
    if pm2 list | grep -q "k3i-monitor-bot.*online"; then
        return 0
    else
        return 1
    fi
}

# Check API endpoint
check_api_endpoint() {
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" 2>/dev/null)
    
    if [ "$response_code" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Check Discord bot connection
check_discord_connection() {
    local response
    response=$(curl -s "http://localhost:$PORT/status" 2>/dev/null)
    
    if echo "$response" | grep -q '"success":true'; then
        if echo "$response" | grep -q '"isReady":true'; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

# Check database connectivity
check_database() {
    local response
    response=$(curl -s "http://localhost:$PORT/api/k3i/stats" 2>/dev/null)
    
    if echo "$response" | grep -q '"success":true'; then
        return 0
    else
        return 1
    fi
}

# Check system resources
check_system_resources() {
    local memory_usage cpu_usage disk_usage
    
    # Memory usage
    memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    
    # CPU usage (1-minute average)
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    
    # Disk usage for project directory
    disk_usage=$(df "$PROJECT_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    
    # Check thresholds
    if (( $(echo "$memory_usage > 80" | bc -l) )); then
        warn "High memory usage: ${memory_usage}%"
        return 1
    fi
    
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        warn "High CPU usage: ${cpu_usage}%"
        return 1
    fi
    
    if [ "$disk_usage" -gt 80 ]; then
        warn "High disk usage: ${disk_usage}%"
        return 1
    fi
    
    return 0
}

# Send alert (placeholder for actual alerting)
send_alert() {
    local message="$1"
    local current_time
    current_time=$(date +%s)
    
    # Check cooldown period
    if [ $((current_time - LAST_ALERT_TIME)) -lt $ALERT_COOLDOWN ]; then
        return 0
    fi
    
    LAST_ALERT_TIME=$current_time
    
    # Log alert
    error "ALERT: $message"
    
    # Here you could add actual alerting mechanisms:
    # - Send email
    # - Send Discord notification
    # - Send to monitoring service
    # - etc.
    
    echo "ALERT: $message" | tee -a "$PROJECT_DIR/alerts.log"
}

# Restart bot if needed
restart_bot() {
    warn "Attempting to restart K3I Monitor Bot..."
    
    # Try to restart via PM2
    if pm2 restart k3i-monitor-bot; then
        log "Bot restarted successfully"
        sleep 10  # Wait for bot to fully start
        return 0
    else
        error "Failed to restart bot via PM2"
        return 1
    fi
}

# Generate monitoring report
generate_report() {
    local report_file="$PROJECT_DIR/monitoring-report-$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "K3I Monitor Bot Monitoring Report"
        echo "Generated: $(date)"
        echo "=================================="
        echo ""
        
        echo "PM2 Status:"
        pm2 list
        echo ""
        
        echo "System Resources:"
        echo "Memory Usage: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
        echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')"
        echo "Disk Usage: $(df -h "$PROJECT_DIR" | tail -1 | awk '{print $5 " " $4}')"
        echo ""
        
        echo "API Status:"
        if check_api_endpoint; then
            echo "✅ API endpoint responding"
        else
            echo "❌ API endpoint not responding"
        fi
        
        if check_discord_connection; then
            echo "✅ Discord bot connected"
        else
            echo "❌ Discord bot not connected"
        fi
        
        if check_database; then
            echo "✅ Database accessible"
        else
            echo "❌ Database not accessible"
        fi
        
        echo ""
        echo "Recent Logs:"
        tail -20 "$LOG_FILE"
        
    } > "$report_file"
    
    log "Monitoring report generated: $report_file"
}

# Main monitoring function
monitor() {
    log "Starting K3I Monitor Bot monitoring..."
    log "Check interval: ${CHECK_INTERVAL} seconds"
    log "Alert threshold: ${ALERT_THRESHOLD} consecutive failures"
    
    while true; do
        local checks_passed=0
        local total_checks=4
        
        # Check PM2 status
        if check_pm2_status; then
            log "✅ PM2 status: OK"
            ((checks_passed++))
        else
            error "❌ PM2 status: FAILED"
            send_alert "PM2 status check failed"
        fi
        
        # Check API endpoint
        if check_api_endpoint; then
            log "✅ API endpoint: OK"
            ((checks_passed++))
        else
            error "❌ API endpoint: FAILED"
            ((FAILURE_COUNT++))
        fi
        
        # Check Discord connection
        if check_discord_connection; then
            log "✅ Discord connection: OK"
            ((checks_passed++))
        else
            error "❌ Discord connection: FAILED"
            ((FAILURE_COUNT++))
        fi
        
        # Check database
        if check_database; then
            log "✅ Database: OK"
            ((checks_passed++))
        else
            error "❌ Database: FAILED"
            ((FAILURE_COUNT++))
        fi
        
        # Check system resources
        if check_system_resources; then
            log "✅ System resources: OK"
        else
            warn "⚠️ System resources: WARNING"
        fi
        
        # Determine overall status
        if [ $checks_passed -eq $total_checks ]; then
            if [ $FAILURE_COUNT -gt 0 ]; then
                log "✅ All checks passed - recovering from previous failures"
                FAILURE_COUNT=0
            else
                info "✅ All systems operational"
            fi
        else
            warn "⚠️ $((total_checks - checks_passed)) check(s) failed"
            
            if [ $FAILURE_COUNT -ge $ALERT_THRESHOLD ]; then
                send_alert "Multiple consecutive failures detected ($FAILURE_COUNT failures)"
                
                # Attempt to restart bot
                if restart_bot; then
                    log "Restart attempt successful, resetting failure count"
                    FAILURE_COUNT=0
                else
                    error "Restart attempt failed"
                fi
            fi
        fi
        
        # Generate daily report at midnight
        if [ "$(date +%H:%M)" = "00:00" ]; then
            generate_report
        fi
        
        # Sleep until next check
        sleep $CHECK_INTERVAL
    done
}

# Handle script interruption
trap 'log "Monitoring stopped"; exit 0' INT TERM

# Show help
show_help() {
    echo "K3I Monitor Bot Monitoring Script"
    echo "=================================="
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -i, --interval SEC  Set check interval in seconds (default: 60)"
    echo "  -t, --threshold N   Set alert threshold (default: 3)"
    echo "  -r, --report        Generate monitoring report and exit"
    echo "  -s, --status        Show current status and exit"
    echo ""
    echo "Examples:"
    echo "  $0                  Start monitoring with default settings"
    echo "  $0 -i 30 -t 5       Check every 30 seconds, alert after 5 failures"
    echo "  $0 -r               Generate report and exit"
    echo "  $0 -s               Show status and exit"
}

# Show current status
show_status() {
    echo "K3I Monitor Bot Status"
    echo "======================"
    echo ""
    
    # PM2 Status
    echo "PM2 Status:"
    if check_pm2_status; then
        echo "✅ Bot is running"
    else
        echo "❌ Bot is not running"
    fi
    echo ""
    
    # API Status
    echo "API Status:"
    if check_api_endpoint; then
        echo "✅ API endpoint responding"
    else
        echo "❌ API endpoint not responding"
    fi
    echo ""
    
    # Discord Connection
    echo "Discord Connection:"
    if check_discord_connection; then
        echo "✅ Discord bot connected"
    else
        echo "❌ Discord bot not connected"
    fi
    echo ""
    
    # Database
    echo "Database:"
    if check_database; then
        echo "✅ Database accessible"
    else
        echo "❌ Database not accessible"
    fi
    echo ""
    
    # System Resources
    echo "System Resources:"
    check_system_resources
    echo ""
    
    # Recent logs
    echo "Recent Logs:"
    tail -10 "$LOG_FILE" 2>/dev/null || echo "No logs available"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -i|--interval)
            CHECK_INTERVAL="$2"
            shift 2
            ;;
        -t|--threshold)
            ALERT_THRESHOLD="$2"
            shift 2
            ;;
        -r|--report)
            generate_report
            exit 0
            ;;
        -s|--status)
            show_status
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate arguments
if ! [[ "$CHECK_INTERVAL" =~ ^[0-9]+$ ]] || [ "$CHECK_INTERVAL" -lt 10 ]; then
    error "Check interval must be a positive number (minimum 10 seconds)"
    exit 1
fi

if ! [[ "$ALERT_THRESHOLD" =~ ^[0-9]+$ ]] || [ "$ALERT_THRESHOLD" -lt 1 ]; then
    error "Alert threshold must be a positive number"
    exit 1
fi

# Initialize log file
echo "Monitoring started at $(date)" > "$LOG_FILE"

# Run monitoring
monitor