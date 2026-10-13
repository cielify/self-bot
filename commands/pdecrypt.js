'use strict';
const crypto                        = require('crypto');
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const { readSecret, readLine }      = require('../utils/rawInput');
const { card }                      = require('../utils/format');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function ln(s = '') { process.stdout.write((s || '') + '\n'); }
function bad(s)     { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }

function decrypt(key, encrypted) {
  const parts = encrypted.split(':');
  if (parts.length < 2) throw new Error('invalid format — must be iv:data');
  const iv  = Buffer.from(parts[0], 'hex');
  const enc = Buffer.from(parts.slice(1).join(':'), 'hex');
  const k   = crypto.createHash('sha256').update(String(key)).digest();
  const dc  = crypto.createDecipheriv('aes-256-cbc', k, iv);
  return Buffer.concat([dc.update(enc), dc.final()]).toString('utf8');
}

module.exports = async function pdecrypt(args, { edit, isTerminal }) {
  if (!isTerminal) {
    return edit(card('DECRYPT', [
      ['notice', 'use terminal for security — key must not be visible in chat'],
      ['usage',  'type .p-decrypt from the terminal'],
    ]));
  }

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('\u25c8  DECRYPT');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}key is hidden — encrypted data is visible${R}`);
  process.stdout.write(SEP + '\n\n');

  // key is secret — hide it
  const { value: key, ctrl: c1 } = await readSecret(`  ${C.silver}Key         ${C.darkRed}\u203a${R} `);
  if (c1 || !key.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }

  ln();

  // encrypted data is already ciphertext — fine to show while typing
  const { value: encrypted, ctrl: c2 } = await readLine(`  ${C.silver}Encrypted   ${C.darkRed}\u203a${R} `);
  if (c2 || !encrypted.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }

  ln();

  let result;
  try {
    result = decrypt(key.trim(), encrypted.trim());
  } catch (_) {
    bad('decryption failed — wrong key or corrupted data');
    ln();
    resumeCLI();
    return;
  }

  process.stdout.write(SEP + '\n\n');
  ln(`  ${C.grey}method     ${R}  ${C.silver}AES-256-CBC${R}`);
  ln(`  ${C.grey}key        ${R}  ${C.silver}${'*'.repeat(Math.min(key.length, 16))}${R}`);
  ln();
  ln(`  ${C.grey}decrypted  ${R}`);
  ln(`  ${C.silver}${result}${R}`);
  ln();
  process.stdout.write(SEP + '\n\n');

  resumeCLI();
};
