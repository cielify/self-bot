'use strict';
const readline       = require('readline');
const handleCommand  = require('../commands');
const { C, err }     = require('../utils/banner');
const { setAtPrompt, PROMPT } = require('../utils/output');
const cliControl     = require('../utils/cliControl');

const NUM_MAP = {
  '1':'purge',       '01':'purge',
  '2':'export',      '02':'export',
  '3':'s',           '03':'s',
  '4':'wc',          '04':'wc',
  '5':'gc,conf',     '05':'gc,conf',
  '6':'wbh',         '06':'wbh',
  '7':'w-all',       '07':'w-all',
  '8':'rn-wh-all',   '08':'rn-wh-all',
  '9':'antigc',      '09':'antigc',
  '10':'rn-channel', '11':'d',
  '12':'u',          '13':'si',
  '14':'avatar',     '15':'add',
  '16':'pn',         '17':'users-id',
  '18':'rn-user',    '19':'dt-info',
  '20':'dt-joiner',  '21':'help',
  '22':'ip',         '23':'ip-p',
  '24':'ip-ping',    '25':'ip-gen',
  '26':'email',      '27':'ut',
  '28':'ping',       '29':'p-encrypt',
  '30':'p-decrypt',  '31':'a',
  '32':'dmall',
  '33':'setup',
  '34':'live-monitor',
  '36':'block',
  '37':'closedm',
  '38':'kickg',
  '39':'invis',
  '40':'urni',
  '41':'uch',
  '42':'tr',
};

let _rl = null;

function showPrompt() {
  setAtPrompt(true);
  process.stdout.write(PROMPT);
}

function startCLI() {
  _rl = readline.createInterface({
    input:    process.stdin,
    output:   process.stdout,
    terminal: false,
  });

  cliControl.register(
    () => { setAtPrompt(false); if (_rl) _rl.pause(); },
    () => {
      if (_rl) _rl.resume();
      // re-print any logs that accumulated or were cleared during a command
      const state = require('../core/state');
      if (state.liveLog && state.liveLog.length > 0) {
        process.stdout.write('\n');
        state.liveLog.forEach(line => process.stdout.write(line + '\n'));
        process.stdout.write('\n');
      }
      setAtPrompt(true);
      process.stdout.write(PROMPT);
    }
  );

  showPrompt();

  _rl.on('line', async (line) => {
    if (cliControl.isBusy()) return;

    line = line.trim();
    setAtPrompt(false);

    if (!line) {
      showPrompt();
      return;
    }

    const numMatch = line.match(/^(\d{1,2})(?:\s+(.*))?$/);
    if (numMatch && NUM_MAP[numMatch[1]]) {
      const command = NUM_MAP[numMatch[1]];
      const rest    = (numMatch[2] || '').trim().split(/ +/).filter(Boolean);
      try {
        await handleCommand(command, rest, null);
      } catch (e) {
        err(e.message);
        if (cliControl.isBusy()) cliControl.resumeCLI();
      }
      if (!cliControl.wasResumed()) showPrompt();
      return;
    }

    if (!line.startsWith('.')) {
      process.stdout.write(`  ${C.grey}use .help or type a number (01-31) — .logout to switch account${C.reset}\n`);
      showPrompt();
      return;
    }

    const parts   = line.slice(1).trim().split(/ +/);
    const command = parts.shift().toLowerCase();
    try {
      await handleCommand(command, parts, null);
    } catch (e) {
      err(e.message);
      if (cliControl.isBusy()) cliControl.resumeCLI();
    }

    if (!cliControl.wasResumed()) showPrompt();
  });

  _rl.on('close', () => process.exit(0));
}

module.exports = { startCLI };
