'use strict';
const { card, termCard } = require('../utils/format');

function genIP() {
  const a = Math.floor(Math.random() * 223) + 1;
  const b = Math.floor(Math.random() * 256);
  const c = Math.floor(Math.random() * 256);
  const d = Math.floor(Math.random() * 254) + 1;
  return [a, b, c, d].join('.');
}

function isPublic(ip) {
  const [a, b] = ip.split('.').map(Number);
  if (a === 10) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 127 || a === 0 || a === 169) return false;
  return true;
}

function makeIP() {
  let ip;
  let tries = 0;
  do { ip = genIP(); tries++; } while (!isPublic(ip) && tries < 50);
  return ip;
}

module.exports = async function ipgen(args, { edit, isTerminal }) {
  const count  = Math.min(Math.max(parseInt(args[0]) || 10, 1), 20);
  const ips    = Array.from({ length: count }, makeIP);
  const fields = ips.map((ip, i) => [`ip ${String(i + 1).padStart(2, '0')}`, ip]);

  return edit(isTerminal ? termCard('IP GENERATOR', fields) : card('IP GENERATOR', fields));
};
