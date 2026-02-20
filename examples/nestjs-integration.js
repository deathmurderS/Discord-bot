/**
 * NestJS Integration Example for K3I Monitor Bot
 * 
 * @author opisboy29
 * @description Example service for integrating K3I Monitor Bot with NestJS backend
 */

const axios = require('axios');

class K3IMonitorService {
  constructor(configService) {
    this.configService = configService;
    this.logger = console;
    
    this.monitorEndpoint = this.configService.get(
      'K3I_MONITOR_ENDPOINT',
      'http://localhost:3001/api/k3i/user-count'
    );
    
    this.apiToken = this.configService.get('K3I_MONITOR_API_TOKEN');
    this.enabled = this.configService.get('K3I_MONITOR_ENABLED', true);
  }

  /**
   * Report current user count to K3I Monitor Bot
   * @param {number} userCount - Number of users currently logged in
   * @param {string} source - Source of the data (optional)
   */
  async reportUserCount(userCount, source = 'nestjs-backend') {
    if (!this.enabled) {
      this.logger.debug('K3I Monitor Bot integration is disabled');
      return { success: true, message: 'Integration disabled' };
    }

    if (!Number.isInteger(userCount) || userCount < 0) {
      const error = 'Invalid user count: must be non-negative integer';
      this.logger.error(error);
      return { success: false, error };
    }

    const data = {
      userCount,
      source,
      timestamp: new Date().toISOString()
    };

    try {
      this.logger.debug(`Reporting user count: ${userCount} (${source})`);
      
      const headers = {
        'Content-Type': 'application/json',
      };

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const response = await axios.post(this.monitorEndpoint, data, { headers });

      if (response.data.success) {
        this.logger.log(`Successfully reported user count: ${userCount}`);
      } else {
        this.logger.warn(`Failed to report user count: ${response.data.error}`);
      }

      return response.data;

    } catch (error) {
      this.logger.error(`Failed to report user count to K3I Monitor Bot:`, error);
      
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  }

  /**
   * Get current user count from K3I Monitor Bot
   */
  async getCurrentUserCount() {
    if (!this.enabled) {
      return 0;
    }

    try {
      const headers = {};

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const currentEndpoint = this.monitorEndpoint.replace('/user-count', '/current');
      const response = await axios.get(currentEndpoint, { headers });

      if (response.data.success && response.data.data) {
        return response.data.data.userCount || 0;
      }

      return 0;

    } catch (error) {
      this.logger.error('Failed to get current user count:', error);
      return 0;
    }
  }

  /**
   * Get historical user count data
   * @param {number} hours - Number of hours to look back
   */
  async getHistoricalData(hours = 24) {
    if (!this.enabled) {
      return [];
    }

    try {
      const headers = {};

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const historyEndpoint = this.monitorEndpoint.replace('/user-count', '/history');
      const response = await axios.get(`${historyEndpoint}?hours=${hours}`, { headers });

      return response.data.success ? response.data.data : [];

    } catch (error) {
      this.logger.error('Failed to get historical data:', error);
      return [];
    }
  }

  /**
   * Get daily summary statistics
   * @param {number} days - Number of days to look back
   */
  async getDailySummary(days = 7) {
    if (!this.enabled) {
      return [];
    }

    try {
      const headers = {};

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const dailyEndpoint = this.monitorEndpoint.replace('/user-count', '/daily');
      const response = await axios.get(`${dailyEndpoint}?days=${days}`, { headers });

      return response.data.success ? response.data.data : [];

    } catch (error) {
      this.logger.error('Failed to get daily summary:', error);
      return [];
    }
  }

  /**
   * Test connection to K3I Monitor Bot
   */
  async testConnection() {
    if (!this.enabled) {
      return false;
    }

    try {
      const headers = {};

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const testEndpoint = this.monitorEndpoint.replace('/user-count', '/test');
      const response = await axios.get(testEndpoint, { headers });

      if (response.data.success) {
        this.logger.log('K3I Monitor Bot connection test successful');
        return true;
      } else {
        this.logger.warn('K3I Monitor Bot connection test failed:', response.data.message);
        return false;
      }

    } catch (error) {
      this.logger.error('K3I Monitor Bot connection test failed:', error);
      return false;
    }
  }

  /**
   * Manually update user count (for testing purposes)
   * @param {number} userCount - User count to set
   * @param {string} source - Source of the update
   */
  async manualUpdate(userCount, source = 'manual') {
    if (!this.enabled) {
      return { success: true, message: 'Integration disabled' };
    }

    try {
      const manualEndpoint = this.monitorEndpoint.replace('/user-count', '/manual-count');
      const headers = {
        'Content-Type': 'application/json',
      };

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const response = await axios.post(manualEndpoint, { userCount, source }, { headers });

      return response.data;

    } catch (error) {
      this.logger.error('Failed to send manual update:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      };
    }
  }
}

/**
 * Example Usage in a Service that tracks user logins
 */
class AuthService {
  constructor(k3iMonitorService, userService) {
    this.k3iMonitorService = k3iMonitorService;
    this.userService = userService;
  }

  async login(username, password) {
    // ... authentication logic ...
    
    // Report successful login
    const currentUsers = await this.userService.getLoggedInUserCount();
    await this.k3iMonitorService.reportUserCount(currentUsers, 'login-event');
    
    return { success: true, user: /* user data */ };
  }

  async logout(userId) {
    // ... logout logic ...
    
    // Report logout
    const currentUsers = await this.userService.getLoggedInUserCount();
    await this.k3iMonitorService.reportUserCount(currentUsers, 'logout-event');
    
    return { success: true };
  }
}

/**
 * Example Configuration Service
 */
class ConfigService {
  constructor(env = process.env) {
    this.env = env;
  }

  get(key, defaultValue = null) {
    return this.env[key] || defaultValue;
  }
}

/**
 * Example User Service (Mock)
 */
class UserService {
  async getLoggedInUserCount() {
    // This would typically query your database
    // For example: return await this.userRepository.count({ where: { isOnline: true } });
    return Math.floor(Math.random() * 100); // Mock data
  }
}

/**
 * Example Usage
 */
async function exampleUsage() {
  // Initialize services
  const configService = new ConfigService();
  const k3iMonitorService = new K3IMonitorService(configService);
  const userService = new UserService();
  const authService = new AuthService(k3iMonitorService, userService);

  // Test connection
  const connected = await k3iMonitorService.testConnection();
  console.log('Connection test:', connected);

  // Report current user count
  const currentCount = await userService.getLoggedInUserCount();
  const reportResult = await k3iMonitorService.reportUserCount(currentCount, 'example-usage');
  console.log('Report result:', reportResult);

  // Get current count
  const currentCountFromBot = await k3iMonitorService.getCurrentUserCount();
  console.log('Current count from bot:', currentCountFromBot);

  // Get historical data
  const historicalData = await k3iMonitorService.getHistoricalData(1); // Last 1 hour
  console.log('Historical data points:', historicalData.length);

  // Get daily summary
  const dailySummary = await k3iMonitorService.getDailySummary(1); // Last 1 day
  console.log('Daily summary:', dailySummary);

  // Manual update (for testing)
  const manualResult = await k3iMonitorService.manualUpdate(50, 'manual-test');
  console.log('Manual update result:', manualResult);
}

// Export for use in other modules
module.exports = {
  K3IMonitorService,
  AuthService,
  ConfigService,
  UserService,
  exampleUsage
};

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}