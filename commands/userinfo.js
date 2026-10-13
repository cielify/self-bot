'use strict';
const { request }         = require('../utils/request');
const { snowflakeToDate } = require('../utils/snowflake');
const { card, termCard }  = require('../utils/format');

const BADGE_FLAGS = [
  [1,         'Discord Staff'],
  [2,         'Partner'],
  [4,         'HypeSquad Events'],
  [8,         'Bug Hunter Lv1'],
  [64,        'HypeSquad Bravery'],
  [128,       'HypeSquad Brilliance'],
  [256,       'HypeSquad Balance'],
  [512,       'Early Supporter'],
  [16384,     'Bug Hunter Lv2'],
  [65536,     'Verified Bot Dev'],
  [131072,    'Verified Bot Dev'],
  [4194304,   'Active Developer'],
  [8388608,   'Moderator Alumni'],
];

function parseBadges(flags = 0) {
  return BADGE_FLAGS.filter(([bit]) => flags & bit).map(([, name]) => name);
}

function accountAge(snowflake) {
  const created = new Date(Number((BigInt(snowflake) >> 22n) + 1420070400000n));
  const now     = new Date();
  const diffMs  = now - created;
  const days    = Math.floor(diffMs / 86400000);
  const years   = Math.floor(days / 365);
  const months  = Math.floor((days % 365) / 30);
  if (years > 0) return `${years}y ${months}m (${created.toLocaleDateString()})`;
  if (months > 0) return `${months}mo (${created.toLocaleDateString()})`;
  return `${days}d (${created.toLocaleDateString()})`;
}

function nitroHint(user) {
  if (user.avatar?.startsWith('a_'))    return 'likely (animated avatar)';
  if (user.banner)                      return 'likely (has banner)';
  if (user.avatar_decoration_data)      return 'likely (avatar decoration)';
  return 'unknown';
}

function isError(obj) { return !obj || typeof obj.code === 'number'; }

module.exports = async function userinfo(args, { token, edit, isTerminal }) {
  const input = args[0];
  if (!input) {
    const u = [['usage', '.u <user id or @mention>']];
    return edit(isTerminal ? termCard('USER OSINT', u) : card('USER OSINT', u));
  }

  const targetId = input.replace(/[<@!>]/g, '').trim();
  if (!/^\d{15,20}$/.test(targetId)) {
    const f = [['error', 'invalid ID'], ['got', targetId || '(empty)']];
    return edit(isTerminal ? termCard('USER OSINT', f) : card('USER OSINT', f));
  }

  // fetch user + profile in parallel
  const [user, profile] = await Promise.all([
    request(token, 'GET', `/users/${targetId}`),
    request(token, 'GET', `/users/${targetId}/profile?with_mutual_guilds=true&with_mutual_friends_count=true`),
  ]);

  const u = (!isError(user) ? user : profile?.user) || null;
  if (!u) {
    const f = [['status', 'user not found'], ['id', targetId]];
    return edit(isTerminal ? termCard('USER OSINT', f) : card('USER OSINT', f));
  }

  const p = !isError(profile) ? profile : null;

  const badges    = parseBadges(u.public_flags);
  const avatarUrl = u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}`
    : 'none';
  const bannerUrl = u.banner
    ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}.${u.banner.startsWith('a_') ? 'gif' : 'png'}`
    : 'none';

  const connectedAccounts = (p?.connected_accounts || [])
    .map(a => `${a.type}:${a.name}`).join(', ') || 'none';

  const mutualGuilds  = p?.mutual_guilds?.length ?? 0;
  const mutualFriends = p?.mutual_friends_count  ?? 0;

  const bio      = p?.user_profile?.bio      || 'none';
  const pronouns = p?.user_profile?.pronouns || 'none';
  const theme    = p?.user_profile?.theme_colors
    ? p.user_profile.theme_colors.map(c => '#' + c.toString(16).padStart(6,'0')).join(' → ')
    : 'none';

  const fields = [
    ['username',    `${u.username}${u.discriminator && u.discriminator !== '0' ? '#' + u.discriminator : ''}`],
    ['display',     u.global_name || 'none'],
    ['id',          u.id],
    ['created',     accountAge(u.id)],
    ['bot',         u.bot ? 'yes' : 'no'],
    ['system',      u.system ? 'yes' : 'no'],
    ['nitro hint',  nitroHint(u)],
    ['badges',      badges.length ? badges.join(', ') : 'none'],
    ['pronouns',    pronouns],
    ['bio',         bio.length > 80 ? bio.slice(0, 80) + '…' : bio],
    ['theme',       theme],
    ['avatar',      avatarUrl],
    ['banner',      bannerUrl],
    ['connections', connectedAccounts.length > 80 ? connectedAccounts.slice(0, 80) + '…' : connectedAccounts],
    ['mutual svrs', String(mutualGuilds)],
    ['mutual frns', String(mutualFriends)],
  ];

  return edit(isTerminal ? termCard('USER OSINT', fields) : card('USER OSINT', fields));
};
