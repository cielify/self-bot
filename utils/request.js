'use strict';
const { print } = require('./output');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function request(token, method, path, body = null) {
  let retries = 0;

  while (retries < 5) {
    let res;
    try {
      res = await fetch(`https://discord.com/api/v9${path}`, {
        method,
        headers: {
          Authorization:        token,
          'User-Agent':         UA,
          'X-Discord-Locale':   'en-US',
          'X-Super-Properties': Buffer.from(JSON.stringify({
            os: 'Windows', browser: 'Chrome', device: '',
            system_locale: 'en-US', browser_version: '120.0.0.0',
          })).toString('base64'),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (netErr) {
      retries++;
      if (retries >= 5) {
        print(`  \u001b[90m\u25c6\u001b[0m  \u001b[37mnetwork error: ${netErr.message}\u001b[0m`);
        return { code: -1, message: `network error: ${netErr.message}` };
      }
      await sleep(700 * retries);
      continue;
    }

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      const wait = Math.ceil((data.retry_after || 1) * 1000);
      print(`  \u001b[90m\u25c6\u001b[0m  \u001b[37mrate limited — waiting ${wait}ms\u001b[0m`);
      await sleep(wait);
      retries++;
      continue;
    }

    if (res.status === 204) return null;

    const json = await res.json().catch(() => null);

    if (json === null) {
      return { code: -1, message: `unexpected response (HTTP ${res.status})` };
    }

    if (!res.ok && json.code === undefined) {
      json.code = -1;
      json.message = json.message || `HTTP ${res.status}`;
    }

    return json;
  }

  return { code: -1, message: 'too many retries' };
}

function friendlyError(res) {
  if (!res) return 'no response from Discord';
  const msg = res.message || `code ${res.code}`;
  const hints = {
    0:     'invalid or expired token',
    40004: 'account is unauthorized — re-login',
    10004: 'server not found — check the Server ID',
    50001: 'missing access — account lacks permission for this action',
    50013: 'missing permissions for this action',
    50035: 'invalid input — check the name/value',
  };
  const hint = hints[res.code];
  return hint ? `${msg} (${hint})` : msg;
}

module.exports = { request, friendlyError };
