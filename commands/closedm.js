'use strict';
const { request, friendlyError } = require('../utils/request');
const { card, termCard }         = require('../utils/format');
const state                      = require('../core/state');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = async function closedm(args, { token, edit, isTerminal }) {
  const autoignore = args.includes('-autoignore');
  const cleaned    = args.filter(a => a !== '-autoignore');
  const input      = cleaned[0];

  if (!input) {
    const f = [
      ['usage', '.closedm <id>'],
      ['flag',  '.closedm -autoignore <id>  — auto-close future DMs too'],
    ];
    return edit(isTerminal ? termCard('CLOSE DM', f) : card('CLOSE DM', f));
  }

  const userId = input.replace(/[<@!>]/g, '').trim();
  if (!/^\d{15,20}$/.test(userId)) {
    const f = [['error', 'invalid user ID']];
    return edit(isTerminal ? termCard('CLOSE DM', f) : card('CLOSE DM', f));
  }

  if (autoignore) state.ignoredUsers.add(userId);

  // use cached channel ID — avoids re-opening a closed DM
  let channelId = state.dmChannels[userId];

  // if not cached, try to open it (only way to get the ID)
  if (!channelId) {
    const dm = await request(token, 'POST', '/users/@me/channels', { recipient_id: userId });
    if (!dm || !dm.id || dm.code) {
      const f = [
        ['status',     'no DM found with this user'],
        ['user',       userId],
        ['autoignore', autoignore ? 'ON' : 'off'],
      ];
      return edit(isTerminal ? termCard('CLOSE DM', f) : card('CLOSE DM', f));
    }
    channelId = dm.id;
    state.dmChannels[userId] = channelId;
  }

  // delete own messages
  let deleted = 0;
  let before  = null;

  while (true) {
    const path = `/channels/${channelId}/messages?limit=100${before ? `&before=${before}` : ''}`;
    const msgs = await request(token, 'GET', path);
    if (!msgs || !Array.isArray(msgs) || msgs.length === 0) break;

    for (const msg of msgs) {
      if (msg.author?.id === state.userId) {
        const del = await request(token, 'DELETE', `/channels/${channelId}/messages/${msg.id}`);
        if (del === null || !del?.code) deleted++;
        await sleep(400);
      }
    }

    if (msgs.length < 100) break;
    before = msgs[msgs.length - 1].id;
    await sleep(600);
  }

  // close the DM — remove from sidebar
  const closed = await request(token, 'DELETE', `/channels/${channelId}`);
  const closedOk = closed === null || closed?.id || !closed?.code;

  // remove from cache
  delete state.dmChannels[userId];

  const f = [
    ['status',     closedOk ? 'DM closed' : `close failed — ${friendlyError(closed)}`],
    ['user',       userId],
    ['deleted',    `${deleted} message${deleted !== 1 ? 's' : ''}`],
    ['sidebar',    closedOk ? 'removed' : 'may still be visible'],
    ['autoignore', autoignore ? 'ON — future DMs will be auto-closed' : 'off'],
  ];

  return edit(isTerminal ? termCard('CLOSE DM', f) : card('CLOSE DM', f));
};
