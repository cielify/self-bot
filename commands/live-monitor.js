'use strict';
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const state                         = require('../core/state');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

const CAT_COLOR = {
  mutuals:        C.red,
  friendRequests: C.bred,
  antiGC:         C.grey,
  monitor:        C.grey,
  exports:        C.silver,
};

function formatEntry(entry) {
  const col   = CAT_COLOR[entry.category] || C.grey;
  const label = `[${(entry.category || 'log').padEnd(8)}]`;
  const clean = entry.text
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/^\s+/, '')
    .replace(/\[.*?\]\s*/g, '');
  return `  ${C.grey}${entry.time}${R}  ${col}${label}${R}  ${C.silver}${clean}${R}`;
}

module.exports = async function liveMonitor(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('\u25c8  LIVE MONITOR');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}logs appear here and also at the \u00bb prompt${R}`);
  process.stdout.write(SEP + '\n\n');

  if (state.monitorLog.length === 0) {
    ln(`  ${C.grey}no logs yet — run .setup to enable monitors${R}`);
  } else {
    for (const entry of state.monitorLog) {
      process.stdout.write(formatEntry(entry) + '\n');
    }
  }

  ln();
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}new events will appear at the \u00bb prompt — returning now${R}`);
  process.stdout.write(SEP + '\n\n');

  // clear liveLog so resumeCLI doesn't re-print and duplicate
  state.liveLog.length = 0;

  resumeCLI();
};

function ln(s = '') { process.stdout.write((s || '') + '\n'); }
