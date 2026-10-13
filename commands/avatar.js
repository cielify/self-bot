'use strict';
const { request }        = require('../utils/request');
const { card, termCard } = require('../utils/format');

function parseId(input) {
  return input.replace(/<|>|@|!/g, '').trim();
}

function defaultAvatarIndex(user) {
  if (user.discriminator && user.discriminator !== '0') {
    return parseInt(user.discriminator) % 5;
  }
  return Number((BigInt(user.id) >> 22n) % 6n);
}

module.exports = async function avatar(args, { token, edit, isTerminal }) {
  const input = (args[0] || '').trim();

  if (!input) {
    const f = [['usage', '.avatar <user id or @mention>'], ['note', 'requires numeric ID, not username']];
    return edit(isTerminal ? termCard('AVATAR', f)
      : '**◈ AVATAR**\n```\n» usage          .avatar <id or @mention>\n» note           requires numeric ID not username\n```');
  }

  const userId = parseId(input);

  if (!/^\d{15,21}$/.test(userId)) {
    const f = [
      ['error', 'invalid user ID'],
      ['got',   userId || '(empty)'],
      ['tip',   'use numeric ID, not a username'],
    ];
    return edit(isTerminal ? termCard('AVATAR', f)
      : `**◈ AVATAR**\n\`\`\`\n» error          invalid user ID — use numeric ID\n» got            ${userId || '(empty)'}\n\`\`\``);
  }

  let user;
  try {
    user = await request(token, 'GET', `/users/${userId}`);
  } catch (e) {
    const f = [['error', `request failed: ${e.message}`]];
    return edit(isTerminal ? termCard('AVATAR', f) : `**◈ AVATAR**\n\`\`\`\n» error          ${e.message}\n\`\`\``);
  }

  if (!user || user.code || user.message) {
    const reason = user?.message || 'user not found';
    const f = [['error', reason], ['id', userId]];
    return edit(isTerminal ? termCard('AVATAR', f)
      : `**◈ AVATAR**\n\`\`\`\n» error          ${reason}\n» id             ${userId}\n\`\`\``);
  }

  const isAnimated = user.avatar?.startsWith('a_');
  const ext        = isAnimated ? 'gif' : 'png';
  const avatarUrl  = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=4096`
    : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex(user)}.png`;

  const tag = `${user.username}${user.discriminator && user.discriminator !== '0' ? '#' + user.discriminator : ''}`;

  if (isTerminal) {
    const f = [
      ['user',      tag],
      ['id',        user.id],
      ['animated',  isAnimated ? 'yes' : 'no'],
      ['avatar',    avatarUrl],
    ];
    return edit(termCard('AVATAR', f));
  }

  return edit(`**◈ AVATAR**\n\`\`\`\n» user           ${tag}\n» id             ${user.id}\n» animated       ${isAnimated ? 'yes' : 'no'}\n\`\`\`\n${avatarUrl}`);
};
