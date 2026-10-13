'use strict';
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { request } = require('../utils/request');
const { log }     = require('../utils/logger');
const { C }       = require('../utils/banner');
const R = C.reset;

async function fetchAllMessages(token, channelId) {
  let messages = [];
  let before   = null;
  while (messages.length < 1000) {
    const url   = `/channels/${channelId}/messages?limit=100${before ? '&before=' + before : ''}`;
    const batch = await request(token, 'GET', url);
    if (!batch || !batch.length) break;
    messages = messages.concat(batch);
    before   = batch[batch.length - 1].id;
    await new Promise(r => setTimeout(r, 500));
  }
  return messages.slice(0, 1000);
}

module.exports = async function exportCmd(args, { token, channelId, del, isTerminal }) {
  const targetChannel = isTerminal ? args[0] : channelId;

  if (!targetChannel) {
    process.stdout.write(`\n  ${C.bred}◈  EXPORT${R}\n  ${C.red}»${R} ${C.silver}usage         ${R}${C.white}.export <channel_id>${R}\n\n`);
    return;
  }

  if (!isTerminal) await del();

  log('exports', `fetching channel ${targetChannel}...`);

  const messages = await fetchAllMessages(token, targetChannel);

  if (!messages.length) {
    log('exports', 'no messages found.');
    return;
  }

  const lines = messages.reverse().map(m => {
    const time = new Date(m.timestamp).toLocaleString();
    return `[${time}] ${m.author.username}: ${m.content || '[no text]'}`;
  });

  const dir  = path.join(os.homedir(), 'ozeu-mania', 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, `export-${targetChannel}-${Date.now()}.txt`);
  fs.writeFileSync(file, lines.join('\n'), 'utf8');

  log('exports', `saved ${messages.length} msgs → ${file}`);
};
