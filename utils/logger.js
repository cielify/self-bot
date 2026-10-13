'use strict';
const fs   = require('fs');
const path = require('path');
const { C, ok, err, info } = require('./banner');

function getDataDir() { return require('../core/config').DATA_DIR; }

const logBuffer = { exports: [], mutuals: [], friendRequests: [] };

function log(category, message) {
  const label = {
    exports:        `${C.silver}[export]${C.reset}`,
    mutuals:        `${C.red}[mutual]${C.reset}`,
    friendRequests: `${C.bred}[friend]${C.reset}`,
    monitor:        `${C.grey}[monitor]${C.reset}`,
  }[category] || `${C.grey}[log]${C.reset}`;

  const line = `  ${label}  ${C.silver}${message}${C.reset}`;
  process.stdout.write(line + '\n');

  const state = require('../core/state');

  // liveLog ring buffer — re-printed after commands
  state.liveLog.push(line);
  if (state.liveLog.length > 20) state.liveLog.shift();

  // monitorLog — persistent, never wiped, powers .live-monitor
  const entry = { time: new Date().toLocaleTimeString(), category, text: line };
  state.monitorLog.push(entry);
  if (state.monitorLog.length > 500) state.monitorLog.shift();

  // notify any active live-monitor listener
  state.monitorListeners.forEach(fn => fn(entry));

  if (logBuffer[category] !== undefined) {
    logBuffer[category].push(`[${new Date().toISOString()}] ${message}`);
  }

  // write plain text to live log file if configured
  if (state.logFilePath) {
    try {
      const plain = `[${new Date().toLocaleTimeString()}] [${category}] ${message}\n`;
      fs.appendFileSync(state.logFilePath, plain, 'utf8');
    } catch (_) {}
  }
}

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  process.stdout.write(`\n${C.blood}[Ozeu Mania]${C.reset} ${C.silver}shutting down (${signal})...${C.reset}\n`);

  try { require('../core/config').saveConfig(); } catch (_) {}

  const hasLogs = Object.values(logBuffer).some(b => b.length > 0);
  if (hasLogs) {
    const dataDir    = getDataDir();
    const logsDir    = path.join(dataDir, 'logs');
    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionDir = path.join(logsDir, timestamp);
    try {
      fs.mkdirSync(sessionDir, { recursive: true });
      for (const [key, lines] of Object.entries(logBuffer)) {
        if (lines.length > 0)
          fs.writeFileSync(path.join(sessionDir, `${key}.txt`), lines.join('\n'), 'utf8');
      }
      ok(`logs saved → ${sessionDir}`);
    } catch (e) {
      err(`log save failed: ${e.message}`);
    }
  } else {
    info('no session logs to save.');
  }
}

function setupShutdown() {
  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach(sig => {
    process.on(sig, () => { shutdown(sig); process.exit(0); });
  });
  process.on('uncaughtException', (e) => { err(`[crash] ${e.message}`); shutdown('crash'); process.exit(1); });
  process.on('unhandledRejection', (r) => { err(`[unhandled] ${r}`); });
  process.on('exit', () => shutdown('exit'));
}

module.exports = { logBuffer, log, setupShutdown };
