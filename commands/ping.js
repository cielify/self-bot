'use strict';
const state              = require('../core/state');
const { card, termCard } = require('../utils/format');

module.exports = async function ping(args, { timestamp, edit, isTerminal }) {
  const ms = isTerminal
    ? (state.gatewayPing !== null ? `${state.gatewayPing}ms (gateway heartbeat)` : 'not yet measured')
    : `${Date.now() - new Date(timestamp).getTime()}ms`;

  const f = [['latency', ms]];
  return edit(isTerminal ? termCard('PING', f) : card('PING', f));
};
