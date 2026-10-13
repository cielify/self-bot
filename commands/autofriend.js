'use strict';
const state              = require('../core/state');
const { card, termCard } = require('../utils/format');

module.exports = async function autofriend(args, { edit, isTerminal }) {
  state.autoAccept = !state.autoAccept;
  const f = [['status', state.autoAccept ? 'enabled' : 'disabled']];
  return edit(isTerminal ? termCard('AUTO FRIEND ACCEPT', f) : card('AUTO FRIEND ACCEPT', f));
};
