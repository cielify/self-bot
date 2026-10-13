'use strict';
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const { readLine }                  = require('../utils/rawInput');
const { card, termCard }            = require('../utils/format');

const R   = C.reset;
const SEP = `${C.darkRed}${'─'.repeat(50)}${R}`;

function ln(s = '') { process.stdout.write(s + '\n'); }
function bad(s)     { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const STATUS_CHECK = (taken, free) => (s) => s === taken ? 'taken' : s === free ? 'free' : 'unknown';

const PLATFORMS = [
  ['GitHub',     u => [`https://github.com/${u}`,                     STATUS_CHECK(200, 404)]],
  ['Reddit',     u => [`https://www.reddit.com/user/${u}/about.json`, STATUS_CHECK(200, 404)]],
  ['X',          u => [`https://x.com/${u}`,                          STATUS_CHECK(200, 404)]],
  ['Instagram',  u => [`https://www.instagram.com/${u}/`,             STATUS_CHECK(200, 404)]],
  ['TikTok',     u => [`https://www.tiktok.com/@${u}`,                STATUS_CHECK(200, 404)]],
  ['Telegram',   u => [`https://t.me/${u}`,                           null]],
  ['YouTube',    u => [`https://www.youtube.com/@${u}`,               STATUS_CHECK(200, 404)]],
  ['Steam',      u => [`https://steamcommunity.com/id/${u}`,          null]],
  ['SoundCloud', u => [`https://soundcloud.com/${u}`,                 STATUS_CHECK(200, 404)]],
  ['Twitch',     u => [`https://www.twitch.tv/${u}`,                  STATUS_CHECK(200, 404)]],
  ['Spotify',    u => [`https://open.spotify.com/user/${u}`,          STATUS_CHECK(200, 404)]],
];

async function probe(url) {
  const ac = new AbortController();
  const t  = setTimeout(() => ac.abort(), 5000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal:   ac.signal,
      headers:  { 'User-Agent': UA, 'Accept': 'text/html,application/json,*/*' },
    });
    let body = '';
    if (url.includes('t.me') || url.includes('steamcommunity')) {
      body = (await res.text().catch(() => '')).slice(0, 20000);
    }
    return { status: res.status, body };
  } catch (_) {
    return { status: null, body: '' };
  } finally {
    clearTimeout(t);
  }
}

function judge(name, out) {
  if (out.status === null) return 'unknown';
  if (name === 'Telegram') return out.body.includes('tgme_page_title') ? 'taken' : 'free';
  if (name === 'Steam') {
    if (/profile could not be found/i.test(out.body)) return 'free';
    return out.status === 200 ? 'taken' : 'unknown';
  }
  return 'unknown';
}

async function checkUsername(username) {
  return Promise.all(PLATFORMS.map(async ([name, build]) => {
    const [url, verdict] = build(username);
    const out  = await probe(url);
    const state = verdict ? verdict(out.status) : judge(name, out);
    return [name, state];
  }));
}

const STATE_ICON  = { taken: '\u25cf', free: '\u25cb', unknown: '\u25cc' };
const STATE_COLOR = {};
STATE_COLOR.taken   = C.bred;
STATE_COLOR.free    = C.red;
STATE_COLOR.unknown = C.grey;

function renderTerminal(username, results) {
  process.stdout.write(SEP + '\n');
  process.stdout.write(`  ${C.silver}username  ${C.darkRed}\u203a${R}  ${C.white}@${username}${R}\n`);
  process.stdout.write(SEP + '\n\n');
  for (const [name, state] of results) {
    const label = `${STATE_ICON[state]} ${name}`.padEnd(13);
    process.stdout.write(`  ${C.grey}${label}${R}  ${STATE_COLOR[state]}${state}${R}\n`);
  }
  const free = results.filter(r => r[1] === 'free').length;
  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.silver}free on ${C.white}${free}${R} ${C.silver}of ${C.white}${results.length}${R} ${C.silver}platforms${R}\n`);
  process.stdout.write(SEP + '\n\n');
}

module.exports = async function ut(args, ctx) {
  const { edit, isTerminal } = ctx;

  if (isTerminal) {
    pauseCLI();
    setAtPrompt(false);
    clearScreen();

    process.stdout.write('\n' + SEP + '\n');
    process.stdout.write(`  ${C.bred}${C.bold}`);
    await typeText('◈  USERNAME TRACKER');
    process.stdout.write(R + '\n');
    process.stdout.write(SEP + '\n');
    ln(`  ${C.grey}checks 11 platforms  \u25cf taken  \u25cb free  \u25cc unknown${R}`);
    process.stdout.write(SEP + '\n\n');

    let username = (args[0] || '').trim();

    if (!username) {
      const { value, ctrl } = await readLine(`  ${C.silver}Username   ${C.darkRed}\u203a${R} `);
      if (ctrl || !value.trim()) {
        ln(); bad('cancelled'); ln();
        resumeCLI();
        return;
      }
      username = value.trim();
    }

    username = username.replace(/^@/, '');

    if (!/^[A-Za-z0-9._-]{2,32}$/.test(username)) {
      bad('invalid username — use 2-32 letters, digits, . _ -');
      ln();
      resumeCLI();
      return;
    }

    ln(`  ${C.grey}checking @${username} across platforms...${R}`);
    ln();

    const results = await checkUsername(username);

    renderTerminal(username, results);

    await readLine(`  ${C.grey}Press Enter to return${R}  `);

    const { printBanner, printMenu } = require('../utils/banner');
    clearScreen();
    printBanner();
    printMenu();
    resumeCLI();
    return;
  }

  const raw = (args[0] || '').trim().replace(/^@/, '');

  if (!raw) {
    const f = [['usage', '.ut <username>'], ['checks', '11 platforms']];
    return edit(card('USERNAME TRACKER', f));
  }

  if (!/^[A-Za-z0-9._-]{2,32}$/.test(raw)) {
    const f = [['error', 'invalid username — use 2-32 letters, digits, . _ -']];
    return edit(card('USERNAME TRACKER', f));
  }

  const results = await checkUsername(raw);
  const free    = results.filter(r => r[1] === 'free').length;
  const fields  = [
    ['username', '@' + raw],
    ...results.map(([name, state]) => [`${STATE_ICON[state]} ${name}`, state]),
    ['summary',  `${free} free of ${results.length}`],
  ];

  return edit(card('USERNAME TRACKER', fields));
};
