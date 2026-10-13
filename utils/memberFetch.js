'use strict';
const state        = require('../core/state');
const { request }  = require('./request');

const WS_OPEN = 1; // WebSocket.OPEN

// ── op 14: LAZY_REQUEST_GUILD_MEMBERS ────────────────────────────────────────
// This is what the actual Discord client uses — works for any guild member,
// no MANAGE_GUILD needed. Subscribes to a channel's member list and pages
// through all members in ranges of 100.

async function scrapeViaOp14(guildId) {
  const ws = state.ws;
  if (!ws || ws.readyState !== WS_OPEN) throw new Error('gateway not connected');

  // need a visible text channel to subscribe to
  const channels = await request(state.token, 'GET', `/guilds/${guildId}/channels`);
  if (!channels || !Array.isArray(channels)) throw new Error('could not fetch channels');

  const textChannel = channels.find(ch => ch.type === 0);
  if (!textChannel) throw new Error('no visible text channels found');
  const channelId = textChannel.id;

  return new Promise((resolve, reject) => {
    const members  = new Map(); // userId → member object
    let totalCount = null;
    let settled    = false;
    let rangesLeft = 0;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      delete state.memberListHandlers[guildId];
      if (members.size > 0) resolve([...members.values()]);
      else reject(new Error('op14 timed out'));
    }, 30000);

    function done() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      delete state.memberListHandlers[guildId];
      resolve([...members.values()]);
    }

    function absorb(items) {
      for (const item of (items || [])) {
        if (item.member?.user?.id) members.set(item.member.user.id, item.member);
      }
    }

    function sendRange(start, end) {
      ws.send(JSON.stringify({
        op: 14,
        d: {
          guild_id: guildId,
          typing:     true,
          threads:    false,
          activities: false,
          channels: { [channelId]: [[start, end]] },
        },
      }));
    }

    state.memberListHandlers[guildId] = (d) => {
      for (const op of (d.ops || [])) {
        if (op.op === 'SYNC') {
          absorb(op.items);
          rangesLeft = Math.max(0, rangesLeft - 1);
        }
        if (op.op === 'INSERT' || op.op === 'UPDATE') {
          absorb([op.item]);
        }
      }

      // first response gives us the group counts → total members
      if (totalCount === null && d.groups) {
        totalCount = d.groups.reduce((s, g) => s + (g.count || 0), 0);
        // schedule remaining range requests in batches
        const delay = (ms) => new Promise(r => setTimeout(r, ms));
        (async () => {
          for (let i = 100; i < totalCount; i += 100) {
            await delay(300);
            if (settled) break;
            sendRange(i, i + 99);
            rangesLeft++;
          }
        })();
      }

      // finished when we have everyone
      if (totalCount !== null && members.size >= totalCount) done();
      // also finish when all ranges came back and we have no more pending
      if (totalCount !== null && rangesLeft === 0 && members.size > 0) {
        setTimeout(() => { if (!settled) done(); }, 600);
      }
    };

    // kick off with the first range
    rangesLeft++;
    sendRange(0, 99);
  });
}

// ── op 8: REQUEST_GUILD_MEMBERS (fallback) ────────────────────────────────────
function fetchViaOp8(guildId) {
  return new Promise((resolve, reject) => {
    const ws = state.ws;
    if (!ws || ws.readyState !== WS_OPEN) return reject(new Error('gateway not connected'));

    const nonce   = `${guildId}-${Date.now()}`;
    let settled   = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      delete state.memberRequests[nonce];
      reject(new Error('op8 timed out'));
    }, 15000);

    state.memberRequests[nonce] = {
      guildId,
      members: [],
      resolve(members) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(members);
      },
      reject(e) {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(e);
      },
    };

    ws.send(JSON.stringify({
      op: 8,
      d: { guild_id: guildId, query: '', limit: 0, nonce },
    }));
  });
}

// ── REST fallback (requires MANAGE_GUILD) ────────────────────────────────────
async function fetchViaRest(token, guildId) {
  const members = [];
  let after = null;
  while (true) {
    let path = `/guilds/${guildId}/members?limit=1000`;
    if (after) path += `&after=${after}`;
    const batch = await request(token, 'GET', path);
    if (!batch) break;
    if (!Array.isArray(batch)) return { members: [], error: batch };
    if (batch.length === 0) break;
    members.push(...batch);
    if (batch.length < 1000) break;
    after = batch[batch.length - 1].user.id;
    await new Promise(r => setTimeout(r, 400));
  }
  return { members, error: null };
}

// ── public API ────────────────────────────────────────────────────────────────
async function fetchAllMembers(token, guildId) {
  // 1. try op 14 (works without any permissions — used by real Discord client)
  try {
    const members = await scrapeViaOp14(guildId);
    if (members.length > 0) return { members, error: null };
  } catch (_) {}

  // 2. try op 8 (sometimes works for user tokens)
  try {
    const members = await fetchViaOp8(guildId);
    if (members.length > 0) return { members, error: null };
  } catch (_) {}

  // 3. last resort: REST (requires MANAGE_GUILD)
  return fetchViaRest(token, guildId);
}

module.exports = { fetchAllMembers };
