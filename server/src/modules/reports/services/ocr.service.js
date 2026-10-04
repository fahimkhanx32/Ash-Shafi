import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import env from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

const execFileAsync = promisify(execFile);

/**
 * BET-12.7/12.35 — OCR Provider Abstraction.
 *
 * `runOcr()` is the only function the rest of the report pipeline
 * calls (`report.service.js`) — nothing outside this file knows
 * `tesseract`/`pdftoppm` exist. Adding a future cloud OCR vendor
 * means adding a new entry to `PROVIDERS` and pointing `OCR_PROVIDER`
 * at it; no other module changes.
 *
 * This never throws for an ordinary OCR failure (missing binary,
 * unreadable image, provider error) — it always resolves to a
 * `{ status: 'FAILED', error }`-shaped result so the caller can move
 * the report to `EXTRACTION_FAILED` (a legitimate lifecycle state,
 * master prompt §BET-12.26) rather than crash the request. It *does*
 * throw for a genuine programming error (e.g. an unreadable buffer
 * argument) — those are bugs, not OCR failures.
 */

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_MIME_TYPE = 'application/pdf';

const LANGUAGE_ALIASES = Object.freeze({
  en: 'eng',
  bn: 'ben',
});

const normalizeLanguage = (language) =>
  String(language || env.ocr.defaultLanguages || 'eng')
    .split('+')
    .map((part) => LANGUAGE_ALIASES[part.trim().toLowerCase()] || part.trim())
    .filter(Boolean)
    .join('+') || 'eng';


const makeTempDir = async () => {
  const dir = path.join(os.tmpdir(), `ashshafi-ocr-${crypto.randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const cleanupDir = async (dir) => {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (error) {
    logger.warn({ err: error, dir }, 'Failed to clean up OCR temp directory.');
  }
};

/**
 * Runs `tesseract` against a single image file and returns
 * `{ text, confidence }`. Confidence is the mean of per-word
 * confidences reported in tesseract's TSV output (excluding the -1
 * "no confidence" rows structural/header rows carry) — a real,
 * provider-reported number, never fabricated.
 */
const tesseractOnImage = async (imagePath, language) => {
  const outputBase = imagePath.replace(/\.[^.]+$/, '');

  await execFileAsync(
    env.ocr.tesseractBin,
    [imagePath, outputBase, '-l', language, '--psm', '3', 'tsv'],
    { timeout: env.ocr.timeoutMs },
  );

  const tsv = await fs.readFile(`${outputBase}.tsv`, 'utf8');
  const rows = tsv.split('\n').slice(1).filter(Boolean);

  const words = [];
  const confidences = [];

  for (const row of rows) {
    const cols = row.split('\t');
    // Standard tesseract TSV: 12 columns, text is the last, conf is column 11 (0-indexed 10).
    if (cols.length < 12) continue;
    const conf = Number(cols[10]);
    const text = cols[11];
    if (!text || !text.trim()) continue;
    words.push(text);
    if (conf >= 0) confidences.push(conf);
  }

  const text = words.join(' ').trim();
  const confidence =
    confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length / 100
      : null;

  return { text, confidence };
};

/**
 * Rasterizes every page of a PDF to PNG via `pdftoppm`, then runs
 * `tesseractOnImage` on each page in turn, concatenating text and
 * averaging confidence across pages. Used only as a fallback when
 * the PDF has no usable text layer (see `report.service.js`'s
 * `pdf-parse` fast path) — i.e. this is specifically for scanned
 * PDFs (master prompt §BET-12.7 "PDF OCR").
 */
const tesseractOnPdf = async (pdfPath, language, tempDir) => {
  const pagePrefix = path.join(tempDir, 'page');

  await execFileAsync(
    env.ocr.pdftoppmBin,
    ['-png', '-r', '200', pdfPath, pagePrefix],
    { timeout: env.ocr.timeoutMs },
  );

  const files = (await fs.readdir(tempDir))
    .filter((f) => f.startsWith('page') && f.endsWith('.png'))
    .sort();

  if (files.length === 0) {
    throw new Error('PDF rasterization produced no pages.');
  }

  const pageTexts = [];
  const pageConfidences = [];

  for (const file of files) {
    const { text, confidence } = await tesseractOnImage(path.join(tempDir, file), language);
    if (text) pageTexts.push(text);
    if (confidence !== null) pageConfidences.push(confidence);
  }

  return {
    text: pageTexts.join('\n\n'),
    confidence:
      pageConfidences.length > 0
        ? pageConfidences.reduce((s, c) => s + c, 0) / pageConfidences.length
        : null,
    pageCount: files.length,
  };
};

const tesseractProvider = {
  name: 'tesseract',
  version: '5', // reported by `tesseract --version`, not verified per-call for performance

  async extract({ buffer, mimeType, language }) {
    if (!IMAGE_MIME_TYPES.has(mimeType) && mimeType !== PDF_MIME_TYPE) {
      return {
        status: 'UNSUPPORTED',
        error: 'This file type is not eligible for OCR; use manual entry instead.',
      };
    }

    const tempDir = await makeTempDir();

    try {
      if (mimeType === PDF_MIME_TYPE) {
        const inputPath = path.join(tempDir, 'input.pdf');
        await fs.writeFile(inputPath, buffer);
        const { text, confidence, pageCount } = await tesseractOnPdf(inputPath, language, tempDir);
        return { status: 'COMPLETED', text, confidence, pageCount };
      }

      const extension = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
      const inputPath = path.join(tempDir, `input${extension}`);
      await fs.writeFile(inputPath, buffer);
      const { text, confidence } = await tesseractOnImage(inputPath, language);
      return { status: 'COMPLETED', text, confidence, pageCount: 1 };
    } catch (error) {
      logger.error({ err: error, mimeType }, 'Tesseract OCR extraction failed.');
      return {
        status: 'FAILED',
        error:
          error.code === 'ENOENT'
            ? 'OCR engine is not available on this server.'
            : 'OCR processing failed for this document.',
      };
    } finally {
      await cleanupDir(tempDir);
    }
  },
};

const PROVIDERS = Object.freeze({
  tesseract: tesseractProvider,
});

export const getOcrProvider = () => {
  const provider = PROVIDERS[env.ocr.provider];
  if (!provider) {
    throw new Error(`Unknown OCR_PROVIDER "${env.ocr.provider}".`);
  }
  return provider;
};

/**
 * `language`: tesseract-style '+'-joined codes (e.g. 'eng+ben'). Falls
 * back to `env.ocr.defaultLanguages` when not supplied — BET-12.9's
 * "OCR language should be associated with the extraction request
 * where appropriate".
 */
export const runOcr = async ({ buffer, mimeType, language }) => {
  const provider = getOcrProvider();
  const resolvedLanguage = normalizeLanguage(language);

  const result = await provider.extract({ buffer, mimeType, language: resolvedLanguage });

  return {
    provider: provider.name,
    providerVersion: provider.version,
    language: resolvedLanguage,
    ...result,
  };
};
