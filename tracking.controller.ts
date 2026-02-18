// src/tracking/tracking.controller.ts
// Endpoint /api/stats yang akan diakses Discord Bot

import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('api')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get('stats')
  async getStats(@Headers('x-stats-key') statsKey: string) {
    const secret = process.env.STATS_SECRET;

    if (!statsKey || statsKey !== secret) {
      throw new UnauthorizedException('Invalid stats key');
    }

    await this.trackingService.expireInactiveSessions(15);
    const data = await this.trackingService.getStats();

    return { success: true, data };
  }
}
