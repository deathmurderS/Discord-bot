// src/tracking/tracking.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { TrackingCron } from './tracking.cron';
import { PrismaModule } from '../prisma/prisma.module'; // sesuaikan path

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // untuk cron job
  ],
  providers: [TrackingService, TrackingCron],
  controllers: [TrackingController],
  exports: [TrackingService], // export agar bisa dipakai di AuthModule
})
export class TrackingModule {}
