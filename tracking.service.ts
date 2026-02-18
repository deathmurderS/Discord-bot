// src/tracking/tracking.service.ts
// Service untuk mencatat login, logout, dan statistik user

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // sesuaikan path prisma service kamu

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  // ========== HELPER ==========

  private detectDevice(userAgent: string = ''): 'mobile' | 'desktop' {
    const isMobile = /mobile|android|iphone|ipad|tablet|phone/i.test(userAgent);
    return isMobile ? 'mobile' : 'desktop';
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  }

  // ========== RECORD LOGIN ==========
  // Panggil ini setelah user berhasil login

  async recordLogin(userId: string, userAgent: string, ipAddress: string): Promise<void> {
    const deviceType = this.detectDevice(userAgent);
    const today = this.getTodayDate();

    // Nonaktifkan session lama user ini
    await this.prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Buat session baru
    await this.prisma.userSession.create({
      data: {
        userId,
        deviceType,
        ipAddress,
        userAgent,
        isActive: true,
        loginAt: new Date(),
        lastSeen: new Date(),
      },
    });

    // Update daily stats
    const existing = await this.prisma.dailyStat.findUnique({
      where: { date: today },
    });

    if (existing) {
      const alreadyCounted = existing.uniqueUserIds.includes(userId);
      await this.prisma.dailyStat.update({
        where: { date: today },
        data: {
          totalLogins: { increment: 1 },
          mobileLogins: deviceType === 'mobile' ? { increment: 1 } : undefined,
          desktopLogins: deviceType === 'desktop' ? { increment: 1 } : undefined,
          uniqueUserIds: alreadyCounted
            ? undefined
            : { push: userId },
        },
      });
    } else {
      await this.prisma.dailyStat.create({
        data: {
          date: today,
          totalLogins: 1,
          mobileLogins: deviceType === 'mobile' ? 1 : 0,
          desktopLogins: deviceType === 'desktop' ? 1 : 0,
          uniqueUserIds: [userId],
        },
      });
    }
  }

  // ========== RECORD LOGOUT ==========

  async recordLogout(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
  }

  // ========== HEARTBEAT ==========
  // Panggil ini di JWT Guard atau middleware agar lastSeen terupdate

  async heartbeat(userId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { userId, isActive: true },
      data: { lastSeen: new Date() },
    });
  }

  // ========== EXPIRE INACTIVE SESSIONS ==========
  // Dipanggil otomatis via cron job tiap 5 menit

  async expireInactiveSessions(inactiveMinutes = 15): Promise<number> {
    const cutoff = new Date(Date.now() - inactiveMinutes * 60 * 1000);
    const result = await this.prisma.userSession.updateMany({
      where: { isActive: true, lastSeen: { lt: cutoff } },
      data: { isActive: false },
    });
    return result.count;
  }

  // ========== GET STATS (untuk Discord Bot) ==========

  async getStats() {
    const today = this.getTodayDate();

    // Session aktif saat ini
    const activeSessions = await this.prisma.userSession.findMany({
      where: { isActive: true },
      select: { deviceType: true },
    });

    const currentOnline = activeSessions.length;
    const currentMobile = activeSessions.filter((s) => s.deviceType === 'mobile').length;
    const currentDesktop = activeSessions.filter((s) => s.deviceType === 'desktop').length;

    // Statistik hari ini
    const dailyStat = await this.prisma.dailyStat.findUnique({
      where: { date: today },
    });

    return {
      currentOnline,
      currentMobile,
      currentDesktop,
      todayLogins: dailyStat?.totalLogins ?? 0,
      todayMobile: dailyStat?.mobileLogins ?? 0,
      todayDesktop: dailyStat?.desktopLogins ?? 0,
      todayUniqueUsers: dailyStat?.uniqueUserIds?.length ?? 0,
      date: today,
      updatedAt: new Date().toISOString(),
    };
  }
}
