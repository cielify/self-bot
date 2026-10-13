'use strict';

let _atPrompt = false;
const PROMPT  = '» ';

function setAtPrompt(v) { _atPrompt = v; }

function print(msg) {
  if (_atPrompt) {
    process.stdout.write('\r\x1b[2K');
    process.stdout.write(msg);
    if (!msg.endsWith('\n')) process.stdout.write('\n');
    process.stdout.write(PROMPT);
  } else {
    process.stdout.write(msg);
    if (!msg.endsWith('\n')) process.stdout.write('\n');
  }
}

function raw(msg) { process.stdout.write(msg); }

module.exports = { setAtPrompt, print, raw, PROMPT };
