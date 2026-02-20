# 🤖 K3I Monitor Bot

**Real-time Discord bot for monitoring K3I website user login count**

Discord bot that monitors the number of users currently logged into the K3I website and updates the bot's status in real-time every 30 seconds. Built with Node.js, Discord.js, and Express.

## 🎯 Features

### 📊 **Real-time Monitoring**
- **30-second updates**: Bot status updates every 30 seconds as requested
- **Live user count**: Displays current number of logged-in users
- **Timestamp tracking**: Shows when data was last updated
- **Historical data**: SQLite database stores all user count history

### 🤖 **Discord Integration**
- **Status updates**: Bot shows user count in its Discord status
- **Server monitoring**: Tracks specific Discord server
- **Activity tracking**: Uses Discord "Watching" activity type
- **Auto-reconnection**: Handles Discord connection issues gracefully

### 🌐 **API Server**
- **RESTful API**: Receive user count data from backend
- **Multiple endpoints**: Health checks, statistics, historical data
- **CORS support**: Cross-origin resource sharing enabled
- **API authentication**: Optional API token protection

### 📈 **Data Management**
- **SQLite database**: Local data storage with automatic cleanup
- **Daily summaries**: Automatic daily statistics calculation
- **Historical tracking**: Keep track of user count trends
- **Data retention**: Configurable data retention policies

## 🚀 Quick Start

