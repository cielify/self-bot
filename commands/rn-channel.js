'use strict';
const { C, clearScreen, typeText }    = require('../utils/banner');
const { pauseCLI, resumeCLI }         = require('../utils/cliControl');
const { setAtPrompt }                 = require('../utils/output');
const { readLine, readYN }            = require('../utils/rawInput');
const { request, friendlyError }      = require('../utils/request');
const { ensureGuildAccess }           = require('../utils/guildAccess');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

const RENAME_TYPES = new Set([0, 2, 4, 5, 13, 15]);

const TYPE_LABEL = {
  0:'text', 2:'voice', 4:'category', 5:'announcement', 13:'stage', 15:'forum',
};

function ln(s = '') { process.stdout.write(s + '\n'); }
function bad(s) { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }
function inf(s) { ln(`  ${C.grey}\u25c6${R}  ${C.silver}${s}${R}`); }

module.exports = async function rnChannel(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('◈  RENAME ALL CHANNELS');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}terminal / termux only${R}`);
  process.stdout.write(SEP + '\n\n');

  const { value: guildId, ctrl: c1 } = await readLine(`  ${C.silver}Server Id  ${C.darkRed}\u203a${R} `);
  if (c1 || !guildId.trim()) {
    ln(); bad('cancelled'); ln();
    resumeCLI();
    return;
  }

  const gid = guildId.trim();

  if (!/^\d{15,20}$/.test(gid)) {
    ln();
    bad('not a valid server ID — it must be 15-20 digits');
    ln();
    resumeCLI();
    return;
  }

  const access = await ensureGuildAccess(ctx.token, gid);
  if (!access.ok) {
    resumeCLI();
    return;
  }

  const target = access.guildId;

  const { value: newName, ctrl: c2 } = await readLine(`  ${C.silver}Name       ${C.darkRed}\u203a${R} `);
  if (c2 || !newName.trim()) {
    ln(); bad('cancelled — name cannot be empty'); ln();
    resumeCLI();
    return;
  }

  if (newName.trim().length > 100) {
    ln(); bad('name too long — max 100 characters'); ln();
    resumeCLI();
    return;
  }

  ln();
  ln(`  ${C.silver}Server  ${C.darkRed}\u203a${R}  ${C.white}${target}${R}`);
  ln(`  ${C.silver}Name    ${C.darkRed}\u203a${R}  ${C.white}${newName.trim()}${R}`);
  ln();

  const go = await readYN(`  ${C.silver}Start? ${C.grey}[Y/N]: ${R}`);
  if (!go) { ln(); bad('aborted'); ln(); resumeCLI(); return; }

  ln();
  process.stdout.write(SEP + '\n');
  inf('fetching channels...');

  const channels = await request(ctx.token, 'GET', `/guilds/${target}/channels`);

  if (!channels || !Array.isArray(channels)) {
    ln();
    bad(`fetch failed — ${friendlyError(channels)}`);
    ln();
    resumeCLI();
    return;
  }

  if (channels.length === 0) {
    ln();
    bad('no channels found in this server');
    ln();
    resumeCLI();
    return;
  }

  const targets = channels.filter(ch => RENAME_TYPES.has(ch.type));

  if (targets.length === 0) {
    ln();
    bad('no renameable channels found in this server');
    ln();
    resumeCLI();
    return;
  }

  inf(`${targets.length} channels found`);
  process.stdout.write(SEP + '\n\n');

  let success = 0, failed = 0;
  const TOTAL = String(targets.length).padStart(3, '0');

  for (let i = 0; i < targets.length; i++) {
    const ch    = targets[i];
    const label = TYPE_LABEL[ch.type] || `type${ch.type}`;
    const count = `${C.grey}[${String(i + 1).padStart(3, '0')}/${TOTAL}]${R}`;

    process.stdout.write(
      `  ${count}  ${C.grey}[${label}]${R}  ${C.silver}${ch.name || ch.id}${R}  `
    );

    const res = await request(ctx.token, 'PATCH', `/channels/${ch.id}`, {
      name: newName.trim(),
    });

    const isErr = res !== null && typeof res === 'object' && res.code !== undefined;

    if (!isErr) {
      process.stdout.write(`${C.red}\u2714${R}\n`);
      success++;
    } else {
      const reason = friendlyError(res);
      process.stdout.write(`${C.bred}\u2718${R}  ${C.grey}${reason}${R}\n`);
      failed++;
    }

    if (i < targets.length - 1) await new Promise(r => setTimeout(r, 350));
  }

  process.stdout.write('\n' + SEP + '\n');
  ln(`  ${C.silver}renamed  ${C.white}${success}${R}  ${C.grey}|  failed  ${C.white}${failed}${R}`);
  process.stdout.write(SEP + '\n\n');

  resumeCLI();
};
