// discord-bot/discordBot.js
// Discord Bot untuk monitoring login user k3i
// Update otomatis tiap 30 detik

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const axios = require('axios');

// ========== CONFIG ==========
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const K3I_STATS_URL = process.env.K3I_STATS_URL; // contoh: http://localhost:3001/api/stats
const STATS_SECRET = process.env.STATS_SECRET;
const UPDATE_INTERVAL = 30 * 1000; // 30 detik

// ========== CLIENT ==========
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

let statusMessageId = process.env.STATUS_MESSAGE_ID || null;

// ========== FETCH STATS ==========
async function fetchStats() {
  try {
    const res = await axios.get(K3I_STATS_URL, {
      headers: { 'x-stats-key': STATS_SECRET },
      timeout: 10000,
    });
    return res.data.data;
  } catch (err) {
    console.error('[Bot] Gagal fetch stats:', err.message);
    return null;
  }
}

// ========== BUILD EMBED ==========
function buildEmbed(stats) {
  const isOnline = stats.currentOnline > 0;
  const statusColor = isOnline ? 0x2ecc71 : 0x95a5a6;
  const statusIcon = isOnline ? '🟢' : '⚫';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Jakarta',
  });
  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Jakarta',
  });

  return new EmbedBuilder()
    .setTitle('📊 K3I SERVER STATUS')
    .setColor(statusColor)
    .setDescription(`**Status:** ${statusIcon} ${isOnline ? 'ONLINE / AKTIF' : 'TIDAK ADA USER'}`)
    .addFields(
      {
        name: '👥 Sedang Online Sekarang',
        value: [
          `> Total: **${stats.currentOnline} user**`,
          `> 📱 HP / Mobile: **${stats.currentMobile}**`,
          `> 💻 Desktop: **${stats.currentDesktop}**`,
        ].join('\n'),
        inline: false,
      },
      {
        name: '📅 Statistik Hari Ini',
        value: [
          `> Total Login: **${stats.todayLogins}x**`,
          `> Dari HP: **${stats.todayMobile}x**`,
          `> Dari Desktop: **${stats.todayDesktop}x**`,
          `> User Unik: **${stats.todayUniqueUsers} orang**`,
        ].join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: `🕐 Update: ${timeStr} WIB  •  ${dateStr}` })
    .setTimestamp();
}

function buildErrorEmbed() {
  return new EmbedBuilder()
    .setTitle('📊 K3I SERVER STATUS')
    .setColor(0xe74c3c)
    .setDescription('⚠️ **Tidak dapat terhubung ke server k3i**')
    .setFooter({ text: `Retry... | ${new Date().toLocaleTimeString('id-ID')}` })
    .setTimestamp();
}

// ========== UPDATE DISCORD ==========
async function updateDiscord() {
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) {
    console.error('[Bot] Channel tidak ditemukan!');
    return;
  }

  const stats = await fetchStats();
  const embed = stats ? buildEmbed(stats) : buildErrorEmbed();

  try {
    if (statusMessageId) {
      const msg = await channel.messages.fetch(statusMessageId);
      await msg.edit({ embeds: [embed] });
    } else {
      const msg = await channel.send({ embeds: [embed] });
      statusMessageId = msg.id;
      console.log(`[Bot] Pesan pertama dikirim. Simpan di .env: STATUS_MESSAGE_ID=${msg.id}`);
    }

    if (stats) {
      console.log(`[Bot] Updated — Online: ${stats.currentOnline} | Login hari ini: ${stats.todayLogins}`);
      client.user.setActivity(`${stats.currentOnline} user online`, { type: ActivityType.Watching });
    }
  } catch (err) {
    console.error('[Bot] Gagal update:', err.message);
    if (err.code === 10008) statusMessageId = null; // pesan dihapus, buat baru
  }
}

// ========== READY ==========
client.once('ready', async () => {
  console.log(`[Bot] Login sebagai ${client.user.tag}`);
  console.log(`[Bot] Channel: ${CHANNEL_ID}`);
  console.log(`[Bot] Interval: ${UPDATE_INTERVAL / 1000} detik`);

  await updateDiscord();
  setInterval(updateDiscord, UPDATE_INTERVAL);
});

client.on('error', (err) => console.error('[Bot] Error:', err.message));
client.login(DISCORD_TOKEN);
