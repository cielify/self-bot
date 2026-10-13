'use strict';
const { C }        = require('./banner');
const { request }  = require('./request');
const { readLine } = require('./rawInput');

const R = C.reset;

async function listMyGuilds(token) {
  const guilds = [];
  let after = null;

  while (true) {
    let path = '/users/@me/guilds?limit=200&with_counts=true';
    if (after) path += `&after=${after}`;

    const batch = await request(token, 'GET', path);

    if (!batch || !Array.isArray(batch)) break;

    guilds.push(...batch);

    if (batch.length < 200) break;
    after = batch[batch.length - 1].id;
  }

  return guilds;
}

function fmtCount(n) {
  if (typeof n !== 'number' || isNaN(n)) return null;
  return n.toLocaleString('en-US');
}

function printGuildList(guilds) {
  const shown = guilds.slice(0, 25);

  shown.forEach((g, i) => {
    const num  = String(i + 1).padStart(2, '0');
    const name = (g.name || 'unnamed').slice(0, 28);
    const cnt  = fmtCount(g.approximate_member_count);
    const tail = cnt ? `  ${C.grey}— ${cnt} members${R}` : '';
    process.stdout.write(`  ${C.grey}[${C.bred}${num}${C.grey}]${R}  ${C.white}${name}${R}  ${C.grey}${g.id}${R}${tail}\n`);
  });

  if (guilds.length > shown.length) {
    process.stdout.write(`  ${C.grey}...and ${guilds.length - shown.length} more (showing first 25)${R}\n`);
  }
}

async function ensureGuildAccess(token, gid) {
  process.stdout.write(`\n  ${C.grey}\u25c6 checking this account's servers...${R}\n`);

  const guilds = await listMyGuilds(token);

  if (guilds.length === 0) {
    process.stdout.write('\n');
    process.stdout.write(`  ${C.bred}\u2718${R}  ${C.grey}this account is not in any server — join the server with this account first${R}\n\n`);
    return { ok: false };
  }

  const found = guilds.find(g => g.id === gid);

  if (found) return { ok: true, guildId: gid };

  process.stdout.write('\n');
  process.stdout.write(`  ${C.bred}\u2718${R}  ${C.grey}account is not in server ${C.white}${gid}${R}\n`);
  process.stdout.write(`  ${C.grey}these are the servers this account is actually in:${R}\n\n`);

  printGuildList(guilds);

  process.stdout.write('\n');
  const { value: pick, ctrl } = await readLine(`  ${C.silver}type a number to use that server, or press Enter to cancel ${C.darkRed}\u203a${R} `);

  if (ctrl || !pick.trim()) {
    process.stdout.write('\n');
    process.stdout.write(`  ${C.bred}\u2718${R}  ${C.grey}cancelled${R}\n\n`);
    return { ok: false };
  }

  const idx = parseInt(pick.trim(), 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= Math.min(guilds.length, 25)) {
    process.stdout.write('\n');
    process.stdout.write(`  ${C.bred}\u2718${R}  ${C.grey}invalid selection${R}\n\n`);
    return { ok: false };
  }

  const chosen = guilds[idx];

  process.stdout.write(`\n  ${C.red}\u2714${R}  ${C.silver}using server ${C.white}${chosen.name || chosen.id}${R}  ${C.grey}(${chosen.id})${R}\n\n`);

  return { ok: true, guildId: chosen.id };
}

module.exports = { listMyGuilds, ensureGuildAccess };
