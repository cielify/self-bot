'use strict';
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const { readLine, readYN }          = require('../utils/rawInput');
const { request }                   = require('../utils/request');
const { ensureGuildAccess }         = require('../utils/guildAccess');
const state                         = require('../core/state');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function ln(s = '') { process.stdout.write(s + '\n'); }
function bad(s)     { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }
function inf(s)     { ln(`  ${C.grey}\u25c6${R}  ${C.silver}${s}${R}`); }

async function execWebhook(id, token, content) {
  try {
    const res = await fetch(
      `https://discord.com/api/v9/webhooks/${id}/${token}?wait=false`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content }),
      }
    );
    return res.ok || res.status === 204 || res.status === 200;
  } catch (_) { return false; }
}

async function deleteWebhook(id, token) {
  try {
    await fetch(`https://discord.com/api/v9/webhooks/${id}/${token}`, { method: 'DELETE' });
  } catch (_) {}
}

function restorePresence() {
  if (!state.ws || state.ws.readyState !== 1) return;
  state.ws.send(JSON.stringify({
    op: 3,
    d:  { since: null, activities: [], status: 'online', afk: false },
  }));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = async function wAll(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('\u25c8  WEBHOOK ALL CHANNELS');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}terminal / termux only${R}`);
  process.stdout.write(SEP + '\n\n');

  const { value: guildInput, ctrl: c1 } = await readLine(`  ${C.silver}Server Id     ${C.darkRed}\u203a${R} `);
  if (c1 || !guildInput.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }
  const gid = guildInput.trim();
  if (!/^\d{15,20}$/.test(gid)) { ln(); bad('not a valid server ID'); ln(); resumeCLI(); return; }

  const access = await ensureGuildAccess(ctx.token, gid);
  if (!access.ok) { resumeCLI(); return; }
  const target = access.guildId;

  const { value: wName, ctrl: c2 } = await readLine(`  ${C.silver}Webhook Name  ${C.darkRed}\u203a${R} `);
  if (c2 || !wName.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }
  if (wName.trim().length > 80) { ln(); bad('name too long — max 80 chars'); ln(); resumeCLI(); return; }

  const DEFAULT_MSG =
    `@everyone Hello everyone, this is the Chinese regime. We are moving servers, and we are now spreading the love of Kyoto and China.\n\n` +
    `\`\`\`\n«        /          sora                \\       »\n\`\`\`\n\n` +
    `https://tenor.com/vwqnw6U4wxa.gif\n\n` +
    `Our servers:\n\n` +
    `https://discord.gg/G2Zc7ReBZj\n\n` +
    `https://discord.gg/Db5aw9dSd9`;

  const { value: wMsgRaw, ctrl: c3 } = await readLine(`  ${C.silver}Webhook Msg   ${C.darkRed}\u203a${R} `);
  if (c3) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }
  const wMsg = wMsgRaw.trim() || DEFAULT_MSG;
  if (wMsg.trim().length > 2000) { ln(); bad('message too long — max 2000 chars'); ln(); resumeCLI(); return; }

  const { value: cntRaw, ctrl: c4 } = await readLine(`  ${C.silver}How many? ${C.grey}(1\u2013100)${C.darkRed}  \u203a${R} `);
  if (c4) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }
  const msgCount = parseInt(cntRaw.trim(), 10);
  if (isNaN(msgCount) || msgCount < 1 || msgCount > 100) {
    ln(); bad('enter a number between 1 and 100'); ln(); resumeCLI(); return;
  }

  ln();
  ln(`  ${C.silver}Server   ${C.darkRed}\u203a${R}  ${C.white}${target}${R}`);
  ln(`  ${C.silver}Name     ${C.darkRed}\u203a${R}  ${C.white}${wName.trim()}${R}`);
  const msgPreview = wMsg.split('\n')[0].slice(0, 55);
  ln(`  ${C.silver}Message  ${C.darkRed}\u203a${R}  ${C.white}${msgPreview}${wMsg.length > 55 ? ' +more' : ''}${R}`);
  ln(`  ${C.silver}Per ch.  ${C.darkRed}\u203a${R}  ${C.white}${msgCount}${R}`);
  ln();

  const go = await readYN(`  ${C.silver}Start? ${C.grey}[Y/N]: ${R}`);
  if (!go) { ln(); bad('aborted'); ln(); resumeCLI(); return; }

  // ── create all webhooks ───────────────────────────────────────────────────
  ln();
  process.stdout.write(SEP + '\n');
  inf('fetching channels');
  ln();

  const channels = await request(ctx.token, 'GET', `/guilds/${target}/channels`);
  if (!channels || !Array.isArray(channels)) {
    bad('failed to fetch channels'); ln(); resumeCLI(); return;
  }

  const textChs  = channels.filter(ch => ch.type === 0 || ch.type === 5);
  const webhooks = [];
  let   skipped  = 0;

  for (const ch of textChs) {
    const label = `#${(ch.name || ch.id).slice(0, 22).padEnd(22)}`;
    process.stdout.write(`  ${C.grey}${label}${R}  `);

    const wh = await request(ctx.token, 'POST', `/channels/${ch.id}/webhooks`, {
      name: wName.trim(),
    });

    if (!wh || !wh.id || !wh.token) {
      process.stdout.write(`${C.bred}\u2718${R}  ${C.grey}no permission${R}\n`);
      skipped++;
      await sleep(250);
      continue;
    }

    webhooks.push({ channelName: ch.name || ch.id, id: wh.id, token: wh.token, sent: 0 });
    process.stdout.write(`${C.red}\u2714${R}  ${C.grey}webhook ready${R}\n`);
    await sleep(300);
  }

  ln();
  inf(`${webhooks.length} webhook${webhooks.length !== 1 ? 's' : ''} ready — ${skipped} skipped`);

  if (webhooks.length === 0) {
    ln(); bad('no webhooks created — account lacks MANAGE_WEBHOOKS in all channels');
    ln(); resumeCLI(); return;
  }

  // ── fire all channels concurrently, each webhook paces its own messages ──
  ln();
  process.stdout.write(SEP + '\n');
  inf('firing channels');
  ln();

  await Promise.all(
    webhooks.map(async (wh) => {
      for (let i = 0; i < msgCount; i++) {
        const ok = await execWebhook(wh.id, wh.token, wMsg.trim());
        if (ok) wh.sent++;
        if (i < msgCount - 1) await sleep(300);
      }
    })
  );

  const totalSent = webhooks.reduce((s, w) => s + w.sent, 0);
  inf(`${totalSent} messages delivered`);

  // ── delete all webhooks ───────────────────────────────────────────────────
  ln();
  process.stdout.write(SEP + '\n');
  inf('deleting webhooks');
  ln();

  await Promise.all(
    webhooks.map(async (wh) => {
      await deleteWebhook(wh.id, wh.token);
      ln(`  ${C.grey}#${wh.channelName.slice(0, 22).padEnd(22)}${R}  ${C.bred}\u2020${R}  ${C.grey}deleted${R}`);
    })
  );

  restorePresence();

  ln();
  process.stdout.write(SEP + '\n');
  ln(`  ${C.silver}webhooks created   ${C.white}${webhooks.length}${R}`);
  ln(`  ${C.silver}channels skipped   ${C.white}${skipped}${R}`);
  ln(`  ${C.silver}total msgs sent    ${C.white}${totalSent}${R}`);
  ln(`  ${C.grey}all webhooks deleted — account restored to online${R}`);
  process.stdout.write(SEP + '\n\n');

  resumeCLI();
};
