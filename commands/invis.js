'use strict';
const { card, termCard }   = require('../utils/format');
const { request }          = require('../utils/request');
const state                = require('../core/state');

// CVE-2026-24332 — Discord information disclosure
// Invisible users have an active session but appear "offline" via PRESENCE_UPDATE.
// The distinction can be inferred by comparing:
//   1. Their reported presence status (offline vs other)
//   2. Profile endpoint richness (invisible users still have active sessions)
//   3. Activity data in the presence cache
//   4. Recency of last PRESENCE_UPDATE (invisible → offline fires very recently)

const STATUS_EMOJI = {
  online:    'online',
  idle:      'idle',
  dnd:       'do not disturb',
  offline:   'offline',
};

module.exports = async function invis(args, { token, edit, isTerminal }) {
  const input = args[0];
  if (!input) {
    const f = [['usage', '.invis <user id>']];
    return edit(isTerminal ? termCard('INVISIBLE CHECK', f) : card('INVISIBLE CHECK', f));
  }

  const userId = input.replace(/[<@!>]/g, '').trim();
  if (!/^\d{15,20}$/.test(userId)) {
    const f = [['error', 'invalid user ID']];
    return edit(isTerminal ? termCard('INVISIBLE CHECK', f) : card('INVISIBLE CHECK', f));
  }

  // ── step 1: check our local presence cache ────────────────────────────────
  const cached = state.presenceCache[userId];
  const knownStatus = cached?.status || 'unknown';
  const timeSinceUpdate = cached ? Math.round((Date.now() - cached.since) / 1000) : null;
  const hasActivities = cached?.activities?.length > 0;

  // if they're visibly online/idle/dnd, no need to check further
  if (knownStatus !== 'offline' && knownStatus !== 'unknown') {
    const f = [
      ['user id',    userId],
      ['status',     STATUS_EMOJI[knownStatus] || knownStatus],
      ['invisible',  'no — status is visible'],
    ];
    return edit(isTerminal ? termCard('INVISIBLE CHECK', f) : card('INVISIBLE CHECK', f));
  }

  // ── step 2: fetch profile (CVE-2026-24332) ────────────────────────────────
  // Invisible users still have an active session, so the profile endpoint
  // returns richer data (connected accounts, pronouns, bio) than truly offline users.
  const profile = await request(token, 'GET', `/users/${userId}/profile?with_mutual_guilds=true&with_mutual_friends_count=true`);

  const connectedAccounts = profile?.connected_accounts?.length ?? 0;
  const hasBio            = !!(profile?.user_profile?.bio);
  const hasPronounced     = !!(profile?.user_profile?.pronouns);
  const profileLoaded     = !!(profile && !profile.code);

  // ── step 3: score indicators ──────────────────────────────────────────────
  let score = 0;
  const signals = [];

  // presence cache signals
  if (knownStatus === 'offline' && timeSinceUpdate !== null && timeSinceUpdate < 120) {
    score += 2;
    signals.push(`went offline ${timeSinceUpdate}s ago (recent transition)`);
  }
  if (hasActivities) {
    score += 3;
    signals.push(`active activities detected while "offline"`);
  }

  // profile richness signals (invisible = active session = richer profile)
  if (profileLoaded) {
    score += 1;
    signals.push('profile endpoint accessible');
  }
  if (connectedAccounts > 0) {
    score += 2;
    signals.push(`${connectedAccounts} connected account${connectedAccounts > 1 ? 's' : ''} visible`);
  }
  if (hasBio) {
    score += 1;
    signals.push('bio accessible');
  }
  if (hasPronounced) {
    score += 1;
    signals.push('pronouns accessible');
  }

  // ── step 4: verdict ───────────────────────────────────────────────────────
  let verdict, confidence;
  if (score >= 5) {
    verdict    = 'likely INVISIBLE';
    confidence = 'high';
  } else if (score >= 2) {
    verdict    = 'possibly invisible';
    confidence = 'medium';
  } else {
    verdict    = 'likely offline';
    confidence = 'low';
  }

  const f = [
    ['user id',      userId],
    ['known status', knownStatus],
    ['verdict',      verdict],
    ['confidence',   confidence],
    ['score',        `${score}/10`],
    ['signals',      signals.length > 0 ? signals.join(', ') : 'none'],
    ['cve',          'CVE-2026-24332'],
  ];

  return edit(isTerminal ? termCard('INVISIBLE CHECK', f) : card('INVISIBLE CHECK', f));
};
