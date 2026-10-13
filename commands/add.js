'use strict';
const { request }        = require('../utils/request');
const { card, termCard } = require('../utils/format');

module.exports = async function add(args, { token, edit, isTerminal }) {
  const input = args[0];
  if (!input) {
    const f = [['usage', '.add <user id or @mention>']];
    return edit(isTerminal ? termCard('ADD FRIEND', f) : card('ADD FRIEND', f));
  }

  const userId = input.replace(/[<@!>]/g, '').trim();
  if (!/^\d{15,20}$/.test(userId)) {
    const f = [['error', 'invalid user ID']];
    return edit(isTerminal ? termCard('ADD FRIEND', f) : card('ADD FRIEND', f));
  }

  // empty body = initiate relationship (send request if none, accept if incoming)
  // { type: 1 } incorrectly tells Discord to "set as friend" which requires an incoming request
  const res = await request(token, 'PUT', `/users/@me/relationships/${userId}`, {});

  const f = (res === null)
    ? [['status', 'friend request sent'], ['to', userId]]
    : [['status', 'failed'], ['id', userId], ['reason', res?.message || `HTTP ${res?.code || 'unknown'}`]];

  return edit(isTerminal ? termCard('ADD FRIEND', f) : card('ADD FRIEND', f));
};
