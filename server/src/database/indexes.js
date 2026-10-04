import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import mongoose from 'mongoose';

import {
  connectDatabase,
  disconnectDatabase,
} from '../config/database.js';

/**
 * Database index-creation script (BET-23 — Query Optimization /
 * Database Indexes).
 *
 * Previously this script only called `.createIndexes()` on two
 * models (`User`, `Role`) — every other model's schema-declared
 * indexes were only ever built implicitly by Mongoose's `autoIndex`
 * default, which BET-23 now disables in production (see
 * `config/database.js`). Without a script covering every model,
 * disabling `autoIndex` in production would have silently stopped
 * indexes from ever being created there at all.
 *
 * This script instead:
 *   1. Recursively discovers every `*.model.js` file under `src/`.
 *   2. Dynamically imports each one, so every schema registers
 *      itself with Mongoose regardless of which module owns it.
 *   3. Calls `.createIndexes()` on every model Mongoose now knows
 *      about, reporting each one's outcome independently — a single
 *      model failing to build (e.g. a duplicate-key collision on a
 *      partial unique index against existing data) must not silently
 *      hide every other model's result, and must not stop the run.
 *
 * Intended to be run explicitly, in a controlled deployment step —
 * `npm run indexes` — not implicitly on every server boot.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..');

/**
 * Recursively find every file under `dir` matching `*.model.js`.
 */
const findModelFiles = (dir) => {
  const results = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...findModelFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.model.js')) {
      results.push(fullPath);
    }
  }

  return results;
};

/**
 * Import every discovered model file so its schema registers with
 * Mongoose. Import failures are collected, not thrown — one broken
 * module shouldn't prevent every other model's indexes from being
 * built and reported on.
 */
const registerAllModels = async () => {
  const modelFiles = findModelFiles(SRC_ROOT).sort();

  const importFailures = [];

  for (const filePath of modelFiles) {
    try {
      await import(pathToFileURL(filePath).href);
    } catch (error) {
      importFailures.push({
        file: path.relative(SRC_ROOT, filePath),
        error: error.message,
      });
    }
  }

  return { modelFileCount: modelFiles.length, importFailures };
};

const createIndexes = async () => {
  const results = {
    succeeded: [],
    failed: [],
  };

  try {
    await connectDatabase();

    const { modelFileCount, importFailures } = await registerAllModels();

    console.log(
      `Discovered ${modelFileCount} model file(s) under src/.`,
    );

    if (importFailures.length > 0) {
      console.error(
        `${importFailures.length} model file(s) failed to import and were skipped:`,
      );
      importFailures.forEach(({ file, error }) => {
        console.error(`  - ${file}: ${error}`);
      });
    }

    const modelNames = mongoose.modelNames().sort();

    console.log(
      `Building indexes for ${modelNames.length} registered model(s)...`,
    );

    for (const modelName of modelNames) {
      const start = Date.now();

      try {
        // eslint-disable-next-line no-await-in-loop
        await mongoose.model(modelName).createIndexes();

        const durationMs = Date.now() - start;

        results.succeeded.push({ modelName, durationMs });

        console.log(
          `  ok   ${modelName} (${durationMs}ms)`,
        );
      } catch (error) {
        results.failed.push({ modelName, error: error.message });

        console.error(
          `  fail ${modelName}: ${error.message}`,
        );
      }
    }

    console.log('');
    console.log(
      `Index build complete: ${results.succeeded.length} succeeded, ${results.failed.length} failed, ${importFailures.length} model file(s) skipped on import.`,
    );

    if (results.failed.length > 0 || importFailures.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      'Database index creation failed:',
      error,
    );

    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

createIndexes();
