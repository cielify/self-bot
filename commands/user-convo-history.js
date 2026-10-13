'use strict';
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const { readLine }                  = require('../utils/rawInput');
const { request }                   = require('../utils/request');
const { ensureGuildAccess }         = require('../utils/guildAccess');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(52)}${R}`;

function ln(s = '') { process.stdout.write((s || '') + '\n'); }
function bad(s)     { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }
function inf(s)     { ln(`  ${C.grey}\u25c6${R}  ${C.silver}${s}${R}`); }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }

function fmtTime(ts) {
  return new Date(ts).toLocaleString();
}

// ── Discord guild message search endpoint ─────────────────────────────────
// Returns { total_results, messages: [[...context]...] }
// Each inner array is a context window; the matched msg has hit: true
async function searchPage(token, guildId, userId, offset) {
  return request(token, 'GET',
    `/guilds/${guildId}/messages/search?author_id=${userId}&offset=${offset}&include_nsfw=true`);
}

const PAGE_SIZE   = 25;
const MAX_RESULTS = 250; // cap to stay under rate limits

module.exports = async function userConvoHistory(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('\u25c8  USER CONVO HISTORY');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}terminal / termux only  \u2014  scans all channels via search API${R}`);
  process.stdout.write(SEP + '\n\n');

  // ── prompts ───────────────────────────────────────────────────────────────
  const { value: gi, ctrl: c1 } = await readLine(`  ${C.silver}Server Id  ${C.darkRed}\u203a${R} `);
  if (c1 || !gi.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }
  const gid = gi.trim();
  if (!/^\d{15,20}$/.test(gid)) { ln(); bad('invalid server ID'); ln(); resumeCLI(); return; }

  const access = await ensureGuildAccess(ctx.token, gid);
  if (!access.ok) { resumeCLI(); return; }
  const target = access.guildId;

  const { value: ui, ctrl: c2 } = await readLine(`  ${C.silver}User Id    ${C.darkRed}\u203a${R} `);
  if (c2 || !ui.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }
  const userId = ui.replace(/[<@!>]/g, '').trim();
  if (!/^\d{15,20}$/.test(userId)) { ln(); bad('invalid user ID'); ln(); resumeCLI(); return; }

  ln();
  process.stdout.write(SEP + '\n');
  inf('searching — this uses the guild message search API...');
  ln();

  // ── paginated fetch ───────────────────────────────────────────────────────
  const hits        = [];          // { channelId, msg }
  const channelMeta = new Map();   // channelId → { name, type }
  let total         = null;
  let offset        = 0;
  let errored       = false;

  while (true) {
    const res = await searchPage(ctx.token, target, userId, offset);

    if (!res || res.code) {
      // 403 = no access; 400 = bad params; first page failure = hard stop
      if (hits.length === 0) {
        ln(); bad(`search failed — ${res?.message || 'no response'}`);
        if (res?.code === 403 || res?.code === 50013) {
          bad('account lacks Search Messages / View Channel permission');
        }
        ln(); resumeCLI(); return;
      }
      errored = true;
      break;
    }

    if (total === null) {
      total = res.total_results ?? 0;
      inf(`total messages on server: ${total}`);
      if (total === 0) {
        ln(); bad('no messages found for this user'); ln();
        resumeCLI(); return;
      }
      ln();
    }

    // each element in res.messages is a context window; extract the hit message
    for (const ctx_group of (res.messages || [])) {
      // the search API marks the matched message with hit: true
      const hit = ctx_group.find(m => m.hit) || ctx_group[0];
      if (!hit) continue;

      const cid = hit.channel_id;
      // harvest channel metadata from the context if present
      if (!channelMeta.has(cid)) {
        // the search result sometimes includes a channel_mentions or resolved channel
        const chObj = hit.mention_channels?.find(c => c.id === cid)
                   || res.threads?.find(t => t.id === cid)
                   || null;
        channelMeta.set(cid, {
          name: chObj?.name || null,
          type: chObj?.type ?? null,
        });
      }
      hits.push({ channelId: cid, msg: hit });
    }

    process.stdout.write(`  ${C.grey}  page ${Math.floor(offset / PAGE_SIZE) + 1}` +
      `  —  collected ${hits.length} / ${Math.min(total, MAX_RESULTS)}${R}\r`);

    offset += PAGE_SIZE;
    if (offset >= Math.min(total, MAX_RESULTS)) break;

    // search endpoint rate limit: ~5 req/5s comfortably
    await sleep(1100);
  }

  process.stdout.write('\n');
  ln();

  if (hits.length === 0) {
    bad('no hits collected'); ln(); resumeCLI(); return;
  }

  // resolve any missing channel names from the guild channel list
  const channels = await request(ctx.token, 'GET', `/guilds/${target}/channels`);
  if (Array.isArray(channels)) {
    for (const ch of channels) {
      if (!channelMeta.has(ch.id)) channelMeta.set(ch.id, { name: ch.name, type: ch.type });
      else if (!channelMeta.get(ch.id).name) channelMeta.get(ch.id).name = ch.name;
    }
  }

  // ── group by channel ──────────────────────────────────────────────────────
  const byChannel = new Map(); // channelId → msg[]
  for (const h of hits) {
    if (!byChannel.has(h.channelId)) byChannel.set(h.channelId, []);
    byChannel.get(h.channelId).push(h.msg);
  }

  // deduplicate by message id (search can return dupes)
  for (const [cid, msgs] of byChannel) {
    const seen = new Set();
    byChannel.set(cid, msgs.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id); return true;
    }));
  }

  // sort messages within each channel oldest → newest
  for (const [, msgs] of byChannel) {
    msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // sort channels by their most recent message newest → oldest
  const sortedChannels = [...byChannel.entries()].sort((a, b) => {
    const la = a[1][a[1].length - 1].timestamp;
    const lb = b[1][b[1].length - 1].timestamp;
    return new Date(lb) - new Date(la);
  });

  // ── display ───────────────────────────────────────────────────────────────
  process.stdout.write(SEP + '\n');
  inf(`channels with activity: ${sortedChannels.length}  —  messages shown: ${hits.length}` +
    (total > MAX_RESULTS ? `  (capped at ${MAX_RESULTS} of ${total})` : '') +
    (errored ? '  (search error mid-way — partial results)' : ''));
  process.stdout.write(SEP + '\n\n');

  for (const [cid, msgs] of sortedChannels) {
    const meta  = channelMeta.get(cid) || {};
    const cname = meta.name ? `#${meta.name}` : `#${cid}`;

    // channel header
    process.stdout.write(
      `  ${C.bred}${C.bold}${cname}${R}  ` +
      `${C.grey}(${cid})  ${msgs.length} message${msgs.length !== 1 ? 's' : ''}${R}\n`
    );
    process.stdout.write(`${C.darkRed}${'─'.repeat(52)}${R}\n\n`);

    for (const msg of msgs) {
      const ts       = fmtTime(msg.timestamp);
      const edited   = msg.edited_timestamp ? ` ${C.grey}[edited]${R}` : '';
      const raw      = (msg.content || '').replace(/\n/g, ' \u21b5 ');
      const content  = raw || `${C.grey}[no text]${R}`;
      const pinned   = msg.pinned ? `  ${C.grey}[pinned]${R}` : '';
      const attachs  = (msg.attachments  || []).length;
      const embeds   = (msg.embeds       || []).length;
      const replies  = msg.referenced_message ? msg.referenced_message.id : null;
      const stickers = (msg.sticker_items || []).map(s => s.name).join(', ');

      process.stdout.write(`  ${C.grey}${ts}${R}${edited}${pinned}\n`);

      if (replies) {
        const refAuthor  = msg.referenced_message?.author?.username || '?';
        const refContent = (msg.referenced_message?.content || '[no text]').slice(0, 50);
        process.stdout.write(
          `  ${C.grey}\u2514 replying to ${refAuthor}: ${refContent}${refContent.length >= 50 ? '\u2026' : ''}${R}\n`
        );
      }

      process.stdout.write(`  ${C.silver}${raw.slice(0, 140)}${raw.length > 140 ? '\u2026' : (raw ? '' : `${C.grey}[no text]${R}`)}${R}\n`);

      if (stickers) process.stdout.write(`  ${C.grey}[sticker: ${stickers}]${R}\n`);

      if (attachs > 0) {
        const names = (msg.attachments || []).map(a => a.filename || a.url?.split('/').pop() || '?').join(', ');
        process.stdout.write(`  ${C.grey}[\u2191 ${attachs} attachment${attachs > 1 ? 's' : ''}: ${names.slice(0, 80)}]${R}\n`);
      }

      if (embeds > 0) {
        const titles = (msg.embeds || []).map(e => e.title || e.url || 'embed').join(', ');
        process.stdout.write(`  ${C.grey}[embed: ${titles.slice(0, 80)}]${R}\n`);
      }

      if ((msg.reactions || []).length > 0) {
        const rxn = msg.reactions.slice(0, 6).map(r =>
          `${r.emoji?.name || '?'}\u00d7${r.count}`
        ).join('  ');
        process.stdout.write(`  ${C.grey}${rxn}${R}\n`);
      }

      ln();
    }

    ln();
  }

  process.stdout.write(SEP + '\n\n');
  resumeCLI();
};
