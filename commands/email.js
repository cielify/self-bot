'use strict';
const { card, discordCard } = require('../utils/banner');

const MAIL_PROVIDERS = {
  google: 'Gmail', googlemail: 'Gmail',
  outlook: 'Outlook', hotmail: 'Outlook', live: 'Outlook',
  microsoft: 'Outlook', office365: 'Outlook',
  yahoo: 'Yahoo', ymail: 'Yahoo',
  protonmail: 'ProtonMail', proton: 'ProtonMail',
  icloud: 'iCloud', me: 'iCloud', mac: 'iCloud',
  zoho: 'Zoho', fastmail: 'Fastmail',
  tutanota: 'Tutanota', tuta: 'Tutanota',
  gmx: 'GMX', web: 'Web.de', aol: 'AOL',
};

function identifyProvider(mxRecords = []) {
  const all = mxRecords.join(' ').toLowerCase();
  for (const [key, name] of Object.entries(MAIL_PROVIDERS)) {
    if (all.includes(key)) return name;
  }
  return null;
}

async function dnsLookup(name, type) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
    const data = await res.json();
    return data.Answer || [];
  } catch (_) { return []; }
}

async function checkDisposable(email) {
  try {
    const res = await fetch(`https://disify.com/api/email/${encodeURIComponent(email)}`);
    return await res.json();
  } catch (_) { return null; }
}

module.exports = async function email(args, { edit, isTerminal }) {
  const target = (args[0] || '').trim();
  if (!target || !target.includes('@')) {
    const f = [['usage', '.email <address>']];
    return edit(isTerminal ? card('EMAIL OSINT', f) : discordCard('EMAIL OSINT', f));
  }

  const [user, domain] = target.split('@');
  if (!domain) {
    const f = [['error', 'invalid email format']];
    return edit(isTerminal ? card('EMAIL OSINT', f) : discordCard('EMAIL OSINT', f));
  }

  // run all lookups in parallel
  const [evaRes, disifyData, mxRecords, txtRecords, aRecords] = await Promise.all([
    fetch(`https://api.eva.pingutil.com/email?email=${encodeURIComponent(target)}`, {
      headers: { 'User-Agent': 'z-tool/1.0' },
    }).then(r => r.json()).catch(() => null),
    checkDisposable(target),
    dnsLookup(domain, 'MX'),
    dnsLookup(domain, 'TXT'),
    dnsLookup(domain, 'A'),
  ]);

  const eva = evaRes?.data || {};

  // parse MX exchange names
  const mxHosts = mxRecords
    .map(r => r.data?.split(' ').pop()?.replace(/\.$/, '') || '')
    .filter(Boolean);

  // parse SPF from TXT
  const spf = txtRecords.find(r => r.data?.includes('v=spf1'))?.data || null;

  // detect DMARC
  const [dmarcRecord] = await dnsLookup(`_dmarc.${domain}`, 'TXT');
  const dmarc = dmarcRecord?.data?.includes('v=DMARC1') ? 'yes' : 'no';

  const provider  = identifyProvider(mxHosts);
  const hasA      = aRecords.length > 0;
  const domainIp  = aRecords[0]?.data || null;

  // disposable check — use disify if eva disagrees
  const isDisposable = disifyData?.disposable ?? (eva.disposable || false);
  const dnsValid     = disifyData?.dns ?? hasA;

  const fields = [
    ['email',       target],
    ['username',    user],
    ['domain',      domain],
    ['provider',    provider || 'unknown'],
    ['domain ip',   domainIp || 'none'],
    ['valid syntax',eva.valid_syntax   ? 'yes' : 'no'],
    ['deliverable', eva.deliverable    ? 'yes' : 'no'],
    ['dns valid',   dnsValid           ? 'yes' : 'no'],
    ['disposable',  isDisposable       ? 'YES' : 'no'],
    ['webmail',     eva.webmail        ? 'yes' : 'no'],
    ['catch-all',   eva.catch_all      ? 'yes' : 'no'],
    ['spam flagged',eva.spam           ? 'YES' : 'no'],
    ['gibberish',   eva.gibberish      ? 'yes' : 'no'],
    ['mx records',  mxHosts.length ? mxHosts.slice(0,2).join(', ') : 'none'],
    ['spf',         spf ? spf.slice(0, 60) : 'none'],
    ['dmarc',       dmarc],
  ];

  return edit(isTerminal ? card('EMAIL OSINT', fields) : discordCard('EMAIL OSINT', fields));
};
