'use strict';
// ── termImg.js ─────────────────────────────────────────────────────────────
// Pure Node.js (built-ins only).
// Decodes PNG → RGBA pixel array, then renders as ANSI half-block art.
// Uses ▀ (U+2580): FG = upper pixel color, BG = lower pixel color.
// Works in any 24-bit-color terminal: Kitty, iTerm2, Windows Terminal, Termux.

const zlib = require('zlib');

// ── PNG signature ─────────────────────────────────────────────────────────
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// ── Paeth predictor (PNG spec) ─────────────────────────────────────────────
function paeth(a, b, c) {
  const p  = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

// ── decode PNG buffer → { width, height, rgba: Uint8Array } ───────────────
// Supported color types: 2 (RGB), 6 (RGBA), 0 (greyscale), 4 (grey+alpha)
// Bit depth: 8 only. Non-interlaced only.
function decodePNG(buf) {
  if (!buf.slice(0, 8).equals(PNG_SIG)) throw new Error('not a valid PNG');

  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatParts = [];
  let   plte      = null; // palette for indexed (type 3)

  let pos = 8;
  while (pos + 12 <= buf.length) {
    const dataLen = buf.readUInt32BE(pos);     pos += 4;
    const type    = buf.slice(pos, pos + 4).toString('ascii'); pos += 4;
    const data    = buf.slice(pos, pos + dataLen);             pos += dataLen;
    pos += 4; // CRC (not validated)

    switch (type) {
      case 'IHDR':
        width     = data.readUInt32BE(0);
        height    = data.readUInt32BE(4);
        bitDepth  = data[8];
        colorType = data[9];
        if (data[10] !== 0) throw new Error('unsupported PNG compression');
        if (data[11] !== 0) throw new Error('unsupported PNG filter method');
        if (data[12] !== 0) throw new Error('interlaced PNG not supported');
        if (bitDepth !== 8) throw new Error(`unsupported bit depth: ${bitDepth}`);
        break;
      case 'PLTE':
        plte = data; // RGB triplets
        break;
      case 'IDAT':
        idatParts.push(data);
        break;
      case 'IEND':
        pos = buf.length; // done
        break;
    }
  }

  if (!width || !height) throw new Error('PNG IHDR missing');
  if (idatParts.length === 0) throw new Error('PNG has no IDAT');

  // number of channels in the raw filtered data
  const srcChannels = [1, 0, 3, 1, 2, 0, 4][colorType]; // indexed by colorType
  if (!srcChannels) throw new Error(`unsupported PNG color type: ${colorType}`);

  const raw    = zlib.inflateSync(Buffer.concat(idatParts));
  const stride = width * srcChannels; // bytes per decoded row (excl. filter byte)
  const src    = new Uint8Array(height * stride);

  let rawPos = 0;
  for (let y = 0; y < height; y++) {
    const filt    = raw[rawPos++];
    const prevRow = y > 0 ? src.subarray((y - 1) * stride, y * stride)
                          : new Uint8Array(stride);
    const currRow = src.subarray(y * stride, (y + 1) * stride);

    for (let x = 0; x < stride; x++) {
      const b0 = raw[rawPos++];
      const a  = x >= srcChannels ? currRow[x - srcChannels] : 0;
      const b  = prevRow[x];
      const c  = x >= srcChannels ? prevRow[x - srcChannels] : 0;

      switch (filt) {
        case 0: currRow[x] = b0;                              break;
        case 1: currRow[x] = (b0 + a)          & 0xFF;       break;
        case 2: currRow[x] = (b0 + b)          & 0xFF;       break;
        case 3: currRow[x] = (b0 + ((a+b)>>1)) & 0xFF;       break;
        case 4: currRow[x] = (b0 + paeth(a, b, c)) & 0xFF;   break;
        default: throw new Error(`unknown PNG filter: ${filt}`);
      }
    }
  }

  // ── convert every colour type to RGBA ────────────────────────────────────
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * srcChannels;
      const di = (y * width + x) * 4;
      switch (colorType) {
        case 0: { // greyscale
          const v = src[si];
          rgba[di]=v; rgba[di+1]=v; rgba[di+2]=v; rgba[di+3]=255;
          break;
        }
        case 2: { // RGB
          rgba[di]=src[si]; rgba[di+1]=src[si+1]; rgba[di+2]=src[si+2]; rgba[di+3]=255;
          break;
        }
        case 3: { // indexed — look up in PLTE
          const idx = src[si] * 3;
          rgba[di]=plte[idx]; rgba[di+1]=plte[idx+1]; rgba[di+2]=plte[idx+2]; rgba[di+3]=255;
          break;
        }
        case 4: { // greyscale+alpha
          const v = src[si];
          rgba[di]=v; rgba[di+1]=v; rgba[di+2]=v; rgba[di+3]=src[si+1];
          break;
        }
        case 6: { // RGBA
          rgba[di]=src[si]; rgba[di+1]=src[si+1]; rgba[di+2]=src[si+2]; rgba[di+3]=src[si+3];
          break;
        }
      }
    }
  }

  return { width, height, rgba };
}

