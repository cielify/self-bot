'use strict';
const { C, clearScreen, typeText }    = require('../utils/banner');
const { pauseCLI, resumeCLI }         = require('../utils/cliControl');
const { setAtPrompt }                 = require('../utils/output');
const { readLine, readYN }            = require('../utils/rawInput');
const { request, friendlyError }      = require('../utils/request');
const { ensureGuildAccess }           = require('../utils/guildAccess');
const { fetchAllMembers }             = require('../utils/memberFetch');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function ln(s = '') { process.stdout.write(s + '\n'); }
function ok(s)  { ln(`  ${C.red}\u2714${R}  ${C.silver}${s}${R}`); }
function bad(s) { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }
function inf(s) { ln(`  ${C.grey}\u25c6${R}  ${C.silver}${s}${R}`); }

module.exports = async function rnUser(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('◈  RENAME ALL USERS');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}terminal / termux only${R}`);
  process.stdout.write(SEP + '\n\n');

  const { value: guildId, ctrl: c1 } = await readLine(`  ${C.silver}Server Id  ${C.darkRed}\u203a${R} `);
  if (c1 || !guildId.trim()) {
    ln();
    bad('cancelled');
    ln();
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

  const { value: nickname, ctrl: c2 } = await readLine(`  ${C.silver}Nickname   ${C.darkRed}\u203a${R} `);
  if (c2) {
    ln();
    bad('cancelled');
    ln();
    resumeCLI();
    return;
  }

  if (nickname.trim().length > 32) {
    ln();
    bad('nickname too long — max 32 characters');
    ln();
    resumeCLI();
    return;
  }

  ln();
  ln(`  ${C.silver}Server  ${C.darkRed}\u203a${R}  ${C.white}${target}${R}`);
  ln(`  ${C.silver}Nick    ${C.darkRed}\u203a${R}  ${C.white}${nickname.trim() || '(reset to username)'}${R}`);
  ln();

  const go = await readYN(`  ${C.silver}Start? ${C.grey}[Y/N]: ${R}`);
  if (!go) { ln(); bad('aborted'); ln(); resumeCLI(); return; }

  ln();
  process.stdout.write(SEP + '\n');
  inf('fetching members...');

  const { members, error } = await fetchAllMembers(ctx.token, target);

  if (error) {
    ln();
    bad(`fetch failed — ${friendlyError(error)}`);
    ln();
    resumeCLI();
    return;
  }

  if (members.length === 0) {
    ln();
    bad('no members found in this server');
    ln();
    resumeCLI();
    return;
  }

  inf(`${members.length} members found`);
  process.stdout.write(SEP + '\n\n');

  let success = 0, failed = 0;
  const TOTAL = String(members.length).padStart(3, '0');

  for (let i = 0; i < members.length; i++) {
    const m     = members[i];
    const uid   = m.user?.id;
    const uname = m.user?.username || uid;
    const count = `${C.grey}[${String(i + 1).padStart(3, '0')}/${TOTAL}]${R}`;

    process.stdout.write(`  ${count}  ${C.grey}@${uname}${R}  `);

    const res = await request(ctx.token, 'PATCH', `/guilds/${target}/members/${uid}`, {
      nick: nickname.trim(),
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

    if (i < members.length - 1) await new Promise(r => setTimeout(r, 320));
  }

  process.stdout.write('\n' + SEP + '\n');
  ln(`  ${C.silver}renamed  ${C.white}${success}${R}  ${C.grey}|  failed  ${C.white}${failed}${R}`);
  process.stdout.write(SEP + '\n\n');

  resumeCLI();
};
