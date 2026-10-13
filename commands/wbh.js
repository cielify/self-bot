'use strict';
const { card, discordCard } = require('../utils/banner');

module.exports = async function wbh(args, { edit, isTerminal }) {
  const url = args[0];
  if (!url) {
    const f = [['usage', '.wbh <webhook url>']];
    return edit(isTerminal ? card('WEBHOOK INFO', f) : discordCard('WEBHOOK INFO', f));
  }

  const match = url.match(/discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([A-Za-z0-9_\-]+)/);
  if (!match) {
    const f = [['error', 'not a valid Discord webhook URL']];
    return edit(isTerminal ? card('WEBHOOK INFO', f) : discordCard('WEBHOOK INFO', f));
  }

  const [, id, token] = match;
  let data;
  try {
    const res = await fetch(`https://discord.com/api/v9/webhooks/${id}/${token}`);
    data = await res.json();
  } catch (e) {
    const f = [['error', `request failed: ${e.message}`]];
    return edit(isTerminal ? card('WEBHOOK INFO', f) : discordCard('WEBHOOK INFO', f));
  }

  if (!data || data.code) {
    const f = [
      ['error',  data?.message || 'webhook not found or invalid'],
      ['id',     id],
    ];
    return edit(isTerminal ? card('WEBHOOK INFO', f) : discordCard('WEBHOOK INFO', f));
  }

  const avatarUrl = data.avatar
    ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
    : 'none';

  const fields = [
    ['name',       data.name || 'N/A'],
    ['id',         data.id],
    ['type',       data.type === 1 ? 'Incoming' : String(data.type)],
    ['channel',    data.channel_id || 'N/A'],
    ['guild',      data.guild_id || 'N/A'],
    ['creator',    data.user ? `${data.user.username} (${data.user.id})` : 'N/A'],
    ['avatar',     avatarUrl],
    ['url',        `https://discord.com/api/webhooks/${data.id}/${token}`],
  ];

  return edit(isTerminal ? card('WEBHOOK INFO', fields) : discordCard('WEBHOOK INFO', fields));
};
