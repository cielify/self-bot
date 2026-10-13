'use strict';
const readline  = require('readline');
const { request } = require('../utils/request');
const { C }       = require('../utils/banner');

const W   = C.white;
const GR  = C.grey;
const RED = C.bred;
const DIM = C.darkRed;
const SLV = C.silver;
const BLD = C.bold;
const R   = C.reset;

const SEP  = `${DIM}${'─'.repeat(48)}${R}`;
const head = (n, t) => `\n${DIM}[${ n }]${R} ${BLD}${W}${t}${R}\n${SEP}`;

function write(s) { process.stdout.write(s); }
function line(s = '') { write(s + '\n'); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function readLine(prompt, opts = {}) {
  return new Promise((resolve) => {
    const { secret = false, hint = '' } = opts;

    write(prompt);
    if (hint) write(`${GR}${hint}${R}\n${prompt.replace(/\S/g, ' ')}`);

    let buf = '';

    function onData(chunk) {
      for (const byte of chunk) {
        const ch = String.fromCharCode(byte);

        if (byte === 1) {
          cleanup();
          write('\n');
          return resolve({ value: buf, ctrl: 'A' });
        }
        if (byte === 2) {
          cleanup();
          write('\n');
          return resolve({ value: buf, ctrl: 'B' });
        }
        if (byte === 20) {
          cleanup();
          write('\n');
          return resolve({ value: buf, ctrl: 'T' });
        }
        if (byte === 3) {
          cleanup();
          write('\n');
          process.exit(0);
        }
        if (byte === 13 || byte === 10) {
          cleanup();
          write('\n');
          return resolve({ value: buf, ctrl: null });
        }
        if (byte === 127 || byte === 8) {
          if (buf.length > 0) {
            buf = buf.slice(0, -1);
            if (!secret) write('\b \b');
          }
          continue;
        }
        if (byte >= 32) {
          buf += ch;
          if (!secret) write(ch);
          else write('*');
        }
      }
    }

    function cleanup() {
      process.stdin.removeListener('data', onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
    }

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

function isValidId(id) { return /^\d{15,22}$/.test(id.trim()); }

async function renameGC(token, channelId, name) {
  const res = await request(token, 'PATCH', `/channels/${channelId}`, { name });
  if (res && res.id) return { ok: true };
  const msg = res?.message || 'unknown error';
  return { ok: false, msg };
}

async function sendMessage(token, channelId, content) {
  const res = await request(token, 'POST', `/channels/${channelId}/messages`, { content });
  if (res && res.id) return { ok: true };
  const msg = res?.message || 'unknown error';
  return { ok: false, msg };
}

async function stepGcId() {
  line(head(1, 'GC ID'));
  line(`  ${GR}Enter the group chat channel ID.${R}`);

  while (true) {
    const r = await readLine(`  ${SLV}GC ID: ${R}`);
    if (r.ctrl === 'T') return { ctrl: 'T' };
    if (r.ctrl === 'B') continue;
    if (!r.value.trim()) { line(`  ${RED}ID cannot be empty.${R}`); continue; }
    if (!isValidId(r.value)) { line(`  ${RED}Not a valid channel ID (must be 15-22 digits).${R}`); continue; }
    return { value: r.value.trim() };
  }
}

async function stepNames() {
  line(head(2, 'GC Names'));
  line(`  ${GR}Enter names to cycle through.${R}`);
  line(`  ${GR}CTRL+A to add more  |  CTRL+B to go back  |  CTRL+T to exit${R}`);

  const names = [];
  let i = 1;

  while (true) {
    const r = await readLine(`  ${SLV}Enter gc name ${i}: ${R}`);

    if (r.ctrl === 'T') return { ctrl: 'T' };
    if (r.ctrl === 'B') return { ctrl: 'B' };

    if (r.ctrl === 'A') {
      if (r.value.trim()) { names.push(r.value.trim()); i++; }
      line(`  ${GR}(add mode — keep entering names, press Enter on each)${R}`);
      continue;
    }

    if (!r.value.trim()) {
      if (names.length === 0) { line(`  ${RED}Enter at least one name.${R}`); continue; }
      break;
    }

    names.push(r.value.trim());
    i++;
    line(`  ${GR}  ✔ added. Enter another or press Enter to continue.${R}`);
  }

  return { value: names };
}

async function stepMessage() {
  line(head(3, 'Message'));
  line(`  ${GR}This message is sent after each rename.${R}`);
  line(`  ${GR}CTRL+B to go back  |  CTRL+T to exit${R}`);

  while (true) {
    const r = await readLine(`  ${SLV}Message: ${R}`);
    if (r.ctrl === 'T') return { ctrl: 'T' };
    if (r.ctrl === 'B') return { ctrl: 'B' };
    if (!r.value.trim()) { line(`  ${RED}Message cannot be empty.${R}`); continue; }
    return { value: r.value.trim() };
  }
}

async function stepCount() {
  line(head(4, 'Count'));
  line(`  ${GR}How many total cycles? (10–50)${R}`);
  line(`  ${GR}CTRL+B to go back  |  CTRL+T to exit${R}`);

  while (true) {
    const r = await readLine(`  ${SLV}How many: ${R}`);
    if (r.ctrl === 'T') return { ctrl: 'T' };
    if (r.ctrl === 'B') return { ctrl: 'B' };
    const n = parseInt(r.value);
    if (isNaN(n) || n < 10 || n > 50) {
      line(`  ${RED}Enter a number between 10 and 50.${R}`);
      continue;
    }
    return { value: n };
  }
}

async function stepConfirm(config) {
  line(head(5, 'Confirm & Start'));
  line(`  ${SLV}GC ID   :${R}  ${W}${config.gcId}${R}`);
  line(`  ${SLV}Names   :${R}  ${W}${config.names.join('  →  ')}${R}`);
  line(`  ${SLV}Message :${R}  ${W}${config.message}${R}`);
  line(`  ${SLV}Count   :${R}  ${W}${config.count}${R}`);
  line(SEP);
  line(`  ${GR}Press Enter to START  |  CTRL+B to go back  |  CTRL+T to exit${R}`);

  const r = await readLine(`  ${SLV}Start? ${R}`);
  if (r.ctrl === 'T') return { ctrl: 'T' };
  if (r.ctrl === 'B') return { ctrl: 'B' };
  return { value: true };
}

async function runLoop(token, config) {
  const { gcId, names, message, count } = config;
  let done  = 0;
  let nameI = 0;
  let errors = 0;

  write('\n');
  line(SEP);
  line(`  ${BLD}${RED}▶ RUNNING${R}  total: ${W}${count}${R}  names: ${W}${names.length}${R}`);
  line(SEP);

  while (done < count) {
    const name = names[nameI % names.length];
    nameI++;

    write(`  ${GR}[${done + 1}/${count}]${R} renaming → ${W}${name}${R} ... `);
    const renameRes = await renameGC(token, gcId, name);

    if (!renameRes.ok) {
      write(`${RED}✘ rename failed: ${renameRes.msg}${R}\n`);
      errors++;
      if (errors >= 5) {
        line(`\n  ${RED}✘ too many errors (${errors}) — aborting.${R}`);
        break;
      }
      await sleep(2000);
      continue;
    }
    write(`${RED}✔${R}\n`);

    write(`  ${GR}[${done + 1}/${count}]${R} sending message ... `);
    const msgRes = await sendMessage(token, gcId, message);

    if (!msgRes.ok) {
      write(`${RED}✘ message failed: ${msgRes.msg}${R}\n`);
      errors++;
    } else {
      write(`${RED}✔${R}\n`);
      errors = 0;
    }

    done++;

    if (done < count) await sleep(1200);
  }

  line(SEP);
  if (done >= count) {
    line(`  ${RED}✔ Done!${R}  completed ${W}${done}${R} cycles.`);
  }
  line(SEP);
  write('\n');
}

module.exports = async function gcconf(args, ctx) {
  if (!ctx.isTerminal) return;

  const { pauseCLI } = require('../utils/cliControl');
  const { setAtPrompt } = require('../utils/output');
  pauseCLI();
  setAtPrompt(false);

  const token = ctx.token;

  write('\n');
  line(`${SEP}`);
  line(`  ${BLD}${RED}GC CONF${R}  ${GR}rename + message loop${R}`);
  line(`${SEP}`);
  line(`  ${GR}Keys: CTRL+A add name  |  CTRL+B go back  |  CTRL+T exit to terminal${R}`);
  line(`${SEP}`);

  const config = { gcId: null, names: [], message: '', count: 0 };
  let step = 1;

  while (true) {
    if (step === 1) {
      const r = await stepGcId();
      if (r.ctrl === 'T') break;
      config.gcId = r.value;
      step = 2;
    }

    else if (step === 2) {
      const r = await stepNames();
      if (r.ctrl === 'T') break;
      if (r.ctrl === 'B') { step = 1; continue; }
      config.names = r.value;
      step = 3;
    }

    else if (step === 3) {
      const r = await stepMessage();
      if (r.ctrl === 'T') break;
      if (r.ctrl === 'B') { step = 2; continue; }
      config.message = r.value;
      step = 4;
    }

    else if (step === 4) {
      const r = await stepCount();
      if (r.ctrl === 'T') break;
      if (r.ctrl === 'B') { step = 3; continue; }
      config.count = r.value;
      step = 5;
    }

    else if (step === 5) {
      const r = await stepConfirm(config);
      if (r.ctrl === 'T') break;
      if (r.ctrl === 'B') { step = 4; continue; }

      await runLoop(token, config);

      line(`  ${GR}Run again with same config? Enter=yes  CTRL+B=reconfig  CTRL+T=exit${R}`);
      const again = await readLine(`  ${SLV}Again? ${R}`);
      if (again.ctrl === 'T') break;
      if (again.ctrl === 'B') { step = 1; continue; }
      continue;
    }
  }

  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  require('../utils/cliControl').resumeCLI();
  write(`\n  ${GR}← back to terminal${R}\n\n`);
};
