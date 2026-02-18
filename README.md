# 📊 K3I Discord Bot — NestJS + PostgreSQL + Prisma

Sistem monitoring login user k3i yang menampilkan statistik real-time di Discord, update tiap 30 detik.

---

## 📁 Struktur File

```
k3i-v2/
├── nestjs/
│   ├── schema.prisma              → Tambahkan ke prisma/schema.prisma kamu
│   ├── tracking.service.ts        → Service utama tracking
│   ├── tracking.controller.ts     → Endpoint GET /api/stats
│   ├── tracking.module.ts         → Module NestJS
│   ├── tracking.cron.ts           → Cron job expire session tiap 5 menit
│   └── auth.service.example.ts    → Contoh integrasi ke AuthService
└── discord-bot/
    ├── discordBot.js              → Bot Discord
    ├── package.json
    └── .env.example
```

---

## 🚀 Setup NestJS

### 1. Jalankan migrasi Prisma

Tambahkan model `UserSession` dan `DailyStat` dari `schema.prisma` ke schema kamu, lalu:

```bash
npx prisma migrate dev --name add_session_tracking
npx prisma generate
```

### 2. Install dependency cron (jika belum)

```bash
npm install @nestjs/schedule
```

### 3. Copy file ke project NestJS

```
src/
└── tracking/
    ├── tracking.service.ts
    ├── tracking.controller.ts
    ├── tracking.module.ts
    └── tracking.cron.ts
```

### 4. Daftarkan TrackingModule di AppModule

```typescript
// src/app.module.ts
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    TrackingModule,
    // ... module lain
  ],
})
export class AppModule {}
```

### 5. Tambahkan STATS_SECRET ke .env NestJS

```env
STATS_SECRET=ganti_dengan_password_rahasia_kamu
```

### 6. Integrasi ke AuthService

Lihat `auth.service.example.ts` untuk cara menambahkan `recordLogin()` dan `recordLogout()` ke auth service yang sudah ada.

---

## 🤖 Setup Discord Bot

### 1. Buat Discord Bot
1. Buka https://discord.com/developers/applications
2. **New Application** → beri nama
3. Tab **Bot** → **Reset Token** → copy token
4. Aktifkan **Message Content Intent**
5. Tab **OAuth2 → URL Generator** → centang `bot` → permission: `Send Messages`, `Embed Links`, `Read Message History`
6. Buka URL yang muncul → invite bot ke server

### 2. Install dan jalankan

```bash
cd discord-bot
npm install
cp .env.example .env
nano .env        # isi semua variable
node discordBot.js
```

### 3. Jalankan 24 jam dengan PM2

```bash
npm install -g pm2
pm2 start discordBot.js --name k3i-bot
pm2 save
pm2 startup      # copy dan jalankan command yang muncul
```

### 4. Simpan Message ID (penting!)

Setelah bot pertama kali jalan, lihat log:
```
[Bot] Pesan pertama dikirim. Simpan di .env: STATUS_MESSAGE_ID=1234567890
```

Tambahkan ke `.env`:
```
STATUS_MESSAGE_ID=1234567890
```

Lalu restart: `pm2 restart k3i-bot`

---

## 📊 Tampilan di Discord

```
📊 K3I SERVER STATUS
Status: 🟢 ONLINE / AKTIF

👥 Sedang Online Sekarang
> Total: 15 user
> 📱 HP / Mobile: 12
> 💻 Desktop: 3

📅 Statistik Hari Ini
> Total Login: 47x
> Dari HP: 38x
> Dari Desktop: 9x
> User Unik: 31 orang

🕐 Update: 14:37:22 WIB  •  Selasa, 18 Februari 2026
```

---

## 🔧 PM2 Commands

| Command | Fungsi |
|---|---|
| `pm2 status` | Lihat status semua proses |
| `pm2 logs k3i-bot` | Lihat log real-time |
| `pm2 restart k3i-bot` | Restart bot |
| `pm2 stop k3i-bot` | Stop bot |

---

## 💡 Tips

- Kalau bot dan NestJS di VPS yang sama, gunakan `http://localhost:PORT/api/stats` di `K3I_STATS_URL` — lebih cepat dan tidak perlu expose ke internet
- Session dianggap tidak aktif jika `lastSeen` lebih dari 15 menit yang lalu
- Untuk heartbeat (opsional): panggil `trackingService.heartbeat(userId)` di JWT Guard kamu agar `lastSeen` terus terupdate selama user aktif
