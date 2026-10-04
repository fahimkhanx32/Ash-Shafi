/**
 * BET-18 — Dependency-free ZIP archive writer.
 *
 * Mirrors the dependency-free-ZIP-handling convention this project
 * already established for reading (`modules/reports/services/
 * spreadsheet-extraction.service.js`'s `readZipEntries`, reused by
 * `office-metadata.service.js`) — this is the write-side counterpart,
 * needed because a database backup has to be packaged as a single
 * archive before it can be encrypted and uploaded, and no archive
 * library (`archiver`, `adm-zip`, etc.) is a dependency of this
 * project.
 *
 * Entries are stored uncompressed (`STORED`, method 0) rather than
 * DEFLATEd. A JSON dump of clinical/database records compresses well,
 * but the backup is encrypted immediately after this step anyway
 * (AES-GCM output is high-entropy and doesn't benefit from prior
 * compression), and STORED keeps this file simple, fast, and free of
 * any dependency on `zlib`'s raw-deflate framing being byte-exact —
 * exactly the same "safety and simplicity over cleverness" choice the
 * read-side reader already made for `compression === 0` support.
 * Every entry this writer produces is readable by `readZipEntries`
 * and by any standard unzip tool.
 */

import { createHash } from 'node:crypto';

// Standard reflected CRC-32 (ISO 3309 / ITU-T V.42), IEEE polynomial
// 0xEDB88320 — no built-in Node API computes this, so it's
// implemented directly rather than adding a dependency for one
// checksum.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date = new Date()) => {
  const dosTime =
    ((date.getHours() & 0x1f) << 11) |
    ((date.getMinutes() & 0x3f) << 5) |
    ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) |
    (((date.getMonth() + 1) & 0x0f) << 5) |
    (date.getDate() & 0x1f);
  return { dosTime, dosDate };
};

/**
 * @param {{ name: string, buffer: Buffer }[]} entries
 * @returns {Buffer} a valid, standard ZIP archive
 */
export const createZipArchive = (entries) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('createZipArchive requires at least one entry.');
  }

  const { dosTime, dosDate } = dosDateTime();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, buffer } of entries) {
    if (typeof name !== 'string' || !name) {
      throw new Error('Every ZIP entry needs a non-empty name.');
    }
    if (!Buffer.isBuffer(buffer)) {
      throw new Error(`ZIP entry "${name}" must be a Buffer.`);
    }

    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(buffer);
    const size = buffer.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // method: STORED
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // compressed size
    localHeader.writeUInt32LE(size, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBuf, buffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // central directory signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // method: STORED
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + buffer.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localSection = Buffer.concat(localParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localSection.length, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localSection, centralDirectory, eocd]);
};

/** SHA-256 checksum of a buffer, hex-encoded — used for backup integrity verification. */
export const sha256Hex = (buffer) => createHash('sha256').update(buffer).digest('hex');