// ── bilinear sample at fractional image coordinates ───────────────────────
function sample(img, fx, fy) {
  const { width, height, rgba } = img;
  const x0 = Math.max(0, Math.min(width  - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(fy)));
  const x1 = Math.min(width  - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = fx - Math.floor(fx);
  const ty = fy - Math.floor(fy);

  const p = (x, y) => {
    const i = (y * width + x) * 4;
    return [rgba[i], rgba[i+1], rgba[i+2], rgba[i+3]];
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const bilerp = (c) => lerp(
    lerp(p(x0,y0)[c], p(x1,y0)[c], tx),
    lerp(p(x0,y1)[c], p(x1,y1)[c], tx),
    ty
  );

  return {
    r: Math.round(bilerp(0)),
    g: Math.round(bilerp(1)),
    b: Math.round(bilerp(2)),
    a: Math.round(bilerp(3)),
  };
}

// blend RGBA pixel over opaque background (default: dark #1a1a1a for terminal)
function blend(px, bgR = 26, bgG = 26, bgB = 26) {
  const a = px.a / 255;
  return {
    r: Math.round(px.r * a + bgR * (1 - a)),
    g: Math.round(px.g * a + bgG * (1 - a)),
    b: Math.round(px.b * a + bgB * (1 - a)),
  };
}

// ── main render: PNG buffer → array of ANSI-colored terminal lines ─────────
// cols  = character columns (each col = one ▀ char)
// rows  = terminal rows (each row = 2 pixel rows via half-block)
function renderHalfBlock(img, cols = 22, rows = 11) {
  const lines = [];
  for (let ty = 0; ty < rows; ty++) {
    let line = '';
    for (let tx = 0; tx < cols; tx++) {
      // map terminal cell (tx, ty*2) and (tx, ty*2+1) to image coords
      const fx = (tx + 0.5) / cols * img.width;
      const uf = sample(img, fx, (ty * 2 + 0.5) / (rows * 2) * img.height);
      const lf = sample(img, fx, (ty * 2 + 1.5) / (rows * 2) * img.height);
      const u  = blend(uf);
      const l  = blend(lf);
      // FG = upper pixel, BG = lower pixel, char = ▀
      line += `\x1b[38;2;${u.r};${u.g};${u.b}m\x1b[48;2;${l.r};${l.g};${l.b}m\u2580`;
    }
    line += '\x1b[0m';
    lines.push(line);
  }
  return lines;
}

// ── public: fetch URL + decode + render ───────────────────────────────────
// Returns null on any failure (caller decides whether to skip or error)
async function avatarLines(url, cols = 22, rows = 11) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    if (!res.ok) return null;
    const ab  = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    const img = decodePNG(buf);
    return renderHalfBlock(img, cols, rows);
  } catch (_) {
    return null;
  }
}

module.exports = { avatarLines };
