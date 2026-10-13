'use strict';
const { C, clearScreen, typeText }  = require('../utils/banner');
const { pauseCLI, resumeCLI }       = require('../utils/cliControl');
const { setAtPrompt }               = require('../utils/output');
const { readLine }                  = require('../utils/rawInput');
const { request }                   = require('../utils/request');
const { ensureGuildAccess }         = require('../utils/guildAccess');
const { avatarLines }               = require('../utils/termImg');
const state                         = require('../core/state');

const R    = C.reset;
const SEP  = `${C.darkRed}${'─'.repeat(52)}${R}`;
const DSEP = `${C.darkRed}${'·'.repeat(52)}${R}`;

const AV_COLS  = 22;
const AV_ROWS  = 11;
const AV_BLANK = ' '.repeat(AV_COLS);
const AV_PAD   = '  ';

function ln(s = '') { process.stdout.write((s || '') + '\n'); }
function bad(s)     { ln(`  ${C.bred}\u2718${R}  ${C.grey}${s}${R}`); }
function inf(s)     { ln(`  ${C.grey}\u25c6${R}  ${C.silver}${s}${R}`); }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }

function printHeader(crumbs) {
  process.stdout.write('\n' + SEP + '\n');
  const trail = crumbs.map((c, i) =>
    i === crumbs.length - 1
      ? `${C.white}${C.bold}${c}${R}`
      : `${C.grey}${c}${R}`
  ).join(`  ${C.darkRed}\u203a${R}  `);
  process.stdout.write(`  ${C.bred}${C.bold}\u25c8${R}  ${trail}\n`);
  process.stdout.write(SEP + '\n\n');
}

function printFooter(hints) {
  process.stdout.write(DSEP + '\n');
  for (const h of hints) process.stdout.write(`  ${C.grey}${h}${R}\n`);
  process.stdout.write(DSEP + '\n\n');
}

function sideBySide(imgLines, infoLines) {
  const total = Math.max(imgLines ? imgLines.length : 0, infoLines.length);
  for (let i = 0; i < total; i++) {
    const left  = imgLines ? (imgLines[i] ?? AV_BLANK) : AV_BLANK;
    const right = infoLines[i] ?? '';
    process.stdout.write(`  ${left}${AV_PAD}${right}\n`);
  }
}

// ── permission table (BigInt) ─────────────────────────────────────────────
const PERMS = [
  [1n<<0n,  'Create Invite'],    [1n<<1n,  'Kick Members'],
  [1n<<2n,  'Ban Members'],      [1n<<3n,  'Administrator'],
  [1n<<4n,  'Manage Channels'],  [1n<<5n,  'Manage Guild'],
  [1n<<6n,  'Add Reactions'],    [1n<<7n,  'View Audit Log'],
  [1n<<9n,  'Stream / Video'],   [1n<<10n, 'View Channels'],
  [1n<<11n, 'Send Messages'],    [1n<<13n, 'Manage Messages'],
  [1n<<14n, 'Embed Links'],      [1n<<15n, 'Attach Files'],
  [1n<<16n, 'Read History'],     [1n<<17n, 'Mention Everyone'],
  [1n<<20n, 'Voice Connect'],    [1n<<21n, 'Voice Speak'],
  [1n<<22n, 'Mute Members'],     [1n<<23n, 'Deafen Members'],
  [1n<<24n, 'Move Members'],     [1n<<26n, 'Change Nickname'],
  [1n<<27n, 'Manage Nicknames'], [1n<<28n, 'Manage Roles'],
  [1n<<29n, 'Manage Webhooks'],  [1n<<30n, 'Manage Emojis'],
  [1n<<31n, 'Slash Commands'],   [1n<<33n, 'Manage Events'],
  [1n<<34n, 'Manage Threads'],   [1n<<40n, 'Timeout Members'],
];

function parsePerms(raw) {
  const bits = BigInt(raw || '0');
  if (bits & (1n<<3n)) return ['Administrator (all permissions)'];
  return PERMS.filter(([b]) => bits & b).map(([, n]) => n);
}

