/**
 * QR code encoder, no dependencies (REQ-105). Byte mode, error-correction level M, versions 1 to
 * 10 (up to 213 bytes: ample for a buyer link). The structure follows ISO/IEC 18004; correctness
 * is checked at development time by decoding generated codes with an independent decoder.
 */

/* Per version, level M: [data codewords per block, number of blocks] for the two block groups,
   and the error-correction codewords per block. */
const VERSIONS = {
  1: { ec: 10, groups: [[1, 16]] },
  2: { ec: 16, groups: [[1, 28]] },
  3: { ec: 26, groups: [[1, 44]] },
  4: { ec: 18, groups: [[2, 32]] },
  5: { ec: 24, groups: [[2, 43]] },
  6: { ec: 16, groups: [[4, 27]] },
  7: { ec: 18, groups: [[4, 31]] },
  8: { ec: 22, groups: [[2, 38], [2, 39]] },
  9: { ec: 22, groups: [[3, 36], [2, 37]] },
  10: { ec: 26, groups: [[4, 43], [1, 44]] }
};

const ALIGNMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

const FORMAT_BITS_M = 0;

/* --- Reed-Solomon over GF(256), primitive polynomial 0x11D --- */
const multiply = (x, y) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};

const divisor = (degree) => {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = multiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = multiply(root, 2);
  }
  return result;
};

const remainder = (data, div) => {
  const result = new Array(div.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    div.forEach((coefficient, i) => { result[i] ^= multiply(coefficient, factor); });
  }
  return result;
};

const dataCapacity = (version) => VERSIONS[version].groups.reduce((sum, [blocks, size]) => sum + blocks * size, 0);

const chooseVersion = (length) => {
  for (let version = 1; version <= 10; version++) {
    const countBits = version < 10 ? 8 : 16;
    if (4 + countBits + length * 8 <= dataCapacity(version) * 8) return version;
  }
  throw new RangeError("Text too long for a QR code of version 10 (213 bytes).");
};

/** Data codewords: mode, length, bytes, terminator, padding. */
const buildDataCodewords = (bytes, version) => {
  const bits = [];
  const push = (value, count) => { for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1); };

  push(0b0100, 4);
  push(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => push(byte, 8));

  const capacityBits = dataCapacity(version) * 8;
  push(0, Math.min(4, capacityBits - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; codewords.length < dataCapacity(version); pad ^= 0xec ^ 0x11) codewords.push(pad);

  return codewords;
};

/** Splits into blocks, adds error correction and interleaves, as the standard requires. */
const interleave = (codewords, version) => {
  const { ec, groups } = VERSIONS[version];
  const div = divisor(ec);
  const blocks = [];
  let offset = 0;

  groups.forEach(([count, size]) => {
    for (let i = 0; i < count; i++) {
      const data = codewords.slice(offset, offset + size);
      offset += size;
      blocks.push({ data, ecc: remainder(data, div) });
    }
  });

  const result = [];
  const longest = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < longest; i++) blocks.forEach((b) => { if (i < b.data.length) result.push(b.data[i]); });
  for (let i = 0; i < ec; i++) blocks.forEach((b) => result.push(b.ecc[i]));
  return result;
};

