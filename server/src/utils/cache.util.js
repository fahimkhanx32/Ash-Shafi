import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';

/**
 * Generic read-through cache utility (BET-23 — Caching where
 * appropriate).
 *
 * Design constraints, deliberately mirroring the fail-safe convention
 * already established by this project's audit/logging layers
 * (`audit/audit.service.js`, `auth/security-event.model.js`, etc — a
 * write to a secondary system must never throw and must never block
 * or corrupt the primary request):
 *
 *   - Redis is optional in this project (`REDIS_ENABLED=false` by
 *     default — see `config/redis.js`). Every function here is a
 *     silent no-op when Redis is disabled or the client isn't
 *     connected, so callers never need to branch on whether caching
 *     is actually active.
 *   - A cache read/write failure is caught and logged, never thrown —
 *     a Redis hiccup must degrade to "always hit the database", not
 *     take the endpoint down.
 *   - Deliberately NOT used for anything patient-identifiable or
 *     access-controlled. Every current caller of this utility
 *     (public, published CMS pages) is content any unauthenticated
 *     visitor can already read directly from the same public route —
 *     caching it introduces no new exposure. Do not point this at
 *     clinical, financial, or any permission-gated read without
 *     re-reviewing that constraint, since a cached response bypasses
 *     the per-request authorization check that would otherwise run
 *     against fresh data.
 *
 * Usage:
 *   const value = await getOrSetCache('cms:pages:public:home', 300,
 *     () => pageService.getPublishedPageBySlug('home'));
 */

const buildKey = (key) => `cache:${key}`;

/**
 * Read `key` from cache if present and not expired; otherwise call
 * `loader()`, cache its result for `ttlSeconds`, and return it.
 *
 * @param {string} key - Cache key (namespaced internally).
 * @param {number} ttlSeconds - Time-to-live in seconds.
 * @param {() => Promise<any>} loader - Called on a cache miss.
 * @returns {Promise<any>}
 */
export const getOrSetCache = async (key, ttlSeconds, loader) => {
  const client = getRedisClient();

  if (!client?.isReady) {
    return loader();
  }

  const cacheKey = buildKey(key);

  try {
    const cached = await client.get(cacheKey);

    if (cached !== null) {
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn({ err: error, cacheKey }, 'Cache read failed; falling back to source.');
  }

  const value = await loader();

  try {
    await client.set(cacheKey, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    logger.warn({ err: error, cacheKey }, 'Cache write failed; response was still served.');
  }

  return value;
};

/**
 * Invalidate every cached key under a prefix (e.g. `cms:pages:public`).
 * Used after any mutation that could make a cached response stale —
 * simpler and safer than tracking per-entry dependencies for
 * low-write-frequency content like CMS pages.
 *
 * @param {string} prefix
 * @returns {Promise<void>}
 */
export const invalidateCachePrefix = async (prefix) => {
  const client = getRedisClient();

  if (!client?.isReady) {
    return;
  }

  const pattern = `${buildKey(prefix)}*`;

  try {
    let cursor = 0;

    do {
      // eslint-disable-next-line no-await-in-loop
      const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
      cursor = result.cursor;

      if (result.keys.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        await client.del(result.keys);
      }
    } while (cursor !== 0);
  } catch (error) {
    logger.warn({ err: error, prefix }, 'Cache invalidation failed; stale entries will still expire via TTL.');
  }
};

export default { getOrSetCache, invalidateCachePrefix };
