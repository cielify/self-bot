'use strict';
const { exec }       = require('child_process');
const { C }          = require('../utils/banner');
const { card, termCard } = require('../utils/format');

module.exports = async function ipping(args, { edit, isTerminal }) {
  const ip = args[0];
  if (!ip) {
    const f = [['usage', '.ip-ping <ip address>']];
    return edit(isTerminal ? termCard('IP PING', f) : card('IP PING', f));
  }

  if (isTerminal) {
    process.stdout.write(`\n  ${C.bred}◈  IP PING${C.reset}  ${C.grey}pinging ${ip}...${C.reset}\n`);
  }

  const { stdout } = await new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? `ping -n 4 "${ip}"` : `ping -c 4 -W 2 "${ip}"`;
    exec(cmd, { timeout: 15000 }, (e, out) => resolve({ stdout: out || '', err: e }));
  });

  if (!stdout || (!stdout.includes('bytes from') && !stdout.includes('time='))) {
    const f = [['target', ip], ['status', 'host unreachable or no response']];
    return edit(isTerminal ? termCard('IP PING', f) : card('IP PING', f));
  }

  const pktLines = stdout.split('\n').filter(l => l.includes('bytes from') || l.includes('time='));
  const pktFields = pktLines.slice(0, 4).map((l, i) => {
    const timeM = l.match(/time[=<]([\d.]+)\s*ms/);
    const ttlM  = l.match(/ttl[=]([\d]+)/i);
    const val = [timeM ? `${timeM[1]} ms` : '?', ttlM ? `ttl=${ttlM[1]}` : ''].filter(Boolean).join('  ');
    return [`pkt ${i + 1}`, val];
  });

  const lossM = stdout.match(/(\d+)%\s*packet loss/);
  const sentM = stdout.match(/(\d+)\s+packets?\s+transmitted[,\s]+(\d+)\s+(?:packets?\s+)?received/);
  const rttM  = stdout.match(/min\/avg\/max[^\d]*([\d.]+)\/([\d.]+)\/([\d.]+)/);

  const fields = [
    ['target',   ip],
    ...pktFields,
    sentM  ? ['packets', `${sentM[1]} sent / ${sentM[2]} received`] : ['packets', '?'],
    lossM  ? ['loss',    `${lossM[1]}%`] : null,
    rttM   ? ['rtt avg', `${rttM[2]} ms (min ${rttM[1]} / max ${rttM[3]})`] : null,
  ].filter(Boolean);

  return edit(isTerminal ? termCard('IP PING', fields) : card('IP PING', fields));
};
