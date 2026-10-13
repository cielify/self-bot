'use strict';
const { C, clearScreen, typeText }   = require('../utils/banner');
const { pauseCLI, resumeCLI }        = require('../utils/cliControl');
const { setAtPrompt }                = require('../utils/output');
const { readLine }                   = require('../utils/rawInput');
const { request }                    = require('../utils/request');
const { snowflakeToDate }            = require('../utils/snowflake');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function ln(s = '') { process.stdout.write(s + '\n'); }
function bad(s)     { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }

const NITRO = { 0: 'none', 1: 'Nitro Classic', 2: 'Nitro', 3: 'Nitro Basic' };

module.exports = async function dtinfo(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('◈  TOKEN INFO');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}current logged-in account${R}`);
  process.stdout.write(SEP + '\n\n');

  ln(`  ${C.grey}fetching account info...${R}`);
  ln();

  const me = await request(ctx.token, 'GET', '/users/@me');

  if (!me || me.code !== undefined || !me.username) {
    bad(`lookup failed — ${me?.message || 'no response from Discord'}`);
    ln();
    resumeCLI();
    return;
  }

  const tag = me.discriminator && me.discriminator !== '0'
    ? `${me.username}#${me.discriminator}`
    : me.username;

  const rows = [
    ['username',  tag],
    ['id',        me.id],
    ['display',   me.global_name || 'none'],
    ['created',   snowflakeToDate(me.id)],
    ['bot',       me.bot ? 'yes' : 'no'],
    ['nitro',     NITRO[me.premium_type] || 'none'],
    ['email',     me.email || 'hidden'],
    ['verified',  me.verified ? 'yes' : 'no'],
    ['phone',     me.phone || 'none'],
    ['2fa',       me.mfa_enabled ? 'enabled' : 'disabled'],
    ['locale',    me.locale || 'unknown'],
    ['avatar',    me.avatar
      ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png`
      : 'default'],
  ];

  for (const [k, v] of rows) {
    process.stdout.write(
      `  ${C.red}\u00bb${R} ${C.silver}${String(k).padEnd(10)}${R} ${C.white}${v}${R}\n`
    );
  }

  process.stdout.write('\n' + SEP + '\n\n');

  await readLine(`  ${C.grey}Press Enter to return${R}  `);

  const { printBanner, printMenu } = require('../utils/banner');
  clearScreen();
  printBanner();
  printMenu();
  resumeCLI();
};
