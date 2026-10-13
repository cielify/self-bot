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

function encrypt(key, text) {
  const k  = crypto.createHash('sha256').update(String(key)).digest();
  const iv = crypto.randomBytes(16);
  const ci = crypto.createCipheriv('aes-256-cbc', k, iv);
  const en = Buffer.concat([ci.update(text, 'utf8'), ci.final()]);
  return `${iv.toString('hex')}:${en.toString('hex')}`;
}

module.exports = async function pencrypt(args, { edit, isTerminal }) {
  // Discord: can't hide input — refuse for security
  if (!isTerminal) {
    return edit(card('ENCRYPT', [
      ['notice', 'use terminal for security — key and message must not be visible in chat'],
      ['usage',  'type .p-encrypt from the terminal'],
    ]));
  }

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('\u25c8  ENCRYPT');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}key is hidden — message is visible${R}`);
  process.stdout.write(SEP + '\n\n');

  const { value: key, ctrl: c1 } = await readSecret(`  ${C.silver}Key       ${C.darkRed}\u203a${R} `);
  if (c1 || !key.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }

  ln();

  const { value: message, ctrl: c2 } = await readLine(`  ${C.silver}Message   ${C.darkRed}\u203a${R} `);
  if (c2 || !message.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }

  ln();

  let result;
  try {
    result = encrypt(key, message);
  } catch (e) {
    bad(`encryption failed: ${e.message}`); ln(); resumeCLI(); return;
  }

  process.stdout.write(SEP + '\n\n');
  ln(`  ${C.grey}method     ${R}  ${C.silver}AES-256-CBC${R}`);
  ln(`  ${C.grey}key        ${R}  ${C.silver}${'*'.repeat(Math.min(key.length, 16))}${R}`);
  ln(`  ${C.grey}message    ${R}  ${C.silver}${message}${R}`);
  ln();
  ln(`  ${C.grey}encrypted  ${R}`);
  ln(`  ${C.silver}${result}${R}`);
  ln();
  process.stdout.write(SEP + '\n\n');

  resumeCLI();
};
