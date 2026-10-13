'use strict';
const { printBanner, printMenu, clearScreen, C, err, info } = require('./utils/banner');
const state              = require('./core/state');
const { loadConfig }     = require('./core/config');
const { startGateway }   = require('./core/gateway');
const { setupShutdown }  = require('./utils/logger');
const { startCLI }       = require('./cli');
const { loginTool, autoLogin } = require('./commands/login');

const argv      = process.argv.slice(2);
const envToken  = process.env.DISCORD_TOKEN || '';
const hasAuto   = argv.includes('--auto');
const accFlag   = argv.find(a => a.startsWith('--account='));
const accIdx    = accFlag ? Math.max(1, parseInt(accFlag.split('=')[1], 10) || 1) - 1 : 0;
const useAuto   = hasAuto || !!accFlag;

async function main() {
  setupShutdown();
  loadConfig();
  printBanner();

  let token = null;

  if (envToken) {
    token = envToken;
    info('using token from environment');
    process.stdout.write('\n');
  } else if (useAuto) {
    token = await autoLogin(accIdx);
  }

  if (!token) {
    token = await loginTool();
  }

  state.token = token;
  clearScreen();
  printBanner();
  info('connecting...');
  process.stdout.write('\n');
  await startGateway();
  printMenu();
  startCLI();
}

main().catch(e => {
  process.stderr.write(`\n  fatal: ${e.message}\n`);
  process.exit(1);
});
