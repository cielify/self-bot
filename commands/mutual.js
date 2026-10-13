'use strict';
const state              = require('../core/state');
const { card, termCard } = require('../utils/format');

module.exports = async function mutual(args, { edit, isTerminal }) {
  state.mutualDetect = !state.mutualDetect;
  const f = [['status', state.mutualDetect ? 'enabled' : 'disabled']];
  return edit(isTerminal ? termCard('MUTUAL DETECTION', f) : card('MUTUAL DETECTION', f));
};
