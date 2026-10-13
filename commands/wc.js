'use strict';
const { request }  = require('../utils/request');
const { C }        = require('../utils/banner');
const { card, termCard } = require('../utils/format');
const R = C.reset;

module.exports = async function wc(args, { token, channelId, del, edit, isTerminal }) {
  const targetChannel = isTerminal ? args[0] : (args[0] || channelId);

  if (!targetChannel) {
    const f = [['usage', '.wc [channel_id]'], ['note', 'in terminal a channel ID is required']];
    return edit(isTerminal ? termCard('WEBHOOK CREATE', f) : card('WEBHOOK CREATE', f));
  }

  if (!/^\d{15,22}$/.test(targetChannel)) {
    const f = [['error', 'invalid channel ID']];
    return edit(isTerminal ? termCard('WEBHOOK CREATE', f) : card('WEBHOOK CREATE', f));
  }

  const res = await request(token, 'POST', `/channels/${targetChannel}/webhooks`, { name: 'Mania' });

  if (!res || !res.id) {
    const f = [
      ['error', res?.message || 'failed to create webhook'],
      ['tip',   'requires Manage Webhooks permission'],
    ];
    return edit(isTerminal ? termCard('WEBHOOK CREATE', f) : card('WEBHOOK CREATE', f));
  }

  const url = `https://discord.com/api/webhooks/${res.id}/${res.token}`;

  if (!isTerminal) {
    await del();
  }

  process.stdout.write(`\n  ${C.bred}◈  WEBHOOK CREATED${R}\n`);
  process.stdout.write(`  ${C.red}»${R} ${C.silver}name       ${R}${C.white}${res.name}${R}\n`);
  process.stdout.write(`  ${C.red}»${R} ${C.silver}channel    ${R}${C.white}${targetChannel}${R}\n`);
  process.stdout.write(`  ${C.red}»${R} ${C.silver}url        ${R}${C.white}${url}${R}\n\n`);
};
