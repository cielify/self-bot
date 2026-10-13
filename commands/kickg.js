'use strict';
const { request, friendlyError } = require('../utils/request');
const { card, termCard }         = require('../utils/format');
const state                      = require('../core/state');

module.exports = async function kickg(args, { token, edit, isTerminal, channel }) {
  const input = args[0];

  if (!input) {
    const f = [['usage', '.kickg <user id or @mention>  — run inside the group chat']];
    return edit(isTerminal ? termCard('KICK FROM GC', f) : card('KICK FROM GC', f));
  }

  const userId = input.replace(/[<@!>]/g, '').trim();

  if (!/^\d{15,20}$/.test(userId)) {
    const f = [['error', 'invalid user ID']];
    return edit(isTerminal ? termCard('KICK FROM GC', f) : card('KICK FROM GC', f));
  }

  if (!channel) {
    const f = [['error', 'run this command inside the group chat on Discord']];
    return edit(isTerminal ? termCard('KICK FROM GC', f) : card('KICK FROM GC', f));
  }

  if (userId === state.userId) {
    const f = [['error', 'cannot kick yourself']];
    return edit(isTerminal ? termCard('KICK FROM GC', f) : card('KICK FROM GC', f));
  }

  const res = await request(token, 'DELETE', `/channels/${channel}/recipients/${userId}`);
  const ok  = res === null || !res?.code;

  const f = ok
    ? [['status', 'kicked'], ['user', userId]]
    : [['status', 'failed'], ['user', userId], ['reason', friendlyError(res)]];

  return edit(isTerminal ? termCard('KICK FROM GC', f) : card('KICK FROM GC', f));
};
