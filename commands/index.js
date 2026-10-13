'use strict';
const state             = require('../core/state');
const { request }       = require('../utils/request');
const { stripMarkdown } = require('../utils/format');

const purge      = require('./purge');
const exportCmd  = require('./export');
const snipe      = require('./snipe');
const userinfo   = require('./userinfo');
const serverinfo = require('./serverinfo');
const ping       = require('./ping');
const mutual     = require('./mutual');
const autofriend = require('./autofriend');
const help       = require('./help');
const gcconf     = require('./gcconf');
const ip         = require('./ip');
const email      = require('./email');
const ut         = require('./ut');
const wc         = require('./wc');
const pn         = require('./pn');
const wbh        = require('./wbh');
const add        = require('./add');
const avatar     = require('./avatar');
const ipp        = require('./ipp');
const ipping     = require('./ipping');
const ipgen      = require('./ipgen');
const pencrypt   = require('./pencrypt');
const pdecrypt   = require('./pdecrypt');
const dtinfo     = require('./dtinfo');
const dtjoiner   = require('./dtjoiner');
const antigc     = require('./antigc');
const rnUser     = require('./rn-user');
const rnChannel  = require('./rn-channel');
const usersId    = require('./users-id');
const wAll       = require('./w-all');
const rnWhAll    = require('./rn-wh-all');
const dmAll      = require('./dmall');
const setup      = require('./setup');
const liveMonitor = require('./live-monitor');
const block      = require('./block');
const closedm    = require('./closedm');
const kickg      = require('./kickg');
const invis           = require('./invis');
const userRoleNInfo   = require('./user-role-n-info');
const userConvoHistory = require('./user-convo-history');
const tr              = require('./tr');
const logout           = require('./logout');

async function handleCommand(command, args, msg) {
  const isTerminal = !msg;
  const token      = state.token;

  let channelId, messageId, guildId, timestamp;
  if (!isTerminal) {
    ({ channel_id: channelId, id: messageId, guild_id: guildId, timestamp } = msg);
  } else {
    timestamp = new Date().toISOString();
  }

  const edit = isTerminal
    ? async (content) => { process.stdout.write('\n' + stripMarkdown(content) + '\n\n'); }
    : async (content) => request(token, 'PATCH', `/channels/${channelId}/messages/${messageId}`, { content });

  const del = isTerminal
    ? async () => {}
    : async () => request(token, 'DELETE', `/channels/${channelId}/messages/${messageId}`);

  const ctx = {
    token, channelId, messageId, guildId, timestamp, edit, del, isTerminal, channel: channelId,
    // reply context — null when command came from the terminal
    referencedMessage: msg?.referenced_message  ?? null,
    messageReference:  msg?.message_reference   ?? null,
  };

  switch (command) {
    case 'purge':                                     return purge(args, ctx);
    case 'export':                                    return exportCmd(args, ctx);
    case 's':                                         return snipe(args, ctx);
    case 'wc':                                        return wc(args, ctx);
    case 'gc,conf': case 'gcconf':                    return gcconf(args, ctx);

    case 'u':  case 'uinfo': case 'userinfo':         return userinfo(args, ctx);
    case 'si': case 'sinfo': case 'serverinfo':       return serverinfo(args, ctx);
    case 'ip': case 'IP':                             return ip(args, ctx);
    case 'email':                                     return email(args, ctx);
    case 'ut':                                        return ut(args, ctx);
    case 'pn':                                        return pn(args, ctx);
    case 'wbh':                                       return wbh(args, ctx);
    case 'add':                                       return add(args, ctx);
    case 'avatar':                                    return avatar(args, ctx);

    case 'ip-p':                                      return ipp(args, ctx);
    case 'ip-ping':                                   return ipping(args, ctx);
    case 'ip-gen':                                    return ipgen(args, ctx);

    case 'p-encrypt':                                 return pencrypt(args, ctx);
    case 'p-decrypt':                                 return pdecrypt(args, ctx);

    case 'ping':                                      return ping(args, ctx);
    case 'd':  case 'mutual':                         return mutual(args, ctx);
    case 'a':  case 'fq':                             return autofriend(args, ctx);
    case 'help':                                      return help(args, ctx);
    case 'dt-info':                                   return dtinfo(args, ctx);
    case 'dt-joiner':                                 return dtjoiner(args, ctx);
    case 'antigc':                                    return antigc(args, ctx);

    case 'rn-user':                                   return rnUser(args, ctx);
    case 'rn-channel':                                return rnChannel(args, ctx);
    case 'users-id':                                  return usersId(args, ctx);
    case 'w-all':                                     return wAll(args, ctx);
    case 'rn-wh-all':                                 return rnWhAll(args, ctx);
    case 'dmall':                                     return dmAll(args, ctx);
    case 'setup':                                     return setup(args, ctx);
    case 'live-monitor':                              return liveMonitor(args, ctx);
    case 'block':                                     return block(args, ctx);
    case 'closedm':                                   return closedm(args, ctx);
    case 'kickg':                                     return kickg(args, ctx);
    case 'invis':                                     return invis(args, ctx);
    case 'user-role-n-info':   case 'urni':          return userRoleNInfo(args, ctx);
    case 'user-convo-history': case 'uch':           return userConvoHistory(args, ctx);
    case 'tr':                                        return tr(args, ctx);
    case 'logout':                                    return logout(args, ctx);

    default:
      if (isTerminal) {
        process.stdout.write(`  ${command ? 'unknown: .' + command : 'empty'} — try .help or a number\n\n`);
      }
  }
}

module.exports = handleCommand;
