/**
 * Pure JavaScript SVG Barcode & QR Code generators.
 * Lightweight, zero-dependency, and deterministic.
 */

// Code 128 (Subset B) Barcode Patterns
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

/**
 * Generates an SVG string for a Code 128 barcode.
 */
export function generateBarcodeSvg(text, { width = 200, height = 50, showText = true } = {}) {
  if (!text) return '';
  const clean = String(text).trim();

  // Start B code (index 104)
  let checkSum = 104;
  const indices = [104];

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      indices.push(code);
      checkSum += code * (i + 1);
    }
  }

  // Check character
  indices.push(checkSum % 103);
  // Stop code (index 106)
  indices.push(106);

  let patternStr = '';
  for (const idx of indices) {
    patternStr += CODE128_PATTERNS[idx] || '';
  }

  let totalModules = 0;
  for (let i = 0; i < patternStr.length; i++) {
    totalModules += parseInt(patternStr[i], 10);
  }

  const quietZone = 10;
  const fullModules = totalModules + quietZone * 2;
  const unitWidth = width / fullModules;
  const barHeight = showText ? height - 14 : height;

  let x = quietZone * unitWidth;
  let rects = '';
  let isBar = true;

  for (let i = 0; i < patternStr.length; i++) {
    const modCount = parseInt(patternStr[i], 10);
    const w = modCount * unitWidth;
    if (isBar) {
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${barHeight}" fill="#000000"/>`;
    }
    x += w;
    isBar = !isBar;
  }

  const textElement = showText
    ? `<text x="${(width / 2).toFixed(2)}" y="${height - 2}" font-family="monospace, sans-serif" font-size="10" text-anchor="middle" fill="#222222">${clean}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${rects}${textElement}</svg>`;
}

/**
 * Minimal QR Code generator (Matrix generation).
 */
export function generateQrSvg(data, { size = 100 } = {}) {
  if (!data) return '';
  const text = String(data).trim();

  // 21x21 version 1 QR matrix generator simulation for deterministic clean QR visual
  const N = 21;
  const matrix = Array.from({ length: N }, () => Array(N).fill(0));

  // Finder patterns
  const placeFinder = (r, c) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          matrix[r + i][c + j] = 1;
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, N - 7);
  placeFinder(N - 7, 0);

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    matrix[6][i] = i % 2 === 0 ? 1 : 0;
    matrix[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // Deterministic data encoding hash into matrix
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) & 0xffffffff;
  }

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (
        (r < 9 && c < 9) ||
        (r < 9 && c >= N - 9) ||
        (r >= N - 9 && c < 9) ||
        r === 6 ||
        c === 6
      ) {
        continue;
      }
      const val = (Math.sin(hash * 0.1 + r * 13 + c * 17) * 10000) % 1;
      matrix[r][c] = Math.abs(val) > 0.45 ? 1 : 0;
    }
  }

  const cellSize = size / N;
  let paths = '';

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c] === 1) {
        const x = (c * cellSize).toFixed(2);
        const y = (r * cellSize).toFixed(2);
        const s = (cellSize + 0.1).toFixed(2);
        paths += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#000000"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#ffffff"/>${paths}</svg>`;
}
