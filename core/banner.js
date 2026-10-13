'use strict';
const output = require('./output');

const C = {
  reset:   '\x1b[0m',  bold:    '\x1b[1m',
  red:     '\x1b[31m', bred:    '\x1b[91m',
  darkRed: '\x1b[38;5;88m', crimson: '\x1b[38;5;160m',
  blood:   '\x1b[38;5;124m', white: '\x1b[97m',
  grey:    '\x1b[90m', silver:  '\x1b[37m',
};
const R  = C.reset;
const DK = C.darkRed;

const TITLE_LINES = [
  '        ██████████████████╗',
  '              ╔════████████╝',
  '             ╔╝             ',
  '            ╔╝              ',
  '  ██████████╔═══════════╗   ',
  '  ╚══════════════════════╝  ',
];
const DRIP    = '  ╿  ╿   ╿╿╿  ╿  ╿   ╿╿  ╿╿ ╿   ╿  ╿╿╿╿ ╿';
const TOP_SEP = `${C.blood}${'═'.repeat(52)}${R}`;
const MID_SEP = `${DK}${'─'.repeat(52)}${R}`;
const DSEP    = '';

function clearScreen() {
  process.stdout.write('\x1b[3J\x1b[2J\x1b[H');
}

async function typeText(text, delay = 20) {
  for (const char of text) {
    process.stdout.write(char);
    if (char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t') {
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

const COL_W = 22;

const num = (s) => `${C.grey}${s}${R}`;
const cmd = (s) => `${C.bred}${s}${R}`;

function bTop(label) {
  const inner = `\u2500 ${label} `;
  const dashes = Math.max(0, COL_W - 2 - inner.length);
  return `${DK}\u250c${inner}${'\u2500'.repeat(dashes)}\u2510${R}`;
}
function bBot() {
  return `${DK}\u2514${'\u2500'.repeat(COL_W - 2)}\u2518${R}`;
}
function bRow(n, c) {
  const inner = `[${n}] ${c}`;
  const pad   = Math.max(0, COL_W - 2 - 1 - inner.length);
  return `${DK}\u2502${R} ${num('['+n+']')} ${cmd(c)}${' '.repeat(pad)}${DK}\u2502${R}`;
}
function bEmpty() {
  return `${DK}\u2502${' '.repeat(COL_W - 2)}\u2502${R}`;
}

function printMenu() {
  const col1 = [
    ['01', '.purge'],
    ['02', '.export'],
    ['03', '.s'],
    ['04', '.wc'],
    ['05', '.gc,conf'],
    ['06', '.wbh'],
    ['07', '.w-all'],
    ['08', '.rn-wh-all'],
    ['09', '.antigc'],
    ['10', '.rn-channel'],
    ['11', '.d'],
  ];
  const col2 = [
    ['12', '.userinfo'],
    ['13', '.serverinfo'],
    ['14', '.avatar'],
    ['15', '.add'],
    ['16', '.pn'],
    ['17', '.users-id'],
    ['18', '.rn-user'],
    ['19', '.dt-info'],
    ['20', '.dt-joiner'],
    ['21', '.help'],
    ['32', '.dmall'],
    ['33', '.setup'],
    ['34', '.live-monitor'],
    ['36', '.block'],
    ['37', '.closedm'],
    ['38', '.kickg'],
    ['39', '.invis'],
    ['40', '.urni'],
    ['41', '.uch'],
    ['42', '.tr'],
  ];
  const col3 = [
    ['22', '.ip'],
    ['23', '.ip-p'],
    ['24', '.ip-ping'],
    ['25', '.ip-gen'],
    ['26', '.email'],
    ['27', '.ut'],
    ['28', '.ping'],
    ['29', '.p-encrypt'],
    ['30', '.p-decrypt'],
    ['31', '.a'],
  ];

  const maxRows = Math.max(col1.length, col2.length, col3.length);

  function row(a, b, c) {
    process.stdout.write(a + '  ' + b + '  ' + c + '\n');
  }

  process.stdout.write('\n');
  row(bTop('Channel + Actions'), bTop('User + Server'), bTop('Network + Tools'));
  for (let i = 0; i < maxRows; i++) {
    row(
      col1[i] ? bRow(...col1[i]) : bEmpty(),
      col2[i] ? bRow(...col2[i]) : bEmpty(),
      col3[i] ? bRow(...col3[i]) : bEmpty(),
    );
  }
  row(bBot(), bBot(), bBot());
  process.stdout.write(`  ${C.grey}.logout  —  switch account${R}\n`);
  process.stdout.write(MID_SEP + '\n\n');
}

const HELP_SECTIONS = [
  ['Channel', [
    ['01', '.purge  <1-50>',           'delete your recent messages'],
    ['02', '.export [ch_id]',           'save channel messages to file'],
    ['03', '.s      [ch_id]',           'snipe last deleted message'],
    ['04', '.wc     [ch_id]',           'create webhook \u2192 URL to terminal'],
    ['05', '.gc,conf',                  'gc rename + message loop wizard'],
    ['06', '.add    <id or @>',         'send a friend request'],
    ['07', '.avatar <id or @>',         'view user avatar / PFP'],
  ]],
  ['Lookup', [
    ['08', '.u / .userinfo  <id>',      'look up a Discord user'],
    ['09', '.si / .serverinfo [id]',    'look up a Discord server'],
    ['10', '.ip    <ip>',               'IP address information'],
    ['11', '.email <email>',            'email reputation check'],
    ['12', '.ut    <username>',         'username check across platforms'],
    ['13', '.pn    <phone>',            'phone number information'],
    ['14', '.wbh   <webhook url>',      'webhook information'],
  ]],
  ['Network / Crypto', [
    ['15', '.ip-p      <ip>',           'scan common ports on an IP'],
    ['16', '.ip-ping   <ip>',           'ping an IP address (4 packets)'],
    ['17', '.ip-gen    [count]',        'generate random public IPs'],
    ['18', '.p-encrypt <key> <msg>',    'AES-256 encrypt a message'],
    ['19', '.p-decrypt <key> <data>',   'AES-256 decrypt a message'],
  ]],
  ['Token Tools', [
    ['24', '.dt-info',                  'check Discord token info (terminal)'],
    ['25', '.dt-joiner',               'join servers with tokens (terminal)'],
    ['26', '.antigc  on/off',           'auto-leave group DMs you are added to'],
  ]],
  ['Server Tools  (terminal only)', [
    ['27', '.rn-user',                  'rename all users in a server'],
    ['28', '.rn-channel',               'rename all channels in a server'],
    ['29', '.users-id',                 'list all user IDs in a server'],
    ['39', '.invis  <id>',              'check if a user is invisible (offline spoof)'],
    ['40', '.urni  (alias: .user-role-n-info)', 'browse server roles \u203a members \u203a profile \u203a perms'],
    ['41', '.uch   (alias: .user-convo-history)', 'search all messages by a user across every channel'],
    ['42', '.tr  [lang]',              'reply to a message to translate it (default: English)'],
  ]],
  ['System', [
    ['20', '.ping',                     'gateway latency'],
    ['21', '.d / .mutual',              'toggle mutual friend join alerts'],
    ['22', '.a / .fq',                 'toggle auto friend accept'],
    ['23', '.help',                     'show this page'],
  ]],
];

function printBanner() {
  process.stdout.write('\n' + TOP_SEP + '\n');
  const colors = [C.blood, C.crimson, C.red, C.red, C.bred, C.bred];
  TITLE_LINES.forEach((line, i) => {
    process.stdout.write(`${colors[i]}${C.bold}${line}${R}\n`);
  });
  process.stdout.write(`${C.blood}${DRIP}${R}\n`);
  process.stdout.write(TOP_SEP + '\n');
  process.stdout.write(MID_SEP + '\n\n');
}

function card(title, fields) {
  const lines = [
    `  ${C.bred}${C.bold}\u25c8  ${title}${R}`,
    ...fields.map(([k, v]) =>
      `  ${C.red}\u00bb${R} ${C.silver}${String(k).padEnd(14)}${R}${C.white}${v}${R}`
    ),
  ];
  return lines.join('\n');
}

function discordCard(title, fields) {
  const rows = fields.map(([k, v]) => `» ${String(k).padEnd(14)} ${v}`);
  return [
    `**◈ ${title}**`,
    '```',
    ...rows,
    '```',
  ].join('\n');
}

function stripMarkdown(text) {
  return String(text)
    .replace(/\*\*/g, '').replace(/\*/g, '')
    .replace(/__(.+?)__/gs, '$1').replace(/~~(.+?)~~/gs, '$1')
    .replace(/```[\w]*\n?/g, '').replace(/```/g, '')
    .replace(/`([^`\n]+)`/g, '$1');
}

function ok(msg)   { output.print(`  ${C.red}\u2714${R}  ${C.white}${msg}${R}`); }
function err(msg)  { output.print(`  ${C.bred}\u2718${R}  ${C.bred}${msg}${R}`); }
function info(msg) { output.print(`  ${C.grey}\u25c6${R}  ${C.silver}${msg}${R}`); }

module.exports = {
  C, clearScreen, typeText,
  printBanner, printMenu, HELP_SECTIONS,
  card, discordCard, stripMarkdown,
  TOP_SEP, MID_SEP, DSEP,
  ok, err, info,
};
