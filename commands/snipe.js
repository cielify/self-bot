'use strict';
const state = require('../core/state');
const { C } = require('../utils/banner');
const R     = C.reset;

module.exports = async function snipe(args, { channelId, edit, isTerminal }) {
  let targetChannel = channelId;
  let pageArg;

  if (isTerminal) {
    targetChannel = args[0];
    pageArg       = args[1];
    if (!targetChannel) {
      process.stdout.write(`\n  ${C.bred}◈  SNIPE${R}\n  ${C.red}»${R} ${C.silver}usage         ${R}${C.white}.s <channel_id> [page]${R}\n\n`);
      return;
    }
  } else {
    pageArg = args[0];
  }

  const sniped = state.snipeCache[targetChannel];

  if (!sniped || sniped.length === 0) {
    const msg = isTerminal
      ? `\n  ${C.bred}◈  SNIPE${R}\n  ${C.red}»${R} ${C.silver}status        ${R}${C.white}nothing sniped in this channel yet${R}\n`
      : '**◈ SNIPE**\n**»** **status** — nothing sniped yet';
    return edit(msg);
  }

  const perPage     = 5;
  const page        = Math.min(Math.max(parseInt(pageArg) || 1, 1), Math.ceil(sniped.length / perPage));
  const totalPages  = Math.ceil(sniped.length / perPage);
  const start       = (page - 1) * perPage;
  const slice       = sniped.slice(start, start + perPage);

  if (isTerminal) {
    process.stdout.write(`\n  ${C.bred}◈  SNIPE  ${C.grey}page ${page}/${totalPages} — total ${sniped.length}${R}\n`);
    slice.forEach((m, i) => {
      process.stdout.write(`  ${C.red}»${R} ${C.grey}[${start + i + 1}]${R} ${C.silver}${m.author}${R}  ${C.white}${m.content || '[no text]'}${R}\n`);
    });
    process.stdout.write('\n');
  } else {
    const header  = `**◈ SNIPE**`;
    const entries = slice.map((m, i) => `[${start + i + 1}] ${m.author.padEnd(20)} ${m.content || '[no text]'}`).join('\n');
    await edit(`${header}\n\`\`\`\npage ${page}/${totalPages} — total ${sniped.length}\n\n${entries}\n\`\`\``);
  }
};