/* --- Matrix --- */
const createMatrix = (version) => {
  const size = 17 + 4 * version;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFunction = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    reserved[y][x] = true;
  };

  // Timing patterns
  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // Finder patterns with their separators
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(cx + dx, cy + dy, distance !== 2 && distance !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  // Alignment patterns, skipping the three corners taken by finders
  const positions = ALIGNMENT[version];
  positions.forEach((cy, row) => {
    positions.forEach((cx, col) => {
      const corner = (row === 0 && col === 0) || (row === 0 && col === positions.length - 1) ||
                     (row === positions.length - 1 && col === 0);
      if (corner) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });

  // Reserve the format and version areas; real values are written after masking.
  drawFormat(setFunction, size, 0);
  if (version >= 7) drawVersion(setFunction, size, version);

  return { size, modules, reserved, setFunction };
};

const bit = (value, index) => ((value >>> index) & 1) !== 0;

const drawFormat = (setFunction, size, mask) => {
  const data = (FORMAT_BITS_M << 3) | mask;
  let rest = data;
  for (let i = 0; i < 10; i++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
  const bits = ((data << 10) | rest) ^ 0x5412;

  for (let i = 0; i <= 5; i++) setFunction(8, i, bit(bits, i));
  setFunction(8, 7, bit(bits, 6));
  setFunction(8, 8, bit(bits, 7));
  setFunction(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(bits, i));

  for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, bit(bits, i));
  setFunction(8, size - 8, true); // the always-dark module
};

const drawVersion = (setFunction, size, version) => {
  let rest = version;
  for (let i = 0; i < 12; i++) rest = (rest << 1) ^ ((rest >>> 11) * 0x1f25);
  const bits = (version << 12) | rest;

  for (let i = 0; i < 18; i++) {
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunction(a, b, bit(bits, i));
    setFunction(b, a, bit(bits, i));
  }
};

const placeData = ({ size, modules, reserved }, codewords) => {
  const bits = [];
  codewords.forEach((byte) => { for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1); });

  let index = 0;
  let upwards = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is skipped
    for (let step = 0; step < size; step++) {
      const y = upwards ? size - 1 - step : step;
      for (let offset = 0; offset < 2; offset++) {
        const x = right - offset;
        if (!reserved[y][x]) {
          modules[y][x] = index < bits.length ? bits[index] === 1 : false;
          index++;
        }
      }
    }
    upwards = !upwards;
  }
};

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

const applyMask = ({ size, modules, reserved }, mask) => {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
    }
  }
};

/** Penalty score of the four rules in ISO/IEC 18004: lower is easier to scan. */
const penalty = (modules) => {
  const size = modules.length;
  let score = 0;

  const lines = [];
  for (let i = 0; i < size; i++) {
    lines.push(modules[i]);
    lines.push(modules.map((row) => row[i]));
  }

  const finderLike = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true]
  ];

  lines.forEach((line) => {
    let run = 1;
    for (let i = 1; i <= line.length; i++) {
      if (i < line.length && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= line.length; i++) {
      finderLike.forEach((pattern) => {
        if (pattern.every((value, k) => line[i + k] === value)) score += 40;
      });
    }
  });

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = modules[y][x];
      if (color === modules[y][x + 1] && color === modules[y + 1][x] && color === modules[y + 1][x + 1]) score += 3;
    }
  }

  const dark = modules.flat().filter(Boolean).length;
  const total = size * size;
  score += Math.max(0, Math.ceil(Math.abs((dark * 100) / total - 50) / 5) - 1) * 10;

  return score;
};

/** The QR matrix for a text, as rows of booleans (true = dark module). */
export const qrMatrix = (text) => {
  const bytes = [...new TextEncoder().encode(text)];
  const version = chooseVersion(bytes.length);
  const codewords = interleave(buildDataCodewords(bytes, version), version);

  const base = createMatrix(version);
  placeData(base, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = {
      ...base,
      modules: base.modules.map((row) => [...row]),
      reserved: base.reserved
    };

    applyMask(candidate, mask);
    // The format bits must land in this candidate's own copy, not in the shared base matrix.
    drawFormat((x, y, on) => { candidate.modules[y][x] = on; }, candidate.size, mask);
    const score = penalty(candidate.modules);

    if (!best || score < best.score) best = { score, modules: candidate.modules };
  }

  return best.modules;
};

/** The QR code as a standalone SVG string, with the quiet zone the standard asks for. */
export const qrSvg = (text, { margin = 4, dark = "#000", light = "#fff" } = {}) => {
  const matrix = qrMatrix(text);
  const size = matrix.length + margin * 2;

  const path = matrix
    .flatMap((row, y) => row.map((on, x) => (on ? `M${x + margin},${y + margin}h1v1h-1z` : "")))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" ` +
         `role="img"><rect width="${size}" height="${size}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
};
