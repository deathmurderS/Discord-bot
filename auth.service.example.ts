// src/auth/auth.service.ts
// Contoh cara integrasi TrackingService ke AuthService yang sudah ada
// Tambahkan bagian yang ditandai === TAMBAHKAN === ke auth service kamu

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from '../tracking/tracking.service'; // === TAMBAHKAN ===
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly trackingService: TrackingService, // === TAMBAHKAN ===
  ) {}

  async login(
    email: string,
    password: string,
    userAgent: string,   // === TAMBAHKAN: ambil dari request header ===
    ipAddress: string,   // === TAMBAHKAN: ambil dari request IP ===
  ) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Email atau password salah');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new UnauthorizedException('Email atau password salah');

    // === TAMBAHKAN: catat login ===
    await this.trackingService.recordLogin(user.id, userAgent, ipAddress);

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { access_token: token };
  }

  async logout(userId: string) {
    // === TAMBAHKAN: catat logout ===
    await this.trackingService.recordLogout(userId);
    return { success: true };
  }
}

// -------------------------------------------------------
// src/auth/auth.controller.ts
// Cara ambil userAgent dan IP dari request:
// -------------------------------------------------------
//
// import { Controller, Post, Body, Req } from '@nestjs/common';
// import { Request } from 'express';
//
// @Post('login')
// async login(@Body() dto: LoginDto, @Req() req: Request) {
//   const userAgent = req.headers['user-agent'] || '';
//   const ipAddress = req.ip || req.connection.remoteAddress || '';
//   return this.authService.login(dto.email, dto.password, userAgent, ipAddress);
// }
//
// @Post('logout')
// @UseGuards(JwtAuthGuard)
// async logout(@Req() req: Request) {
//   return this.authService.logout(req.user['sub']); // sub = userId dari JWT payload
// }
