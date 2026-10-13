'use strict';
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const { readLine, readYN }          = require('../utils/rawInput');
const { request }                   = require('../utils/request');
const state                         = require('../core/state');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function ln(s = '') { process.stdout.write(s + '\n'); }
function bad(s)     { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }
function inf(s)     { ln(`  ${C.grey}\u25c6${R}  ${C.silver}${s}${R}`); }

// random delay between min and max ms — jitter prevents pattern detection
function jitter(min, max) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

function gatewayAlive() {
  return state.ws && state.ws.readyState === 1;
}

module.exports = async function dmAll(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('\u25c8  DM ALL FRIENDS');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}terminal / termux only${R}`);
  process.stdout.write(SEP + '\n\n');

  let friends = Object.entries(state.friends);

  // fallback: fetch fresh from API if cache is empty
  if (friends.length === 0) {
    const rels = await request(ctx.token, 'GET', '/users/@me/relationships');
    if (Array.isArray(rels)) {
      for (const r of rels) {
        if (r.type === 1 && r.id) {
          state.friends[r.id] = r.user?.global_name || r.user?.username || r.id;
        }
      }
      friends = Object.entries(state.friends);
    }
  }

  if (friends.length === 0) {
    bad('no friends found on this account');
    ln();
    resumeCLI();
    return;
  }

  const { value: msgRaw, ctrl: c1 } = await readLine(`  ${C.silver}Message       ${C.darkRed}\u203a${R} `);
  if (c1 || !msgRaw.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }
  if (msgRaw.trim().length > 1900) { ln(); bad('message too long — max 1900 chars'); ln(); resumeCLI(); return; }

  const content = `[DM-ALL] ${msgRaw.trim()}`;

  ln();
  ln(`  ${C.silver}Friends  ${C.darkRed}\u203a${R}  ${C.white}${friends.length}${R}`);
  ln(`  ${C.silver}Message  ${C.darkRed}\u203a${R}  ${C.white}${content.slice(0, 55)}${content.length > 55 ? ' +more' : ''}${R}`);

  // warn if the list is large — give the user a chance to reconsider
  if (friends.length > 30) {
    ln();
    ln(`  ${C.bred}warning${R}  ${C.grey}${friends.length} friends is a lot — delay is 5-9s per DM to avoid bans${R}`);
    const eta = Math.round((friends.length * 7) / 60);
    ln(`  ${C.grey}estimated time: ~${eta} minute${eta !== 1 ? 's' : ''}${R}`);
  }

  ln();

  const go = await readYN(`  ${C.silver}Start? ${C.grey}[Y/N]: ${R}`);
  if (!go) { ln(); bad('aborted'); ln(); resumeCLI(); return; }

  ln();
  process.stdout.write(SEP + '\n');
  inf(`sending to ${friends.length} friend${friends.length !== 1 ? 's' : ''}`);
  ln();

  let success = 0, failed = 0, aborted = false;
  const TOTAL = String(friends.length).padStart(3, '0');

  for (let i = 0; i < friends.length; i++) {
    // stop immediately if the gateway was kicked
    if (!gatewayAlive()) {
      ln();
      bad('gateway disconnected — stopping to protect the account');
      aborted = true;
      break;
    }

    const [userId, username] = friends[i];
    const count = `${C.grey}[${String(i + 1).padStart(3, '0')}/${TOTAL}]${R}`;
    process.stdout.write(`  ${count}  ${C.grey}@${username.slice(0, 20).padEnd(20)}${R}  `);

    // open DM channel
    const dm = await request(ctx.token, 'POST', '/users/@me/channels', {
      recipient_id: userId,
    });

    if (!dm || !dm.id) {
      process.stdout.write(`${C.bred}\u2718${R}  ${C.grey}could not open DM${R}\n`);
      failed++;
      await jitter(4000, 7000);
      continue;
    }

    // send message
    const msg = await request(ctx.token, 'POST', `/channels/${dm.id}/messages`, { content });

    if (!msg || msg.code) {
      process.stdout.write(`${C.bred}\u2718${R}  ${C.grey}send failed${R}\n`);
      failed++;
      // back off more aggressively on failure — likely getting rate limited
      await jitter(8000, 14000);
    } else {
      process.stdout.write(`${C.red}\u2714${R}\n`);
      success++;
      // normal pace: 5–9s random delay between successful sends
      await jitter(5000, 9000);
    }
  }

  ln();
  process.stdout.write(SEP + '\n');
  ln(`  ${C.silver}sent     ${C.white}${success}${R}`);
  ln(`  ${C.silver}failed   ${C.white}${failed}${R}`);
  if (aborted) ln(`  ${C.bred}stopped early — gateway was disconnected${R}`);
  process.stdout.write(SEP + '\n\n');

  resumeCLI();
};
