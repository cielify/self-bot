'use strict';
const state               = require('../core/state');
const { loginTool }       = require('./login');
const { startGateway }    = require('../core/gateway');
const { printBanner, printMenu, clearScreen, info } = require('../utils/banner');
const { pauseCLI, resumeCLI } = require('../utils/cliControl');
const { setAtPrompt }     = require('../utils/output');

module.exports = async function logout(args, ctx) {
  if (!ctx.isTerminal) return;

  pauseCLI();
  setAtPrompt(false);

  // ── close current gateway cleanly ─────────────────────────────────────────
  state.loggingOut = true;

  if (state.ws) {
    try { state.ws.close(1000, 'logout'); } catch (_) {}
    // give it up to 1.5s to shut down
    await new Promise(r => setTimeout(r, 1500));
  }

  // ── wipe session state ────────────────────────────────────────────────────
  state.token              = null;
  state.userId             = null;
  state.friends            = {};
  state.guildNames         = {};
  state.snipeCache         = {};
  state.messageCache       = {};
  state.autoAccept         = false;
  state.mutualDetect       = false;
  state.gatewayPing        = null;
  state.antiGC             = false;
  state.ws                 = null;
  state.memberRequests     = {};
  state.memberListHandlers = {};
  state.loggingOut         = false;
  // session-specific caches — must not bleed into the next account
  state.liveLog.length     = 0;
  state.monitorLog.length  = 0;
  state.monitorListeners.clear();
  state.presenceCache      = {};
  state.pendingLeaves      = {};
  state.ignoredUsers       = new Set();
  state.dmChannels         = {};
  state.messageLogger      = false;
  state.joinLeaveMonitor   = false;
  state.presenceTracker    = false;
  state.logFilePath        = null;

  // ── back to login screen ──────────────────────────────────────────────────
  clearScreen();
  printBanner();

  const token = await loginTool();

  state.token = token;

  clearScreen();
  printBanner();
  info('connecting...');
  process.stdout.write('\n');

  await startGateway();

  printMenu();
  resumeCLI();
};
