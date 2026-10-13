'use strict';
const { C, clearScreen, typeText }      = require('../utils/banner');
const { pauseCLI, resumeCLI }           = require('../utils/cliControl');
const { setAtPrompt }                   = require('../utils/output');
const { readSecret, readLine, readYN }  = require('../utils/rawInput');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function line(s = '') { process.stdout.write(s + '\n'); }
function ok(s)  { line(`  ${C.red}\u2714${R}  ${C.silver}${s}${R}`); }
function bad(s) { line(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }
function inf(s) { line(`  ${C.grey}◆${R}  ${C.silver}${s}${R}`); }

function maskToken(t) {
  if (t.length <= 15) return '*'.repeat(t.length);
  return t.slice(0, 8) + '...' + t.slice(-4);
}

function extractCode(input) {
  const m = input.trim().match(/(?:discord\.gg\/|discord\.com\/invite\/)([A-Za-z0-9-]+)/);
  return m ? m[1] : input.trim().replace(/[^A-Za-z0-9-]/g, '') || null;
}

module.exports = async function dtjoiner(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);

  clearScreen();
  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('◈  TOKEN JOINER');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  line(`  ${C.grey}CTRL+A add more  \u2502  CTRL+N next page  \u2502  CTRL+C quit${R}`);
  process.stdout.write(SEP + '\n\n');

  const tokens = [];

  while (true) {
    const { value, ctrl } = await readSecret(`  ${C.silver}token ${String(tokens.length + 1).padStart(2, '0')}: ${R}`);

    if (value.trim()) tokens.push(value.trim());

    if (ctrl === 'N') break;

    if (ctrl === 'A') {
      if (value.trim()) inf(`token ${tokens.length} added — enter next or CTRL+N to continue`);
      else              inf('enter a token, or CTRL+N to continue');
      continue;
    }

    if (!value.trim() && tokens.length > 0) break;

    if (value.trim()) {
      inf(`token ${tokens.length} added — CTRL+A for more  CTRL+N for next page`);
    }
  }

  if (tokens.length === 0) {
    process.stdout.write('\n');
    bad('no tokens entered');
    process.stdout.write('\n');
    resumeCLI();
    return;
  }

  process.stdout.write('\n' + SEP + '\n');
  line(`  ${C.silver}tokens loaded:  ${C.white}${tokens.length}${R}`);
  process.stdout.write(SEP + '\n\n');

  const { value: inviteInput } = await readLine(`  ${C.silver}invite link: ${R}`);
  const code = extractCode(inviteInput);

  if (!code) {
    process.stdout.write('\n');
    bad('invalid invite link or code');
    process.stdout.write('\n');
    resumeCLI();
    return;
  }

  process.stdout.write('\n');
  line(`  ${C.silver}invite code:    ${C.white}${code}${R}`);
  line(`  ${C.silver}tokens:         ${C.white}${tokens.length}${R}`);
  process.stdout.write('\n');

  const go = await readYN(`  ${C.silver}start? ${C.grey}[Y/N]: ${R}`);
  if (!go) { process.stdout.write('\n'); resumeCLI(); return; }

  process.stdout.write('\n' + SEP + '\n');

  let joined = 0, failed = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok     = tokens[i];
    const preview = maskToken(tok);
    process.stdout.write(`  ${C.grey}[${i + 1}/${tokens.length}]${R} ${C.grey}${preview}${R}  `);

    try {
      const res = await fetch(`https://discord.com/api/v9/invites/${code}`, {
        method:  'POST',
        headers: {
          Authorization:          tok,
          'Content-Type':         'application/json',
          'User-Agent':           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'X-Context-Properties': Buffer.from(JSON.stringify({
            location: 'Join Guild', location_guild_id: null, location_channel_id: null,
          })).toString('base64'),
        },
        body: JSON.stringify({ session_id: null }),
      });

      const data = await res.json();

      if (data.guild) {
        process.stdout.write(`${C.red}\u2714${R}  ${C.white}joined ${data.guild.name}${R}\n`);
        joined++;
      } else {
        const reason =
          data.code === 40007 ? 'banned from server' :
          data.code === 401   ? 'invalid token' :
          data.code === 50013 ? 'missing permissions' :
          data.code === 40002 ? 'verify phone required' :
          data.message        ? data.message :
          `code ${data.code || '?'}`;
        process.stdout.write(`${C.bred}\u2718${R}  ${C.grey}${reason}${R}\n`);
        failed++;
      }
    } catch (e) {
      process.stdout.write(`${C.bred}\u2718${R}  ${C.grey}error: ${e.message}${R}\n`);
      failed++;
    }

    if (i < tokens.length - 1) await new Promise(r => setTimeout(r, 900));
  }

  process.stdout.write(SEP + '\n');
  line(`  ${C.silver}joined  ${C.white}${joined}${R}  ${C.grey}failed  ${C.white}${failed}${R}`);
  process.stdout.write(SEP + '\n\n');

  resumeCLI();
};
