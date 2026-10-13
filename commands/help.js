'use strict';
const { C, clearScreen, typeText, TOP_SEP, MID_SEP, HELP_SECTIONS } = require('../utils/banner');
const { pauseCLI, resumeCLI } = require('../utils/cliControl');
const { readLine }             = require('../utils/rawInput');

const R  = C.reset;
const DK = C.darkRed;

module.exports = async function help(args, { edit, isTerminal }) {
  if (!isTerminal) {
    const lines = [
      '**◈ MANIA — COMMANDS**',
      '```',
      '01  .purge <1-50>          delete your messages',
      '02  .export [ch_id]        save channel to file',
      '03  .s [ch_id]             snipe deleted messages',
      '04  .wc [ch_id]            create webhook → terminal',
      '05  .gc,conf               gc rename + message loop',
      '06  .add <id or @>         send friend request',
      '07  .avatar <id or @>      view user avatar / PFP',
      '08  .userinfo <id>         Discord user lookup',
      '09  .serverinfo [id]       Discord server lookup',
      '10  .ip <ip>               IP address info',
      '11  .email <email>         email reputation check',
      '12  .ut <username>         username tracker',
      '13  .pn <phone>            phone number info',
      '14  .wbh <url>             webhook info',
      '15  .ip-p <ip>             port scanner',
      '16  .ip-ping <ip>          ping an IP',
      '17  .ip-gen [count]        generate IPs',
      '18  .p-encrypt <k> <msg>   AES-256 encrypt',
      '19  .p-decrypt <k> <data>  AES-256 decrypt',
      '20  .ping                  gateway latency',
      '21  .d / .mutual           mutual alerts toggle',
      '22  .a / .fq               auto friend toggle',
      '23  .help                  show this page',
      '24  .dt-info               token info (terminal only)',
      '25  .dt-joiner             token joiner (terminal only)',
      '26  .antigc on/off         auto-leave group DMs',
      '27  .rn-user               rename all users (terminal only)',
      '28  .rn-channel            rename all channels (terminal only)',
      '29  .users-id              list user IDs (terminal only)',
      '```',
    ];
    return edit(lines.join('\n'));
  }

  pauseCLI();

  clearScreen();
  process.stdout.write('\n' + TOP_SEP + '\n');
  process.stdout.write(`  ${C.blood}${C.bold}`);
  await typeText('MANIA  \u2014  COMMANDS');
  process.stdout.write(R + '\n');
  process.stdout.write(TOP_SEP + '\n\n');

  const num = (s) => `${C.grey}${s}${R}`;
  const cmd = (s) => `${C.bred}${s}${R}`;
  const dsc = (s) => `${C.silver}${s}${R}`;

  for (const [title, cmds] of HELP_SECTIONS) {
    process.stdout.write(`${C.blood}${C.bold}  ${title}${R}\n`);
    process.stdout.write(`${DK}${'─'.repeat(60)}${R}\n`);
    for (const [n, c, d] of cmds) {
      process.stdout.write(`  ${num('['+n+']')}  ${cmd(c.padEnd(28))}  ${dsc(d)}\n`);
    }
    process.stdout.write('\n');
  }

  process.stdout.write(MID_SEP + '\n');
  process.stdout.write(`  ${C.grey}Tip: type a number (01\u201329) to run a command directly${R}\n`);
  process.stdout.write(MID_SEP + '\n\n');

  await readLine(`  ${C.grey}Press Enter to return${R}  `);

  const { printBanner, printMenu } = require('../utils/banner');
  clearScreen();
  printBanner();
  printMenu();
  resumeCLI();
};
