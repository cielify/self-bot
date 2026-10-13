'use strict';
const { request } = require('../utils/request');
const { C }       = require('../utils/banner');
const { card, termCard } = require('../utils/format');
const state       = require('../core/state');
const R = C.reset;

module.exports = async function purge(args, { token, channelId, messageId, del, edit, isTerminal }) {
  let targetChannel = channelId;
  let amount;

  if (isTerminal) {
    targetChannel = args[0];
    amount        = parseInt(args[1]);
    if (!targetChannel) {
      process.stdout.write(`\n  ${C.bred}◈  PURGE${R}\n  ${C.red}»${R} ${C.silver}usage          ${R}${C.white}.purge <channel_id> <1-50>${R}\n\n`);
      return;
    }
  } else {
    amount = parseInt(args[0]);
  }

  if (isNaN(amount) || amount < 1 || amount > 50) {
    const f = [['usage', isTerminal ? '.purge <channel_id> <1-50>' : '.purge <1-50>']];
    if (isTerminal) {
      process.stdout.write(`\n  ${C.bred}◈  PURGE${R}\n  ${C.red}»${R} ${C.silver}usage          ${R}${C.white}.purge <channel_id> <1-50>${R}\n\n`);
    } else {
      await edit(card('PURGE', f));
    }
    return;
  }

  if (!isTerminal) {
    await del();
    await new Promise(r => setTimeout(r, 300));
  }

  const fetched = await request(token, 'GET', `/channels/${targetChannel}/messages?limit=100`);
  if (!fetched || !fetched.length) {
    if (isTerminal) process.stdout.write(`\n  ${C.bred}◈  PURGE${R}\n  ${C.red}»${R} ${C.silver}result         ${R}${C.white}no messages found${R}\n\n`);
    return;
  }

  const targets = fetched
    .filter(m => m.author?.id === state.userId)
    .slice(0, amount);

  let deleted = 0;
  for (const msg of targets) {
    await request(token, 'DELETE', `/channels/${targetChannel}/messages/${msg.id}`);
    deleted++;
    if (deleted < targets.length) {
      await new Promise(r => setTimeout(r, 350));
    }
  }

  if (isTerminal) {
    process.stdout.write(`\n  ${C.bred}◈  PURGE${R}\n  ${C.red}»${R} ${C.silver}deleted        ${R}${C.white}${deleted} message${deleted !== 1 ? 's' : ''}${R}\n\n`);
  }
};
