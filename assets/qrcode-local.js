(() => {
  'use strict';

  // Pure-JS ISO/IEC 18004 QR Code encoder (Byte mode, ECC M, Versions 1..12 up to 290 UTF-8 bytes)
  const QR_SPECS = [
    null,
    [16, 10, 1],   // V1
    [28, 16, 1],   // V2
    [44, 26, 1],   // V3
    [64, 18, 2],   // V4
    [86, 24, 2],   // V5
    [108, 16, 4],  // V6
    [124, 18, 4],  // V7
    [154, 22, 4],  // V8
    [182, 22, 5],  // V9
    [216, 26, 5],  // V10
    [254, 30, 5],  // V11
    [290, 22, 8]   // V12
  ];

  const ALIGN_POS = [
    null,
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
    [6, 30, 54],
    [6, 32, 58]
  ];

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    return (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGenPoly(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    const gen = rsGenPoly(ecLen);
    const buf = data.concat(new Array(ecLen).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = buf[i];
      if (coef !== 0) {
        for (let j = 1; j < gen.length; j++) {
          buf[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return buf.slice(data.length);
  }

  function versionBits(ver) {
    let d = ver << 12;
    const gen = 0x1f25;
    for (let i = 17; i >= 12; i--) {
      if ((d >>> i) & 1) d ^= gen << (i - 12);
    }
    return (ver << 12) | d;
  }

  function formatBits(maskId) {
    const data = (0 << 3) | (maskId & 7); // ECC M = 00
    let d = data << 10;
    const gen = 0b10100110111;
    for (let i = 14; i >= 10; i--) {
      if ((d >> i) & 1) d ^= gen << (i - 10);
    }
    return ((data << 10) | d) ^ 0b101010000010010;
  }

  function encodeBytes(text) {
    const raw = new TextEncoder().encode(String(text));
    let ver = -1;
    for (let v = 1; v < QR_SPECS.length; v++) {
      const countBits = v >= 10 ? 16 : 8;
      const neededBytes = Math.ceil((4 + countBits + raw.length * 8) / 8);
      if (neededBytes <= QR_SPECS[v][0]) {
        ver = v;
        break;
      }
    }
    if (ver < 0) throw new Error('Text too long for QR V1..V12');

    const [cap, ecLen, numBlocks] = QR_SPECS[ver];
    const bits = [];
    const push = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    push(0b0100, 4);
    push(raw.length, ver >= 10 ? 16 : 8);
    for (const b of raw) push(b, 8);
    const term = Math.min(4, cap * 8 - bits.length);
    push(0, term);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      dataCw.push(v);
    }
    const pads = [0xec, 0x11];
    let pIdx = 0;
    while (dataCw.length < cap) {
      dataCw.push(pads[pIdx & 1]);
      pIdx++;
    }

    const baseLen = Math.floor(cap / numBlocks);
    const rem = cap % numBlocks;
    const dBlocks = [];
    const eBlocks = [];
    let pos = 0;
    for (let b = 0; b < numBlocks; b++) {
      const blen = baseLen + (b >= numBlocks - rem ? 1 : 0);
      const blk = dataCw.slice(pos, pos + blen);
      pos += blen;
      dBlocks.push(blk);
      eBlocks.push(rsEncode(blk, ecLen));
    }

    const final = [];
    const maxD = Math.max(...dBlocks.map(b => b.length));
    for (let i = 0; i < maxD; i++) {
      for (const blk of dBlocks) if (i < blk.length) final.push(blk[i]);
    }
    for (let i = 0; i < ecLen; i++) {
      for (const ec of eBlocks) final.push(ec[i]);
    }

    const outBits = [];
    for (const cw of final) {
      for (let sh = 7; sh >= 0; sh--) outBits.push((cw >> sh) & 1);
    }
    return { ver, bits: outBits };
  }

  function penalty(mat) {
    const n = mat.length;
    let score = 0;
    for (let r = 0; r < n; r++) {
      let run = 1;
      for (let c = 1; c < n; c++) {
        if (mat[r][c] === mat[r][c - 1]) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (let c = 0; c < n; c++) {
      let run = 1;
      for (let r = 1; r < n; r++) {
        if (mat[r][c] === mat[r - 1][c]) run++;
        else { if (run >= 5) score += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const v = mat[r][c];
        if (v === mat[r][c + 1] && v === mat[r + 1][c] && v === mat[r + 1][c + 1]) score += 3;
      }
    }
    const isP1 = (arr, i) => arr[i]===1 && arr[i+1]===0 && arr[i+2]===1 && arr[i+3]===1 && arr[i+4]===1 && arr[i+5]===0 && arr[i+6]===1 && arr[i+7]===0 && arr[i+8]===0 && arr[i+9]===0 && arr[i+10]===0;
    const isP2 = (arr, i) => arr[i]===0 && arr[i+1]===0 && arr[i+2]===0 && arr[i+3]===0 && arr[i+4]===1 && arr[i+5]===0 && arr[i+6]===1 && arr[i+7]===1 && arr[i+8]===1 && arr[i+9]===0 && arr[i+10]===1;
    for (let r = 0; r < n; r++) {
      const row = mat[r];
      for (let c = 0; c <= n - 11; c++) {
        if (isP1(row, c) || isP2(row, c)) score += 40;
      }
    }
    const colBuf = new Uint8Array(n);
    for (let c = 0; c < n; c++) {
      for (let r = 0; r < n; r++) colBuf[r] = mat[r][c];
      for (let r = 0; r <= n - 11; r++) {
        if (isP1(colBuf, r) || isP2(colBuf, r)) score += 40;
      }
    }
    let dark = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += mat[r][c];
    const pct = Math.floor((dark * 100) / (n * n));
    const prev5 = Math.floor(pct / 5) * 5;
    score += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(prev5 + 5 - 50) / 5) * 10;
    return score;
  }

  function encodeMatrix(text) {
    const { ver, bits } = encodeBytes(text);
    const size = ver * 4 + 17;
    const base = Array.from({ length: size }, () => new Array(size).fill(0));
    const func = Array.from({ length: size }, () => new Array(size).fill(false));

    const putFunc = (r, c, val) => {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        base[r][c] = val;
        func[r][c] = true;
      }
    };

    const addFinder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = r0 + dr, c = c0 + dc;
          if (r >= 0 && r < size && c >= 0 && c < size) {
            const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
            const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
            const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
            putFunc(r, c, (inOuter && (onBorder || inCenter)) ? 1 : 0);
          }
        }
      }
    };

    addFinder(0, 0);
    addFinder(0, size - 7);
    addFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      putFunc(6, i, 1 - (i & 1));
      putFunc(i, 6, 1 - (i & 1));
    }

    const centers = ALIGN_POS[ver];
    for (const r0 of centers) {
      for (const c0 of centers) {
        if (!func[r0][c0]) {
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const on = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
              putFunc(r0 + dr, c0 + dc, on ? 1 : 0);
            }
          }
        }
      }
    }

    putFunc(size - 8, 8, 1);
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        putFunc(8, i, 0);
        putFunc(i, 8, 0);
      }
    }
    for (let i = 0; i < 8; i++) putFunc(8, size - 1 - i, 0);
    for (let i = 0; i < 7; i++) putFunc(size - 1 - i, 8, 0);

    if (ver >= 7) {
      const vbits = versionBits(ver);
      for (let i = 0; i < 18; i++) {
        const bit = (vbits >>> i) & 1;
        const r = Math.floor(i / 3);
        const c = size - 11 + (i % 3);
        putFunc(r, c, bit);
        putFunc(c, r, bit);
      }
    }

    const coords = [];
    let up = true;
    let col = size - 1;
    while (col > 0) {
      if (col === 6) col--;
      for (let idxR = 0; idxR < size; idxR++) {
        const r = up ? (size - 1 - idxR) : idxR;
        for (const dc of [0, -1]) {
          const c = col + dc;
          if (!func[r][c]) coords.push([r, c]);
        }
      }
      col -= 2;
      up = !up;
    }

    for (let i = 0; i < coords.length; i++) {
      const [r, c] = coords[i];
      base[r][c] = i < bits.length ? bits[i] : 0;
    }

    const maskFns = [
      (r, c) => (r + c) % 2 === 0,
      (r, _c) => r % 2 === 0,
      (_r, c) => c % 3 === 0,
      (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
      (r, c) => ((r * c) % 2 + (r * c) % 3) === 0,
      (r, c) => (((r * c) % 2 + (r * c) % 3) % 2) === 0,
      (r, c) => (((r + c) % 2 + (r * c) % 3) % 2) === 0
    ];

    let bestMat = base;
    let bestPen = 1 << 30;
    for (let mid = 0; mid < maskFns.length; mid++) {
      const cand = base.map(row => row.slice());
      const mfn = maskFns[mid];
      for (const [r, c] of coords) {
        if (mfn(r, c)) cand[r][c] ^= 1;
      }
      const fmt = formatBits(mid);
      for (let k = 0; k < 15; k++) {
        const bit = (fmt >> k) & 1;
        if (k < 6) cand[8][k] = bit;
        else if (k < 8) cand[8][k + 1] = bit;
        else cand[8][size - 15 + k] = bit;

        if (k < 8) cand[size - 1 - k][8] = bit;
        else if (k < 9) cand[15 - k][8] = bit;
        else cand[14 - k][8] = bit;
      }
      const pen = penalty(cand);
      if (pen < bestPen) {
        bestPen = pen;
        bestMat = cand;
      }
    }
    return bestMat;
  }

  function toDataURL(text, targetPx = 280) {
    const mat = encodeMatrix(text);
    const n = mat.length;
    const quiet = 3;
    const scale = Math.max(4, Math.floor(targetPx / (n + quiet * 2)));
    const dim = (n + quiet * 2) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#111111';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (mat[r][c]) {
          ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    }
    return canvas.toDataURL('image/png');
  }

  window.TBOX_QR = { encodeMatrix, encodeBytes, toDataURL };
})();
