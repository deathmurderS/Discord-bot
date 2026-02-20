/**
 * NestJS Integration Example for K3I Monitor Bot
 * 
 * @author opisboy29
 * @description Example service for integrating K3I Monitor Bot with NestJS backend
 */

import { Injectable, HttpService, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';

interface UserCountData {
  userCount: number;
  source?: string;
  timestamp?: string;
}

interface MonitorResponse {
  success: boolean;
  message?: string;
  data?: {
    userCount: number;
    timestamp: string;
  };
  error?: string;
}

@Injectable()
export class K3IMonitorService {
  private readonly logger = new Logger(K3IMonitorService.name);
  private readonly monitorEndpoint: string;
  private readonly apiToken?: string;
  private readonly enabled: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.monitorEndpoint = this.configService.get<string>(
      'K3I_MONITOR_ENDPOINT',
      'http://localhost:3001/api/k3i/user-count'
    );
    
    this.apiToken = this.configService.get<string>('K3I_MONITOR_API_TOKEN');
    this.enabled = this.configService.get<boolean>('K3I_MONITOR_ENABLED', true);
  }

  /**
   * Report current user count to K3I Monitor Bot
   * @param userCount - Number of users currently logged in
   * @param source - Source of the data (optional)
   */
  async reportUserCount(userCount: number, source: string = 'nestjs-backend'): Promise<MonitorResponse> {
    if (!this.enabled) {
      this.logger.debug('K3I Monitor Bot integration is disabled');
      return { success: true, message: 'Integration disabled' };
    }

    if (!Number.isInteger(userCount) || userCount < 0) {
      const error = 'Invalid user count: must be non-negative integer';
      this.logger.error(error);
      return { success: false, error };
    }

    const data: UserCountData = {
      userCount,
      source,
      timestamp: new Date().toISOString()
    };

    try {
      this.logger.debug(`Reporting user count: ${userCount} (${source})`);
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const response: AxiosResponse<MonitorResponse> = await this.httpService
        .post(this.monitorEndpoint, data, { headers })
        .toPromise();

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
  async getCurrentUserCount(): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    try {
      const headers: Record<string, string> = {};

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const response: AxiosResponse<{ success: boolean; data: any }> = 
        await this.httpService
          .get(`${this.monitorEndpoint.replace('/user-count', '/current')}`, { headers })
          .toPromise();

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
   * @param hours - Number of hours to look back
   */
  async getHistoricalData(hours: number = 24): Promise<any[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const headers: Record<string, string> = {};

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const response: AxiosResponse<{ success: boolean; data: any[] }> = 
        await this.httpService
          .get(`${this.monitorEndpoint.replace('/user-count', '/history')}?hours=${hours}`, { headers })
          .toPromise();

      return response.data.success ? response.data.data : [];

    } catch (error) {
      this.logger.error('Failed to get historical data:', error);
      return [];
    }
  }

  /**
   * Get daily summary statistics
   * @param days - Number of days to look back
   */
  async getDailySummary(days: number = 7): Promise<any[]> {
    if (!this.enabled) {
      return [];
    }

    try {
      const headers: Record<string, string> = {};

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const response: AxiosResponse<{ success: boolean; data: any[] }> = 
        await this.httpService
          .get(`${this.monitorEndpoint.replace('/user-count', '/daily')}?days=${days}`, { headers })
          .toPromise();

      return response.data.success ? response.data.data : [];

    } catch (error) {
      this.logger.error('Failed to get daily summary:', error);
      return [];
    }
  }

  /**
   * Test connection to K3I Monitor Bot
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const headers: Record<string, string> = {};

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const response: AxiosResponse<{ success: boolean; message: string }> = 
        await this.httpService
          .get(`${this.monitorEndpoint.replace('/user-count', '/test')}`, { headers })
          .toPromise();

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
   * @param userCount - User count to set
   * @param source - Source of the update
   */
  async manualUpdate(userCount: number, source: string = 'manual'): Promise<MonitorResponse> {
    if (!this.enabled) {
      return { success: true, message: 'Integration disabled' };
    }

    try {
      const manualEndpoint = this.monitorEndpoint.replace('/user-count', '/manual-count');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiToken) {
        headers['X-API-Key'] = this.apiToken;
      }

      const response: AxiosResponse<MonitorResponse> = await this.httpService
        .post(manualEndpoint, { userCount, source }, { headers })
        .toPromise();

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
 * Example Usage in a Controller
 */
import { Controller, Post, Get, Body, Query } from '@nestjs/common';

@Controller('k3i-monitor')
export class K3IMonitorController {
  constructor(private readonly k3iMonitorService: K3IMonitorService) {}

  @Post('user-count')
  async reportUserCount(
    @Body('userCount') userCount: number,
    @Body('source') source?: string
  ) {
    return this.k3iMonitorService.reportUserCount(userCount, source);
  }

  @Get('current')
  async getCurrentUserCount() {
    const count = await this.k3iMonitorService.getCurrentUserCount();
    return { success: true, userCount: count };
  }

  @Get('history')
  async getHistoricalData(@Query('hours') hours?: number) {
    const data = await this.k3iMonitorService.getHistoricalData(hours);
    return { success: true, data };
  }

  @Get('daily')
  async getDailySummary(@Query('days') days?: number) {
    const summary = await this.k3iMonitorService.getDailySummary(days);
    return { success: true, data: summary };
  }

  @Post('test')
  async testConnection() {
    const connected = await this.k3iMonitorService.testConnection();
    return { success: connected };
  }

  @Post('manual')
  async manualUpdate(
    @Body('userCount') userCount: number,
    @Body('source') source?: string
  ) {
    return this.k3iMonitorService.manualUpdate(userCount, source);
  }
}

/**
 * Example Usage in a Service that tracks user logins
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly k3iMonitorService: K3IMonitorService,
    private readonly userService: UserService,
  ) {}

  async login(username: string, password: string) {
    // ... authentication logic ...
    
    // Report successful login
    const currentUsers = await this.userService.getLoggedInUserCount();
    await this.k3iMonitorService.reportUserCount(currentUsers, 'login-event');
    
    return { success: true, user: /* user data */ };
  }

  async logout(userId: string) {
    // ... logout logic ...
    
    // Report logout
    const currentUsers = await this.userService.getLoggedInUserCount();
    await this.k3iMonitorService.reportUserCount(currentUsers, 'logout-event');
    
    return { success: true };
  }
}

/**
 * Example Configuration Module
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [
        // Your config files
      ],
    }),
  ],
  providers: [
    {
      provide: 'K3I_MONITOR_CONFIG',
      useFactory: (configService: ConfigService) => ({
        endpoint: configService.get<string>('K3I_MONITOR_ENDPOINT'),
        apiToken: configService.get<string>('K3I_MONITOR_API_TOKEN'),
        enabled: configService.get<boolean>('K3I_MONITOR_ENABLED', true),
      }),
      inject: [ConfigService],
    },
  ],
})
export class AppModule {}