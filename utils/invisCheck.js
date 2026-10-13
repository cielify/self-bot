'use strict';
const { request } = require('./request');
const state       = require('../core/state');

// CVE-2026-24332 — Discord information disclosure
// Invisible users have an active session but appear "offline" via PRESENCE_UPDATE.
// The distinction can be inferred by comparing:
//   1. Their reported presence status (offline vs other)
//   2. Profile endpoint richness (invisible users still have active sessions)
//   3. Activity data in the presence cache
//   4. Recency of last PRESENCE_UPDATE (invisible → offline fires very recently)

async function checkInvisible(userId) {
  const cached          = state.presenceCache[userId];
  const knownStatus     = cached?.status || 'unknown';
  const timeSinceUpdate = cached ? Math.round((Date.now() - cached.since) / 1000) : null;
  const hasActivities   = cached?.activities?.length > 0;

  // fetch profile — invisible users still have active sessions so profile is richer
  const profile = await request(
    state.token, 'GET',
    `/users/${userId}/profile?with_mutual_guilds=true&with_mutual_friends_count=true`
  );

  const connectedAccounts = profile?.connected_accounts?.length ?? 0;
  const hasBio            = !!(profile?.user_profile?.bio);
  const hasPronounced     = !!(profile?.user_profile?.pronouns);
  const profileLoaded     = !!(profile && !profile.code);

  let score = 0;
  const signals = [];

  if (knownStatus === 'offline' && timeSinceUpdate !== null && timeSinceUpdate < 120) {
    score += 2;
    signals.push(`offline ${timeSinceUpdate}s ago`);
  }
  if (hasActivities) {
    score += 3;
    signals.push('active activities while offline');
  }
  if (profileLoaded)       { score += 1; signals.push('profile accessible'); }
  if (connectedAccounts > 0) { score += 2; signals.push(`${connectedAccounts} connected accounts`); }
  if (hasBio)              { score += 1; signals.push('bio visible'); }
  if (hasPronounced)       { score += 1; signals.push('pronouns visible'); }

  if (score >= 5) return { verdict: 'INVISIBLE',          confidence: 'high',   score, signals };
  if (score >= 2) return { verdict: 'possibly invisible', confidence: 'medium', score, signals };
  return               { verdict: 'offline',              confidence: 'low',    score, signals };
}

module.exports = { checkInvisible };
