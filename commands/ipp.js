'use strict';
const net            = require('net');
const { C }          = require('../utils/banner');
const { card, termCard } = require('../utils/format');

const PORTS = [
  [21,'FTP'],[22,'SSH'],[23,'Telnet'],[25,'SMTP'],
  [53,'DNS'],[80,'HTTP'],[110,'POP3'],[143,'IMAP'],
  [443,'HTTPS'],[445,'SMB'],[3306,'MySQL'],[3389,'RDP'],
  [5432,'PostgreSQL'],[6379,'Redis'],[8080,'HTTP-Alt'],
  [8443,'HTTPS-Alt'],[27017,'MongoDB'],
];

function checkPort(host, port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(2000);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.on('error',   () => resolve(false));
    sock.connect(port, host);
  });
}

module.exports = async function ipp(args, { edit, isTerminal }) {
  const ip = args[0];
  if (!ip) {
    const f = [['usage', '.ip-p <ip address>']];
    return edit(isTerminal ? termCard('PORT SCAN', f) : card('PORT SCAN', f));
  }

  if (isTerminal) {
    process.stdout.write(`\n  ${C.bred}◈  PORT SCAN${C.reset}  ${C.grey}scanning ${ip}...${C.reset}\n`);
  }

  const results = await Promise.all(
    PORTS.map(async ([port, name]) => ({ port, name, open: await checkPort(ip, port) }))
  );

  const open = results.filter(r => r.open);
  const fields = [
    ['target',  ip],
    ['scanned', `${PORTS.length} common ports`],
    ['open',    open.length ? `${open.length} port(s)` : 'none'],
    ...open.map(r => [String(r.port), r.name]),
  ];

  return edit(isTerminal ? termCard('PORT SCAN', fields) : card('PORT SCAN', fields));
};
