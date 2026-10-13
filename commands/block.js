'use strict';
const { request }        = require('../utils/request');
const { card, termCard } = require('../utils/format');
const state              = require('../core/state');

module.exports = async function block(args, { token, edit, isTerminal }) {
  const input = args[0];
  if (!input) {
    const f = [['usage', '.block <user id or @mention>']];
    return edit(isTerminal ? termCard('BLOCK', f) : card('BLOCK', f));
  }

  const userId = input.replace(/[<@!>]/g, '').trim();
  if (!/^\d{15,20}$/.test(userId)) {
    const f = [['error', 'invalid user ID']];
    return edit(isTerminal ? termCard('BLOCK', f) : card('BLOCK', f));
  }

  if (userId === state.userId) {
    const f = [['error', 'you cannot block yourself']];
    return edit(isTerminal ? termCard('BLOCK', f) : card('BLOCK', f));
  }

  // type 2 = blocked
  const res = await request(token, 'PUT', `/users/@me/relationships/${userId}`, { type: 2 });

  const f = res === null
    ? [['status', 'blocked'], ['user', userId]]
    : [['status', 'failed'], ['user', userId], ['reason', res?.message || 'unknown']];

  return edit(isTerminal ? termCard('BLOCK', f) : card('BLOCK', f));
};
