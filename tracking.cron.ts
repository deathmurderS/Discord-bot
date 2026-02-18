// src/tracking/tracking.cron.ts
// Cron job otomatis expire session tidak aktif tiap 5 menit

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TrackingService } from './tracking.service';

@Injectable()
export class TrackingCron {
  private readonly logger = new Logger(TrackingCron.name);

  constructor(private readonly trackingService: TrackingService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpireSessions() {
    const count = await this.trackingService.expireInactiveSessions(15);
    if (count > 0) {
      this.logger.log(`Expired ${count} inactive session(s)`);
    }
  }
}
