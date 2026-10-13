'use strict';
const { request }         = require('../utils/request');
const { snowflakeToDate } = require('../utils/snowflake');
const { card, termCard }  = require('../utils/format');

function isError(obj) { return !obj || typeof obj.code === 'number'; }

module.exports = async function serverinfo(args, { token, guildId, edit, isTerminal }) {
  const targetId = (args[0] || guildId || '').trim();

  if (!targetId) {
    const f = [['usage', '.si <server id>  or run inside a server']];
    return edit(isTerminal ? termCard('SERVER INFO', f) : card('SERVER INFO', f));
  }

  if (!/^\d{15,20}$/.test(targetId)) {
    const f = [['error', 'not a valid server ID']];
    return edit(isTerminal ? termCard('SERVER INFO', f) : card('SERVER INFO', f));
  }

  const guild = await request(token, 'GET', `/guilds/${targetId}?with_counts=true`);

  if (isError(guild)) {
    const f = [
      ['status', 'server not found'],
      ['id',     targetId],
      ['reason', guild?.message || 'no response'],
    ];
    return edit(isTerminal ? termCard('SERVER INFO', f) : card('SERVER INFO', f));
  }

  const iconUrl = guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
    : 'none';

  const fields = [
    ['name',        guild.name],
    ['id',          guild.id],
    ['owner',       guild.owner_id],
    ['created',     snowflakeToDate(guild.id)],
    ['members',     `${guild.approximate_member_count ?? '?'}  online: ${guild.approximate_presence_count ?? '?'}`],
    ['channels',    String(guild.channels?.length ?? '?')],
    ['roles',       String(guild.roles?.length ?? '?')],
    ['boosts',      `${guild.premium_subscription_count || 0}  level: ${guild.premium_tier}`],
    ['verify',      String(guild.verification_level)],
    ['description', guild.description || 'none'],
    ['icon',        iconUrl],
  ];

  return edit(isTerminal ? termCard('SERVER INFO', fields) : card('SERVER INFO', fields));
};
