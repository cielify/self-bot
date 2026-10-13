'use strict';
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const { readLine }                  = require('../utils/rawInput');
const { friendlyError }             = require('../utils/request');
const { ensureGuildAccess }         = require('../utils/guildAccess');
const { fetchAllMembers }           = require('../utils/memberFetch');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function ln(s = '') { process.stdout.write(s + '\n'); }
function bad(s)     { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }
function inf(s)     { ln(`  ${C.grey}\u25c6${R}  ${C.silver}${s}${R}`); }

module.exports = async function usersId(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('◈  USER ID LIST');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}terminal / termux only${R}`);
  process.stdout.write(SEP + '\n\n');

  const { value: guildId, ctrl } = await readLine(`  ${C.silver}Server Id  ${C.darkRed}\u203a${R} `);
  if (ctrl || !guildId.trim()) {
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
    bad('no members found — this server may have no readable members');
    ln();
    resumeCLI();
    return;
  }

  const seen = new Set();
  const ids  = [];
  for (const m of members) {
    const id = m.user?.id;
    if (id && !seen.has(id)) { seen.add(id); ids.push(id); }
  }

  inf(`${ids.length} members found`);
  process.stdout.write(SEP + '\n\n');

  const PER_ROW = 4;
  for (let i = 0; i < ids.length; i += PER_ROW) {
    const chunk = ids.slice(i, i + PER_ROW);
    const line  = chunk.map(id => `${C.white}<${id}>${R}`).join(`  ${C.grey}│${R}  `);
    process.stdout.write(`  ${line}\n`);
  }

  process.stdout.write('\n' + SEP + '\n');
  ln(`  ${C.silver}total  ${C.white}${ids.length}${R}`);
  process.stdout.write(SEP + '\n\n');

  resumeCLI();
};