function hexColor(n) { return n ? '#' + n.toString(16).padStart(6, '0') : null; }

function statusOf(uid) {
  const p   = state.presenceCache[uid];
  const s   = p?.status || 'unknown';
  const col = s==='online'?C.red : s==='idle'?C.silver : s==='dnd'?C.bred : C.grey;
  return { s, col };
}

function mkAvatarUrl(userObj) {
  const h = userObj?.avatar;
  if (h) return `https://cdn.discordapp.com/avatars/${userObj.id}/${h}.png?size=64`;
  const idx = Number((BigInt(userObj?.id || '0') >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

// full-resolution avatar URL for display (1024px, animated if a_)
function mkAvatarFullUrl(userObj) {
  const h = userObj?.avatar;
  if (!h) {
    const idx = Number((BigInt(userObj?.id || '0') >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  const ext = h.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userObj.id}/${h}.${ext}?size=1024`;
}

// ── member loader — lazy, per-role, REST-first ────────────────────────────
// Returns { members[], partial, source }
// partial=true  → online/visible only (op14)
// partial=false → complete list (REST)
async function loadRoleMembers(token, guildId, roleId) {

  // ── 1. REST pagination (complete list — needs MANAGE_GUILD/MANAGE_ROLES) ─
  const restBuf = [];
  let   restOk  = false;
  let   after   = null;
  try {
    while (true) {
      const path  = `/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`;
      const batch = await request(token, 'GET', path);
      if (!batch || !Array.isArray(batch) || batch.length === 0) break;
      restOk = true;
      for (const m of batch) {
        if ((m.roles || []).includes(roleId)) restBuf.push(m);
      }
      if (batch.length < 1000) break;
      after = batch[batch.length - 1].user.id;
      await sleep(350);
    }
  } catch (_) {}

  if (restOk) return { members: restBuf, partial: false, source: 'rest' };

  // ── 2. op14 — visible/online members via member-list subscription ─────────
  // Try up to 5 text channels; 6 s per channel; request ranges 0-499
  const WS_OPEN = 1;
  const ws      = state.ws;
  if (!ws || ws.readyState !== WS_OPEN) {
    return { members: [], partial: true, source: 'none' };
  }

  const channels = await request(token, 'GET', `/guilds/${guildId}/channels`);
  const textChs  = Array.isArray(channels)
    ? channels.filter(c => c.type === 0 || c.type === 5).slice(0, 5)
    : [];

  for (const ch of textChs) {
    const collected = await new Promise(res => {
      const seen    = new Map();
      let   settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        delete state.memberListHandlers[guildId];
        res([...seen.values()]);
      };

      const timer = setTimeout(finish, 6000);

      state.memberListHandlers[guildId] = d => {
        for (const op of (d.ops || [])) {
          const items = op.op === 'SYNC'
            ? (op.items || []).map(x => x.member).filter(Boolean)
            : (op.op === 'INSERT' || op.op === 'UPDATE') && op.item?.member
              ? [op.item.member]
              : [];

          for (const m of items) {
            if (m.user?.id) seen.set(m.user.id, m);
          }
        }

        // if we got groups info, request additional ranges while we still have time
        if (d.groups && seen.size === 0) {
          setTimeout(() => {
            if (settled) return;
            for (let i = 100; i < 500; i += 100) {
              try {
                ws.send(JSON.stringify({
                  op: 14,
                  d: { guild_id: guildId, typing: true, activities: false, threads: false,
                       channels: { [ch.id]: [[i, i + 99]] } },
                }));
              } catch (_) {}
            }
          }, 500);
        }
      };

      // initial range request
      try {
        ws.send(JSON.stringify({
          op: 14,
          d: { guild_id: guildId, typing: true, activities: false, threads: false,
               channels: { [ch.id]: [[0, 99]] } },
        }));
        // pre-send extra ranges — Discord often sends them all together
        setTimeout(() => {
          if (settled) return;
          for (let i = 100; i < 500; i += 100) {
            try {
              ws.send(JSON.stringify({
                op: 14,
                d: { guild_id: guildId, typing: true, activities: false, threads: false,
                     channels: { [ch.id]: [[i, i + 99]] } },
              }));
            } catch (_) {}
          }
        }, 1200);
      } catch (_) { clearTimeout(timer); finish(); }
    });

    if (collected.length > 0) {
      const filtered = collected.filter(m => (m.roles || []).includes(roleId));
      return { members: filtered, partial: true, source: 'op14', visible: collected.length };
    }
  }

  return { members: [], partial: true, source: 'none' };
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 4 — Role Permissions
// ─────────────────────────────────────────────────────────────────────────────
async function viewRolePerms(role, crumbs) {
  const perms = parsePerms(role.permissions);

  while (true) {
    clearScreen();
    printHeader(crumbs);

    const col  = hexColor(role.color);
    process.stdout.write(
      `  ${C.white}${C.bold}${role.name}${R}` +
      (col ? `  ${C.grey}${col}${R}` : '') +
      `  ${C.grey}pos:${role.position}  id:${role.id}${R}\n`
    );
    process.stdout.write(
      `  ${C.grey}hoist: ${role.hoist?'yes':'no'}  mentionable: ${role.mentionable?'yes':'no'}${R}\n\n`
    );

    process.stdout.write(DSEP + '\n');
    process.stdout.write(`  ${C.grey}permissions [${perms.length}]${R}\n`);
    process.stdout.write(DSEP + '\n');

    if (perms.length === 0) {
      process.stdout.write(`  ${C.grey}(none)${R}\n`);
    } else {
      for (let i = 0; i < perms.length; i++) {
        process.stdout.write(
          `  ${C.grey}[${String(i+1).padStart(2,'0')}]${R}  ${C.red}\u00b7${R}  ${C.white}${perms[i]}${R}\n`
        );
      }
    }

    ln();
    printFooter(['0 \u2192 back']);
    const { value, ctrl } = await readLine(`  ${C.silver}input ${C.darkRed}\u203a${R} `);
    if (ctrl || value.trim()==='0' || value.trim()==='') return;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 3 — Member Profile
// ─────────────────────────────────────────────────────────────────────────────
async function viewMember(token, member, allRoles, crumbs) {
  const uid  = member.user?.id || '';
  const tag  = member.user?.username || uid;
  const nick = member.nick || 'none';
  const { s: ts, col: tc } = statusOf(uid);

  const avatarFull = mkAvatarFullUrl(member.user);

  const [tp, imgLines] = await Promise.all([
    request(token, 'GET',
      `/users/${uid}/profile?with_mutual_guilds=false&with_mutual_friends_count=false`)
      .then(r => r?.code ? null : r),
    avatarLines(mkAvatarUrl(member.user), AV_COLS, AV_ROWS),
  ]);

  const bio      = tp?.user_profile?.bio      || 'none';
  const pronouns = tp?.user_profile?.pronouns  || 'none';

  const memberRoleIds = new Set(member.roles || []);
  const memberRoles   = allRoles
    .filter(r => memberRoleIds.has(r.id))
    .sort((a, b) => b.position - a.position);

  while (true) {
    clearScreen();
    printHeader(crumbs);

    const infoLines = [
      `${C.red}\u00bb${R} ${C.silver}${'username'.padEnd(10)}${R}${C.white}${tag}${R}`,
      `${C.red}\u00bb${R} ${C.silver}${'nickname'.padEnd(10)}${R}${C.white}${nick}${R}`,
      `${C.red}\u00bb${R} ${C.silver}${'status'.padEnd(10)}${R}${tc}${ts}${R}`,
      `${C.red}\u00bb${R} ${C.silver}${'pronouns'.padEnd(10)}${R}${C.white}${pronouns}${R}`,
      `${C.red}\u00bb${R} ${C.silver}${'bio'.padEnd(10)}${R}${C.white}${bio.length>55?bio.slice(0,55)+'\u2026':bio}${R}`,
      `${C.red}\u00bb${R} ${C.silver}${'id'.padEnd(10)}${R}${C.white}${uid}${R}`,
      `${C.red}\u00bb${R} ${C.silver}${'roles'.padEnd(10)}${R}${C.white}${memberRoles.length}${R}`,
    ];
    sideBySide(imgLines, infoLines);
    ln();

    // avatar URL + user ID as full-width lines (too long for info column)
    process.stdout.write(DSEP + '\n');
    process.stdout.write(
      `  ${C.red}\u00bb${R} ${C.silver}${'user id'.padEnd(10)}${R}${C.white}${uid}${R}\n`
    );
    process.stdout.write(
      `  ${C.red}\u00bb${R} ${C.silver}${'avatar'.padEnd(10)}${R}${C.grey}${avatarFull}${R}\n`
    );
    process.stdout.write(DSEP + '\n\n');

    process.stdout.write(DSEP + '\n');
    process.stdout.write(`  ${C.grey}roles \u2014 select # to view permissions${R}\n`);
    process.stdout.write(DSEP + '\n\n');

    if (memberRoles.length === 0) {
      process.stdout.write(`  ${C.grey}(no roles)${R}\n`);
    } else {
      for (let i = 0; i < memberRoles.length; i++) {
        const r  = memberRoles[i];
        const pc = parsePerms(r.permissions).length;
        const col = hexColor(r.color);
        process.stdout.write(
          `  ${C.grey}[${String(i+1).padStart(2,'0')}]${R}  ` +
          `${C.white}${r.name.padEnd(22)}${R}  ` +
          (col ? `${C.grey}${col}  ${R}` : '') +
          `${C.grey}pos:${String(r.position).padEnd(4)}  ${pc} perm${pc!==1?'s':' '}${R}  ` +
          `${C.darkRed}\u203a${R}\n`
        );
      }
    }

    ln();
    printFooter([
      '0 \u2192 back to members',
      `1-${memberRoles.length} \u2192 view role permissions`,
    ]);

    const { value, ctrl } = await readLine(`  ${C.silver}select role ${C.darkRed}\u203a${R} `);
    if (ctrl || value.trim()==='0' || value.trim()==='') return;

    const pick = parseInt(value.trim(), 10);
    if (!isNaN(pick) && pick>=1 && pick<=memberRoles.length) {
      const r = memberRoles[pick-1];
      await viewRolePerms(r, [...crumbs, `PERMS: ${r.name}`]);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 2 — Role detail (loads members lazily on entry)
// ─────────────────────────────────────────────────────────────────────────────
const MEM_PER_PAGE = 20;

async function viewRoleDetail(token, guildId, role, allRoles, crumbs) {
  const perms = parsePerms(role.permissions);

  // ── lazy member load on first entry ────────────────────────────────────
  clearScreen();
  printHeader(crumbs);
  process.stdout.write(`  ${C.grey}\u25c6  loading members for ${C.white}${role.name}${C.grey}...${R}\n`);
  process.stdout.write(`  ${C.grey}  trying REST \u2192 op14 member list${R}\n\n`);

  const { members: holders, partial, source, visible } =
    await loadRoleMembers(token, guildId, role.id);

  let page = 0;

  while (true) {
    const totalPages = Math.max(1, Math.ceil(holders.length / MEM_PER_PAGE));
    const ps = page * MEM_PER_PAGE;
    const pe = Math.min(ps + MEM_PER_PAGE, holders.length);

    clearScreen();
    printHeader(crumbs);

    // role meta
    const col = hexColor(role.color);
    process.stdout.write(`  ${C.red}\u00bb${R} ${C.silver}${'color'.padEnd(14)}${R}${C.white}${col || 'default'}${R}\n`);
    process.stdout.write(`  ${C.red}\u00bb${R} ${C.silver}${'hoist'.padEnd(14)}${R}${C.white}${role.hoist?'yes':'no'}${R}\n`);
    process.stdout.write(`  ${C.red}\u00bb${R} ${C.silver}${'mentionable'.padEnd(14)}${R}${C.white}${role.mentionable?'yes':'no'}${R}\n`);
    process.stdout.write(`  ${C.red}\u00bb${R} ${C.silver}${'managed'.padEnd(14)}${R}${C.white}${role.managed?'yes':'no'}${R}\n`);
    process.stdout.write(`  ${C.red}\u00bb${R} ${C.silver}${'members'.padEnd(14)}${R}${C.white}${holders.length}${R}` +
      (partial && source==='op14'
        ? `  ${C.grey}(online/visible only — ${visible||0} scanned)${R}`
        : partial && source==='none'
          ? `  ${C.grey}(requires MANAGE_GUILD to list members)${R}`
          : '') + '\n');
    ln();

    // permissions
    process.stdout.write(DSEP + '\n');
    process.stdout.write(`  ${C.grey}permissions [${perms.length}]${R}\n`);
    process.stdout.write(DSEP + '\n');
    if (perms.length === 0) {
      process.stdout.write(`  ${C.grey}(none)${R}\n`);
    } else {
      for (const p of perms)
        process.stdout.write(`  ${C.grey}\u00b7${R}  ${C.white}${p}${R}\n`);
    }
    ln();

    // member list
    if (holders.length > 0) {
      process.stdout.write(DSEP + '\n');
      process.stdout.write(
        `  ${C.grey}members \u2014 page ${page+1}/${totalPages}` +
        (holders.length > 0 ? `  (${ps+1}\u2013${pe} of ${holders.length})` : '') +
        `${R}\n`
      );
      process.stdout.write(DSEP + '\n\n');

      for (let i = ps; i < pe; i++) {
        const m    = holders[i];
        const uid  = m.user?.id       || '?';
        const uname= m.user?.username || '?';
        const mnick= m.nick           || '';
        const { s, col: sc } = statusOf(uid);

        process.stdout.write(
          `  ${C.grey}[${String(i+1).padStart(2,'0')}]${R}  ` +
          `${sc}\u25cf${R}  ` +
          `${C.white}${uname.padEnd(20)}${R}` +
          (mnick ? `  ${C.grey}${mnick}${R}` : '') +
          `  ${C.grey}${uid}${R}  ` +
          `${C.darkRed}\u203a${R}\n`
        );
      }
      ln();
    } else {
      process.stdout.write(DSEP + '\n');
      process.stdout.write(`  ${C.grey}no members loaded${source==='none'?' — needs MANAGE_GUILD':' — try on a server where you have MANAGE_GUILD'}${R}\n`);
      process.stdout.write(DSEP + '\n\n');
    }

    const footerHints = ['0 \u2192 back to roles'];
    if (totalPages > 1) footerHints.push('n / p \u2192 next / prev page');
    if (holders.length > 0) footerHints.push(`1\u2013${holders.length} \u2192 open member`);
    printFooter(footerHints);

    const { value, ctrl } = await readLine(`  ${C.silver}select ${C.darkRed}\u203a${R} `);
    if (ctrl) return;
    const v = value.trim().toLowerCase();

    if (v==='0' || v==='') return;
    if (v==='n') { if (page<totalPages-1) page++; continue; }
    if (v==='p') { if (page>0) page--; continue; }

    const pick = parseInt(v, 10);
    if (!isNaN(pick) && pick>=1 && pick<=holders.length) {
      const m = holders[pick-1];
      const uname = m.user?.username || String(pick);
      await viewMember(token, m, allRoles, [...crumbs, `USER: ${uname}`]);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL 1 — Server role list  (no upfront member load — show ? count)
// ─────────────────────────────────────────────────────────────────────────────
const ROLES_PER_PAGE = 20;

async function viewRoleList(token, guildId, guildName, allRoles) {
  const sorted = [...allRoles].sort((a, b) => b.position - a.position);
  let   page   = 0;

  const crumbs = [`SERVER: ${guildName}`];

  while (true) {
    const totalPages = Math.max(1, Math.ceil(sorted.length / ROLES_PER_PAGE));
    const ps = page * ROLES_PER_PAGE;
    const pe = Math.min(ps + ROLES_PER_PAGE, sorted.length);

    clearScreen();
    printHeader(crumbs);

    process.stdout.write(
      `  ${C.grey}${sorted.length} roles  \u2014  page ${page+1}/${totalPages}` +
      `  ${C.grey}(member counts load when you open a role)${R}\n\n`
    );

    for (let i = ps; i < pe; i++) {
      const r     = sorted[i];
      const perms = parsePerms(r.permissions);
      const col   = hexColor(r.color);
      const mgd   = r.managed ? `${C.grey}bot  ${R}` : '     ';

      process.stdout.write(
        `  ${C.grey}[${String(i+1).padStart(2,'0')}]${R}  ` +
        (col ? `${C.grey}${col.padEnd(9)}${R}  ` : `${' '.repeat(11)}`) +
        `${mgd}` +
        `${C.white}${r.name.padEnd(24)}${R}  ` +
        `${C.grey}${String(perms.length).padStart(2)} perm${perms.length!==1?'s':' '}${R}  ` +
        `${C.darkRed}\u203a${R}\n`
      );
    }

    ln();
    printFooter([
      '0 \u2192 exit',
      'n / p \u2192 next / prev page',
      `1\u2013${sorted.length} \u2192 open role`,
    ]);

    const { value, ctrl } = await readLine(`  ${C.silver}select role ${C.darkRed}\u203a${R} `);
    if (ctrl) return;
    const v = value.trim().toLowerCase();

    if (v==='0' || v==='') return;
    if (v==='n') { if (page<totalPages-1) page++; continue; }
    if (v==='p') { if (page>0) page--; continue; }

    const pick = parseInt(v, 10);
    if (!isNaN(pick) && pick>=1 && pick<=sorted.length) {
      const role = sorted[pick-1];
      await viewRoleDetail(token, guildId, role, allRoles,
        [...crumbs, `ROLE: ${role.name}`]);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY
// ─────────────────────────────────────────────────────────────────────────────
module.exports = async function userRoleNInfo(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);
  clearScreen();

  process.stdout.write('\n' + SEP + '\n');
  process.stdout.write(`  ${C.bred}${C.bold}`);
  await typeText('\u25c8  USER ROLE + INFO');
  process.stdout.write(R + '\n');
  process.stdout.write(SEP + '\n');
  ln(`  ${C.grey}terminal only  \u2014  role browser \u203a members \u203a profile \u203a perms${R}`);
  process.stdout.write(SEP + '\n\n');

  const { value: gi, ctrl: c1 } = await readLine(`  ${C.silver}Server Id  ${C.darkRed}\u203a${R} `);
  if (c1 || !gi.trim()) { ln(); bad('cancelled'); ln(); resumeCLI(); return; }
  const gid = gi.trim();
  if (!/^\d{15,20}$/.test(gid)) { ln(); bad('invalid server ID'); ln(); resumeCLI(); return; }

  const access = await ensureGuildAccess(ctx.token, gid);
  if (!access.ok) { resumeCLI(); return; }
  const target = access.guildId;

  ln();
  process.stdout.write(SEP + '\n');
  inf('loading roles...');

  // roles + guild info only — no member fetch upfront
  const [allRoles, guildInfo] = await Promise.all([
    request(ctx.token, 'GET', `/guilds/${target}/roles`),
    request(ctx.token, 'GET', `/guilds/${target}`),
  ]);

  if (!Array.isArray(allRoles)) {
    ln(); bad('role fetch failed'); ln(); resumeCLI(); return;
  }

  const guildName = guildInfo?.name || target;
  inf(`${guildName}  \u2014  ${allRoles.length} roles loaded`);
  await sleep(300);

  await viewRoleList(ctx.token, target, guildName, allRoles);
  resumeCLI();
};
