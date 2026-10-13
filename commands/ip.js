'use strict';
const { card, discordCard } = require('../utils/banner');

async function ipApi(ip) {
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,query,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting`
    );
    return await res.json();
  } catch (_) { return null; }
}

async function ipWho(ip) {
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    return await res.json();
  } catch (_) { return null; }
}

async function rdnsLookup(ip) {
  try {
    const rev = ip.split('.').reverse().join('.') + '.in-addr.arpa';
    const res = await fetch(`https://dns.google/resolve?name=${rev}&type=PTR`);
    const data = await res.json();
    return data.Answer?.[0]?.data?.replace(/\.$/, '') || null;
  } catch (_) { return null; }
}

module.exports = async function ipInfo(args, { edit, isTerminal }) {
  const target = (args[0] || '').trim();
  if (!target) {
    const f = [['usage', '.ip <address>']];
    return edit(isTerminal ? card('IP OSINT', f) : discordCard('IP OSINT', f));
  }

  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(target);
  const ipv6  = target.includes(':');
  if (!ipv4 && !ipv6) {
    const f = [['error', 'invalid IP address']];
    return edit(isTerminal ? card('IP OSINT', f) : discordCard('IP OSINT', f));
  }

  const [primary, secondary, rdns] = await Promise.all([
    ipApi(target),
    ipWho(target),
    ipv4 ? rdnsLookup(target) : Promise.resolve(null),
  ]);

  if (!primary && !secondary) {
    const f = [['error', 'all lookups failed'], ['ip', target]];
    return edit(isTerminal ? card('IP OSINT', f) : discordCard('IP OSINT', f));
  }

  const p  = primary  || {};
  const s  = secondary || {};
  const conn = s.connection || {};

  const country   = p.country   || s.country  || 'unknown';
  const cc        = p.countryCode || s.country_code || '';
  const region    = p.regionName || s.region   || 'unknown';
  const city      = p.city      || s.city      || 'unknown';
  const zip       = p.zip       || s.postal    || 'N/A';
  const lat       = p.lat       ?? s.latitude  ?? null;
  const lon       = p.lon       ?? s.longitude ?? null;
  const tz        = p.timezone  || s.timezone?.id || 'unknown';
  const isp       = p.isp       || conn.isp    || s.org || 'unknown';
  const org       = p.org       || conn.org    || 'unknown';
  const asn       = p.as        || (conn.asn ? `AS${conn.asn}` : null) || 'unknown';
  const asnName   = p.asname    || conn.org    || 'unknown';
  const reverse   = rdns || p.reverse || 'none';
  const isProxy   = p.proxy     ?? false;
  const isHosting = p.hosting   ?? (s.type === 'datacenter') ?? false;
  const isMobile  = p.mobile    ?? false;
  const flag      = s.flag?.emoji || '';

  // threat classification
  let threat = [];
  if (isProxy)   threat.push('proxy/VPN');
  if (isHosting) threat.push('datacenter/hosting');
  if (isMobile)  threat.push('mobile');
  if (!threat.length) threat.push('residential');

  const fields = [
    ['ip',         target],
    ['type',       ipv6 ? 'IPv6' : 'IPv4'],
    ['country',    `${flag} ${country} (${cc})`],
    ['region',     region],
    ['city',       city],
    ['postal',     zip],
    ['coords',     lat !== null ? `${lat}, ${lon}` : 'unknown'],
    ['timezone',   tz],
    ['isp',        isp],
    ['org',        org],
    ['asn',        asn],
    ['asn name',   asnName],
    ['reverse dns',reverse],
    ['threat',     threat.join(', ')],
    ['proxy/vpn',  isProxy   ? 'YES' : 'no'],
    ['hosting',    isHosting ? 'YES' : 'no'],
    ['mobile',     isMobile  ? 'yes' : 'no'],
    ['currency',   s.currency?.symbol ? `${s.currency.name} (${s.currency.symbol})` : 'N/A'],
    ['calling',    s.calling_code || 'N/A'],
  ];

  return edit(isTerminal ? card('IP OSINT', fields) : discordCard('IP OSINT', fields));
};