### Prerequisites
- **Node.js** 16+ ([Download](https://nodejs.org/))
- **Discord Bot Token** ([Get from Discord Developer Portal](https://discord.com/developers/applications))
- **Discord Server** with admin permissions

### 1️⃣ Installation

```bash
# Clone or download the project
git clone <repository-url> k3i-monitor-bot
cd k3i-monitor-bot

# Install dependencies
npm install

# Setup environment configuration
npm run setup
```

### 2️⃣ Configuration

Edit the `.env` file with your configuration:

```bash
# Required Configuration
DISCORD_BOT_TOKEN=your_discord_bot_token_here
DISCORD_SERVER_ID=your_server_id_here

# Optional Configuration
PORT=3001
STATUS_UPDATE_INTERVAL=30
NODE_ENV=production
```

### 3️⃣ Run the Bot

```bash
# Start in development mode
npm run dev

# Start in production mode
npm start
```

## 📋 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_BOT_TOKEN` | ✅ | - | Discord bot token from Developer Portal |
| `DISCORD_SERVER_ID` | ✅ | - | Discord server ID where bot will be active |
| `PORT` | ❌ | `3001` | HTTP server port for API endpoints |
| `STATUS_UPDATE_INTERVAL` | ❌ | `30` | Status update interval in seconds |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `DATABASE_PATH` | ❌ | `data/k3i_monitor.db` | SQLite database file path |
| `LOG_LEVEL` | ❌ | `info` | Log level (error, warn, info, debug) |

### Discord Bot Setup

1. **Create Discord Bot**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create New Application → Bot → Reset Token
   - Copy the bot token

2. **Configure Bot Permissions**:
   - Enable "Message Content Intent" in Bot settings
   - Invite bot to server with proper permissions

3. **Get Server ID**:
   - Enable Developer Mode in Discord
   - Right-click server name → Copy ID

## 🌐 API Endpoints

### Health Check
```http
GET /health
```
Returns server health status and uptime.

### Status Information
```http
GET /status
```
Returns current bot status, statistics, and connection information.

### User Count (POST)
```http
POST /api/k3i/user-count
Content-Type: application/json

{
  "userCount": 42,
  "source": "api",
  "timestamp": "2025-08-05T10:30:00Z"
}
```
Receives user count data from backend and updates Discord status.

### Current User Count
```http
GET /api/k3i/current
```
Returns the latest user count data.

### Historical Data
```http
GET /api/k3i/history?hours=24
```
Returns historical user count data for the specified number of hours.

### Daily Summary
```http
GET /api/k3i/daily?days=7
```
Returns daily summary statistics for the specified number of days.

### Manual Update (Testing)
```http
POST /api/k3i/manual-count
Content-Type: application/json

{
  "userCount": 100,
  "source": "manual"
}
```
Manually update user count for testing purposes.

## 🎮 Usage Examples

### Send User Count from Backend
```bash
curl -X POST http://localhost:3001/api/k3i/user-count \
  -H "Content-Type: application/json" \
  -d '{"userCount": 42}'
```

### Get Current Status
```bash
curl http://localhost:3001/api/k3i/current
```

### Get Historical Data
```bash
curl "http://localhost:3001/api/k3i/history?hours=12"
```

### Test API Connectivity
```bash
curl http://localhost:3001/api/k3i/test
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   K3I Backend   │───▶│   API Server     │───▶│ Discord Bot     │
│   (NestJS)      │    │   (Express)      │    │   (Discord.js)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   SQLite DB      │
                       │   (Historical    │
                       │    Data)         │
                       └──────────────────┘
```

### Components

1. **API Server**: Express server that receives user count data
2. **Discord Bot**: Discord.js client that updates bot status
3. **Database**: SQLite database for storing historical data
4. **Logger**: Structured logging with file rotation

## 🧪 Testing

### Manual Testing
```bash
# Test API connectivity
curl http://localhost:3001/api/k3i/test

# Send test user count
curl -X POST http://localhost:3001/api/k3i/manual-count \
  -H "Content-Type: application/json" \
  -d '{"userCount": 50}'

# Check current status
curl http://localhost:3001/status
```

### Integration Testing
The bot includes comprehensive testing endpoints for validating the entire system.

## 🚀 Production Deployment

### PM2 Deployment
```bash
# Install PM2 globally
npm install -g pm2

# Create ecosystem config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'k3i-monitor-bot',
    script: 'src/index.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

## 📊 Monitoring

### Health Checks
- **API Health**: `/health` endpoint for monitoring
- **Status Endpoint**: `/status` for detailed system status
- **Database Stats**: `/api/k3i/stats` for database information

### Logging
- **Structured logging**: JSON-formatted logs
- **File rotation**: Automatic log file rotation
- **Multiple levels**: Error, warn, info, debug logging
- **Discord operations**: Track bot status updates

## 🔧 Development

### Development Mode
```bash
# Start with auto-restart
npm run dev

# Start with debug logging
npm run dev:debug
```

### Adding New Features
1. **API Endpoints**: Add to `src/api-server.js`
2. **Database Models**: Extend `src/database.js`
3. **Discord Features**: Modify `src/discord-bot.js`
4. **Logging**: Use `src/utils/logger.js`

## 🤝 Integration with NestJS Backend

### Example NestJS Service
```typescript
// k3i-monitor.service.ts
import { Injectable, HttpService } from '@nestjs/common';

@Injectable()
export class K3IMonitorService {
  private readonly monitorEndpoint = process.env.K3I_MONITOR_ENDPOINT || 'http://localhost:3001/api/k3i/user-count';

  constructor(private readonly httpService: HttpService) {}

  async reportUserCount(userCount: number): Promise<void> {
    try {
      await this.httpService.post(this.monitorEndpoint, {
        userCount,
        source: 'nestjs-backend',
        timestamp: new Date().toISOString()
      }).toPromise();
    } catch (error) {
      console.error('Failed to report user count to K3I Monitor Bot:', error);
    }
  }
}
```

### Integration Points
- **Login events**: Call when users log in
- **Logout events**: Call when users log out
- **Periodic updates**: Send current count every 30 seconds
- **Error handling**: Handle API failures gracefully

## 🐛 Troubleshooting

### Common Issues

#### Bot Not Updating Status
```bash
# Check bot connection
curl http://localhost:3001/status

# Verify Discord permissions
# Ensure bot has proper server access
```

#### API Not Responding
```bash
# Check server status
curl http://localhost:3001/health

# Check logs
tail -f logs/k3i-monitor.log
```

#### Database Issues
```bash
# Check database file
ls -la data/k3i_monitor.db

# Verify database permissions
chmod 644 data/k3i_monitor.db
```

### Debug Mode
```bash
# Enable debug logging
DEBUG_MODE=true LOG_LEVEL=debug npm start

# Check detailed logs
tail -f logs/k3i-monitor.log
```

## 📈 Performance

### Optimization Features
- **Database indexing**: Optimized queries with indexes
- **Memory management**: Automatic cleanup of old data
- **Connection pooling**: Efficient database connections
- **Error handling**: Graceful error recovery

### Monitoring Performance
- **Response times**: API response time tracking
- **Database queries**: Query performance monitoring
- **Memory usage**: Memory usage tracking
- **Discord API**: Discord API call monitoring

## 📚 API Documentation

### Request Format
```json
{
  "userCount": 42,
  "source": "api|manual|test",
  "timestamp": "2025-08-05T10:30:00Z"
}
```

### Response Format
```json
{
  "success": true,
  "message": "User count updated successfully",
  "data": {
    "userCount": 42,
    "timestamp": "2025-08-05T10:30:00Z"
  }
}
```

## 🎯 Roadmap

- [ ] **Web Dashboard**: Real-time web interface for monitoring
- [ ] **Alerts System**: Notifications for unusual activity
- [ ] **Multiple Servers**: Support for monitoring multiple Discord servers
- [ ] **Advanced Analytics**: Detailed usage analytics and reporting
- [ ] **Plugin System**: Extensible plugin architecture

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Submit a pull request

## 📄 License

MIT License - feel free to use this bot for your own projects!

```
Copyright (c) 2025 opisboy29

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Acknowledgments

- **Discord.js**: Excellent Discord API library
- **Express**: Reliable web framework
- **SQLite3**: Lightweight database solution
- **Node.js**: Powerful runtime environment

---

**🤖 Built for real-time monitoring with ❤️ by opisboy29**

**[⬆ Back to Top](#-k3i-monitor-bot)**