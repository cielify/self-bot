'use strict';
const fs                            = require('fs');
const path                          = require('path');
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const { readYN }                    = require('../utils/rawInput');
const state                         = require('../core/state');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function ln(s = '') { process.stdout.write(s + '\n'); }
function inf(s)     { ln(`  ${C.grey}\u25c6${R}  ${C.silver}${s}${R}`); }

function statusTag(enabled) {
  return enabled
    ? `${C.red}ON ${R}`
    : `${C.grey}OFF${R}`;
}

async function toggle(label, currentVal) {
  const tag = statusTag(currentVal);
  const res = await readYN(
    `  ${C.silver}${label.padEnd(22)}${R}  ${tag}  ${C.grey}[Y/N]: ${R}`
  );
  return res;
}

module.exports = async function setup(args, ctx) {
  if (!ctx.isTerminal) {
    if (ctx.edit) await ctx.edit('`⚙ .setup is terminal only — run it from Termux`');
    return;
  }

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('\u25c8  MONITORING SETUP');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}terminal / termux only${R}`);
  process.stdout.write(SEP + '\n\n');

  ln(`  ${C.grey}toggle each monitor — Y to enable, N to disable${R}`);
  ln();

  // ── collect answers first — apply to state only after all prompts done ───
  const answers = {
    autoAccept:       state.autoAccept,
    mutualDetect:     state.mutualDetect,
    antiGC:           state.antiGC,
    messageLogger:    state.messageLogger,
    joinLeaveMonitor: state.joinLeaveMonitor,
    presenceTracker:  state.presenceTracker,
  };

  answers.autoAccept       = await toggle('Auto-Accept Friends',   answers.autoAccept);
  answers.mutualDetect     = await toggle('Mutual Detection',      answers.mutualDetect);
  answers.antiGC           = await toggle('Anti Group Chat',       answers.antiGC);
  answers.messageLogger    = await toggle('Message Logger',        answers.messageLogger);
  answers.joinLeaveMonitor = await toggle('Join / Leave Monitor',  answers.joinLeaveMonitor);
  answers.presenceTracker  = await toggle('Presence Tracker',      answers.presenceTracker);

  // apply all at once — nothing fires until this point
  state.autoAccept       = answers.autoAccept;
  state.mutualDetect     = answers.mutualDetect;
  state.antiGC           = answers.antiGC;
  state.messageLogger    = answers.messageLogger;
  state.joinLeaveMonitor = answers.joinLeaveMonitor;
  state.presenceTracker  = answers.presenceTracker;

  // ── log file setup ────────────────────────────────────────────────────────
  ln();
  process.stdout.write(SEP + '\n\n');

  const anyEnabled = answers.autoAccept || answers.mutualDetect || answers.antiGC
                  || answers.messageLogger || answers.joinLeaveMonitor || answers.presenceTracker;

  if (anyEnabled) {
    const logDir  = path.join(process.env.HOME || '.', 'ozeu-logs');
    const logFile = path.join(logDir, 'monitor.log');

    try {
      fs.mkdirSync(logDir, { recursive: true });
      // write session header
      const header = `\n${'─'.repeat(60)}\n[${new Date().toLocaleString()}] session started\n${'─'.repeat(60)}\n`;
      fs.appendFileSync(logFile, header, 'utf8');
      state.logFilePath = logFile;
    } catch (e) {
      ln(`  ${C.bred}could not create log file: ${e.message}${R}`);
      state.logFilePath = null;
    }
  } else {
    state.logFilePath = null;
  }

  // ── summary ───────────────────────────────────────────────────────────────
  ln();
  process.stdout.write(SEP + '\n\n');

  const monitors = [
    ['Auto-Accept Friends',  answers.autoAccept],
    ['Mutual Detection',     answers.mutualDetect],
    ['Anti Group Chat',      answers.antiGC],
    ['Message Logger',       answers.messageLogger],
    ['Join / Leave Monitor', answers.joinLeaveMonitor],
    ['Presence Tracker',     answers.presenceTracker],
  ];

  for (const [label, val] of monitors) {
    const icon = val
      ? `  ${C.red}\u2714${R}`
      : `  ${C.grey}\u2013${R}`;
    ln(`${icon}  ${C.silver}${label.padEnd(24)}${R}  ${statusTag(val)}`);
  }

  ln();

  if (state.logFilePath) {
    inf(`logs saved to: ${state.logFilePath}`);
  } else if (!anyEnabled) {
    inf('all monitors off — nothing to log');
  } else {
    inf('log file unavailable — logs visible in terminal only');
  }

  process.stdout.write('\n' + SEP + '\n\n');

  resumeCLI();
};
