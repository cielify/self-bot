'use strict';
const state          = require('../core/state');
const { saveConfig } = require('../core/config');
const { C }          = require('../utils/banner');
const { card, termCard } = require('../utils/format');
const R = C.reset;

module.exports = async function antigc(args, { edit, isTerminal }) {
  const input = (args[0] || '').toLowerCase();

  if (input !== 'on' && input !== 'off') {
    const f = [
      ['usage',  '.antigc <on/off>'],
      ['status', state.antiGC ? 'currently ON' : 'currently OFF'],
      ['info',   'auto-leaves any group DM you are added to'],
    ];
    return edit(isTerminal ? termCard('ANTI-GC', f)
      : `**◈ ANTI-GC**\n\`\`\`\n» usage          .antigc <on/off>\n» status         ${state.antiGC ? 'ON' : 'OFF'}\n\`\`\``);
  }

  state.antiGC = input === 'on';
  saveConfig();

  const status = state.antiGC ? 'ON' : 'OFF';

  if (isTerminal) {
    process.stdout.write(`\n  ${C.bred}◈  ANTI-GC${R}\n`);
    process.stdout.write(`  ${C.red}»${R} ${C.silver}status        ${R}${C.white}${status}${R}\n`);
    process.stdout.write(`  ${C.grey}  will auto-leave any group DM${R}\n\n`);
    return;
  }

  return edit(`**◈ ANTI-GC**\n\`\`\`\n» status         ${status}\n» info           auto-leaves any group DM you are added to\n\`\`\``);
};
