'use strict';
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execSync, spawnSync } = require('child_process');

const TOKEN_RE = /[A-Za-z0-9_\-]{24,30}\.[A-Za-z0-9_\-]{6}\.[A-Za-z0-9_\-]{27,}/;

function isToken(s) {
  return s && TOKEN_RE.test(s) && s.length >= 59 && s.length <= 100;
}

function tryProcessMemory() {
  const py = `
import re, glob, sys
T = re.compile(rb'[A-Za-z0-9_\\-]{24,30}\\.[A-Za-z0-9_\\-]{6}\\.[A-Za-z0-9_\\-]{27,}')
found = set()
for mp in glob.glob('/proc/*/maps'):
    try:
        pid = mp.split('/')[2]
        cmd = open(f'/proc/{pid}/cmdline','rb').read()
        if b'iscord' not in cmd: continue
        lines = open(mp).readlines()
        mem = open(f'/proc/{pid}/mem','rb')
        for ln in lines:
            try:
                p = ln.split()
                if len(p)<2 or 'r' not in p[1] or 's' in p[1]: continue
                s,e = (int(x,16) for x in p[0].split('-'))
                if e-s>10*1024*1024: continue
                mem.seek(s); chunk=mem.read(e-s)
                for m in T.findall(chunk):
                    t=m.decode('utf-8','ignore')
                    if len(t)>=59: found.add(t)
            except: pass
        mem.close()
    except: pass
if found:
    print(max(found,key=len)); sys.exit(0)
sys.exit(1)
`;
  try {
    const r = spawnSync('python3', ['-c', py], {
      encoding: 'utf8', stdio: ['ignore','pipe','ignore'], timeout: 10000
    });
    const t = (r.stdout || '').trim();
    if (isToken(t)) return t;
  } catch {}
  return null;
}

function levelDBDir() {
  return [
    `${os.homedir()}/.config/discord/Local Storage/leveldb`,
    `${os.homedir()}/.config/discordptb/Local Storage/leveldb`,
    `${os.homedir()}/.config/discordcanary/Local Storage/leveldb`,
    `${os.homedir()}/.var/app/com.discordapp.Discord/config/discord/Local Storage/leveldb`,
    `${os.homedir()}/snap/discord/current/.config/discord/Local Storage/leveldb`,
  ].find(d => fs.existsSync(d));
}

function collectPasswords() {
  const set = new Set(['peanuts', '']);
  for (const [attr, val] of [
    ['service',     'Discord Safe Storage'],
    ['service',     'Chromium Safe Storage'],
    ['service',     'Electron Safe Storage'],
    ['application', 'Discord'],
    ['application', 'discord'],
  ]) {
    try {
      const r = execSync(`secret-tool lookup ${attr} "${val}" 2>/dev/null`, {
        encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:3000
      }).trim();
      if (r) set.add(r);
    } catch {}
  }
  try {
    const h = execSync(
      'qdbus org.kde.kwalletd5 /modules/kwalletd5 org.kde.KWallet.open kdewallet 0 "" 2>/dev/null',
      { encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:3000 }
    ).trim();
    if (h && !isNaN(parseInt(h))) {
      for (const folder of ['Passwords','Chromium Keys','Chromium Form Data']) {
        for (const key of ['Discord Safe Storage','Chromium Safe Storage','Electron Safe Storage']) {
          try {
            const pw = execSync(
              `qdbus org.kde.kwalletd5 /modules/kwalletd5 org.kde.KWallet.readPassword ${h} "${folder}" "${key}" "" 2>/dev/null`,
              { encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:3000 }
            ).trim();
            if (pw) set.add(pw);
          } catch {}
        }
      }
    }
  } catch {}
  return [...set];
}

function aesDecrypt(encBuf, key) {
  const iv       = Buffer.alloc(16, 0x20);
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(encBuf), decipher.final()]).toString('utf8');
}

function tryLevelDB() {
  const dir = levelDBDir();
  if (!dir) return null;
  const passwords = collectPasswords();
  const aesKeys   = passwords.map(pw =>
    crypto.pbkdf2Sync(Buffer.from(pw, 'utf8'), 'saltysalt', 1, 16, 'sha1')
  );
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.ldb') || f.endsWith('.log'))
    .sort((a, b) => {
      if (a.endsWith('.log') !== b.endsWith('.log')) return a.endsWith('.log') ? -1 : 1;
      return b.localeCompare(a);
    })
    .map(f => path.join(dir, f));
  for (const file of files) {
    let buf;
    try { buf = fs.readFileSync(file); } catch { continue; }
    const plain = buf.toString('latin1');
    const pm    = plain.match(TOKEN_RE);
    if (pm && isToken(pm[0])) return pm[0];
    for (let i = 0; i < buf.length - 3; i++) {
      if (buf[i] === 0x76 && buf[i+1] === 0x31 && (buf[i+2] === 0x30 || buf[i+2] === 0x31)) {
        for (const aesKey of aesKeys) {
          for (let len = 48; len <= 320; len += 16) {
            if (i + 3 + len > buf.length) break;
            try {
              const dec = aesDecrypt(buf.slice(i+3, i+3+len), aesKey);
              const m   = dec.match(TOKEN_RE);
              if (m && isToken(m[0])) return m[0];
            } catch {}
          }
        }
      }
    }
  }
  return null;
}

const token = tryProcessMemory() || tryLevelDB();
if (token) {
  process.stdout.write(token + '\n');
  process.exit(0);
} else {
  process.stderr.write('Token not found.\nTry: open Discord first, then run ./launch.sh again.\n');
  process.exit(1);
}
