'use strict';
const { C, clearScreen, typeText, TOP_SEP, MID_SEP } = require('../utils/banner');
const { readSecret, readLine, readYN }                = require('../utils/rawInput');
const { request }                                     = require('../utils/request');
const db                                              = require('../core/db');

const R = C.reset;

function ln(s = '') { process.stdout.write(s + '\n'); }

function listRow(n, label, strike = false) {
  const numStr     = String(n).padStart(2, '0');
  const labelColor = strike ? C.grey : C.silver;
  return `  ${C.grey}[${C.bred}${numStr}${C.grey}]${R}  ${labelColor}${label}${R}`;
}

async function drawHeader(title) {
  clearScreen();
  ln();
  ln(TOP_SEP);
  process.stdout.write(`  ${C.blood}${C.bold}`);
  await typeText(title, 20);
  process.stdout.write(R + '\n');
  ln(TOP_SEP);
}

async function validateToken(token) {
  try {
    const data = await request(token, 'GET', '/users/@me');
    if (data && data.username) {
      return { ok: true, username: data.username, id: data.id };
    }
    return { ok: false, error: (data && data.message) || 'invalid token' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function registerFlow() {
  while (true) {
    await drawHeader('OZEU  \u2014  REGISTER');
    ln();
    ln(`  ${C.grey}enter your Discord token  (input is hidden as *)${R}`);
    ln();

    const { value: raw, ctrl } = await readSecret(`  ${C.silver}Token ${C.darkRed}\u203a${R} `);

    if (ctrl) return null;

    const token = raw.trim();

    if (!token) {
      process.stdout.write('\n');
      ln(`  ${C.bred}no token entered${R}`);
      ln();
      const retry = await readYN(`  ${C.grey}try again? ${C.darkRed}[Y/N]: ${R}`);
      ln();
      if (!retry) return null;
      continue;
    }

    process.stdout.write('\n');
    ln(`  ${C.grey}validating...${R}`);

    const result = await validateToken(token);

    if (!result.ok) {
      ln(`  ${C.bred}\u2718  invalid token${R}  ${C.grey}${result.error}${R}`);
      ln();
      const retry = await readYN(`  ${C.grey}try another? ${C.darkRed}[Y/N]: ${R}`);
      ln();
      if (!retry) return null;
      continue;
    }

    db.addToken(token, result.username);

    ln(`  ${C.red}\u2714${R}  ${C.silver}registered as ${C.white}@${result.username}${R}`);
    ln(`  ${C.grey}token saved to database${R}`);
    ln();
    await new Promise(r => setTimeout(r, 800));
    return token;
  }
}

async function loginListFlow() {
  while (true) {
    let tokens = db.getTokens();

    await drawHeader('OZEU  \u2014  LOGIN LIST');
    ln();

    if (tokens.length === 0) {
      ln(`  ${C.grey}no saved accounts${R}`);
      ln();
      ln(MID_SEP);
      ln();
      ln(`  ${C.grey}press Enter to go back${R}`);
      await readLine('');
      return null;
    }

    tokens.forEach((t, i) => {
      ln(listRow(i + 1, `@${t.username}`));
    });

    ln();
    ln(MID_SEP);
    ln();

    const { value: sel, ctrl } = await readLine(`  ${C.darkRed}\u203a${R} `);

    if (ctrl || !sel.trim()) return null;

    const idx = parseInt(sel.trim(), 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= tokens.length) {
      ln(`  ${C.bred}invalid selection${R}`);
      await new Promise(r => setTimeout(r, 800));
      continue;
    }

    const selected = tokens[idx];

    process.stdout.write('\n');
    ln(`  ${C.grey}connecting...${R}`);

    const result = await validateToken(selected.token);

    if (result.ok) {
      if (result.username !== selected.username) {
        db.updateToken(selected.id, { username: result.username });
      }
      ln(`  ${C.red}\u2714${R}  ${C.silver}logged in as ${C.white}@${result.username}${R}`);
      ln();
      await new Promise(r => setTimeout(r, 600));
      return selected.token;
    }

    ln();
    ln(`  ${C.bred}\u2718  Login failed.${R}`);
    ln(`  ${C.grey}Removing @${selected.username} from list.${R}`);
    db.removeToken(selected.id);
    ln();

    const tryNew = await readYN(`  ${C.silver}Try a new token? ${C.darkRed}[Y/N]: ${R}`);
    ln();

    if (tryNew) {
      const token = await registerFlow();
      if (token) return token;
    }
  }
}

async function loginTool() {
  while (true) {
    await drawHeader('OZEU  \u2014  LOGIN');
    ln();
    ln(listRow(1, 'Login List'));
    ln(listRow(2, 'Register'));
    ln();
    ln(MID_SEP);
    ln();

    const { value: sel, ctrl } = await readLine(`  ${C.darkRed}\u203a${R} `);

    if (ctrl) continue;

    const s = sel.trim();

    if (s === '1' || s === '01') {
      const token = await loginListFlow();
      if (token) return token;
    } else if (s === '2' || s === '02') {
      const token = await registerFlow();
      if (token) return token;
    } else {
      ln(`  ${C.bred}invalid selection — enter 1 or 2${R}`);
      await new Promise(r => setTimeout(r, 900));
    }
  }
}

/**
 * autoLogin(index)
 * Silently pick the Nth saved token (0-based, default 0) and return it.
 * Returns null if no saved tokens exist or the token is invalid.
 */
async function autoLogin(index = 0) {
  const tokens = db.getTokens();

  if (tokens.length === 0) {
    process.stderr.write(`\n  ${C.bred}[auto-login] no saved accounts found — run without --auto to register one.${C.reset}\n\n`);
    return null;
  }

  const idx = Math.max(0, Math.min(index, tokens.length - 1));
  const selected = tokens[idx];

  process.stdout.write(`  ${C.grey}[auto-login] trying ${C.white}@${selected.username}${C.grey}...${C.reset}\n`);

  const result = await validateToken(selected.token);

  if (result.ok) {
    if (result.username !== selected.username) {
      db.updateToken(selected.id, { username: result.username });
    }
    process.stdout.write(`  ${C.red}\u2714${C.reset}  ${C.silver}auto-logged in as ${C.white}@${result.username}${C.reset}\n\n`);
    return selected.token;
  }

  process.stderr.write(`  ${C.bred}\u2718  auto-login failed for @${selected.username}: ${result.error}${C.reset}\n`);
  process.stderr.write(`  ${C.grey}removing invalid token and falling back to manual login.${C.reset}\n\n`);
  db.removeToken(selected.id);
  return null;
}

module.exports = { loginTool, autoLogin };
