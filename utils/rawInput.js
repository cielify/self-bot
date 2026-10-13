'use strict';

function setRaw(on) {
  try { if (process.stdin.isTTY) process.stdin.setRawMode(on); } catch (_) {}
}

function popChar(bytes) {
  bytes.pop();
  while (bytes.length > 0 && (bytes[bytes.length - 1] & 0xC0) === 0x80) bytes.pop();
}

function decode(bytes) {
  return Buffer.from(bytes).toString('utf8');
}

function readSecret(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const bytes = [];
    setRaw(true);
    process.stdin.resume();

    function onData(chunk) {
      for (const byte of chunk) {
        if (byte === 3)  { cleanup(); process.stdout.write('\n'); process.exit(0); }
        if (byte === 13 || byte === 10) {
          cleanup();
          process.stdout.write('\n');
          return resolve({ value: decode(bytes), ctrl: null });
        }
        if (byte === 127 || byte === 8) {
          if (bytes.length > 0) {
            const cont = (bytes[bytes.length - 1] & 0xC0) === 0x80;
            popChar(bytes);
            if (!cont) process.stdout.write('\b \b');
          }
        } else if (byte >= 32) {
          bytes.push(byte);
          if ((byte & 0xC0) !== 0x80) process.stdout.write('*');
        }
      }
    }
    function cleanup() {
      process.stdin.removeListener('data', onData);
      setRaw(false);
      process.stdin.pause();
    }
    process.stdin.on('data', onData);
  });
}

function readLine(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const bytes = [];
    setRaw(true);
    process.stdin.resume();

    const CTRLMAP = { 1:'A', 2:'B', 14:'N', 20:'T', 19:'S', 18:'R' };

    function onData(chunk) {
      for (const byte of chunk) {
        if (byte === 3) { cleanup(); process.stdout.write('\n'); process.exit(0); }
        if (CTRLMAP[byte]) {
          cleanup();
          process.stdout.write('\n');
          return resolve({ value: decode(bytes), ctrl: CTRLMAP[byte] });
        }
        if (byte === 13 || byte === 10) {
          cleanup();
          process.stdout.write('\n');
          return resolve({ value: decode(bytes), ctrl: null });
        }
        if (byte === 127 || byte === 8) {
          if (bytes.length > 0) {
            const cont = (bytes[bytes.length - 1] & 0xC0) === 0x80;
            popChar(bytes);
            if (!cont) process.stdout.write('\b \b');
          }
        } else if (byte >= 32) {
          bytes.push(byte);
          process.stdout.write(Buffer.from([byte]));
        }
      }
    }
    function cleanup() {
      process.stdin.removeListener('data', onData);
      setRaw(false);
      process.stdin.pause();
    }
    process.stdin.on('data', onData);
  });
}

function readYN(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    setRaw(true);
    process.stdin.resume();

    function onData(chunk) {
      const byte = chunk[0];
      if (byte === 3) { cleanup(); process.stdout.write('\n'); process.exit(0); }
      const ch = String.fromCharCode(byte).toLowerCase();
      if (ch === 'y' || ch === 'n') {
        cleanup();
        process.stdout.write(ch.toUpperCase() + '\n');
        resolve(ch === 'y');
      }
    }
    function cleanup() {
      process.stdin.removeListener('data', onData);
      setRaw(false);
      process.stdin.pause();
    }
    process.stdin.on('data', onData);
  });
}

function readAnyKey(prompt) {
  return new Promise((resolve) => {
    if (prompt) process.stdout.write(prompt);
    setRaw(true);
    process.stdin.resume();

    // drain any bytes buffered from previous prompts before listening
    setTimeout(() => {
      // flush one more time
      try { while (process.stdin.read()) {} } catch (_) {}

      function onData(chunk) {
        const byte = chunk[0];
        if (byte === 3) { cleanup(); process.exit(0); }
        cleanup();
        resolve(byte);
      }
      function cleanup() {
        process.stdin.removeListener('data', onData);
        setRaw(false);
        process.stdin.pause();
      }
      process.stdin.on('data', onData);
    }, 80);
  });
}

module.exports = { readSecret, readLine, readYN, readAnyKey };
