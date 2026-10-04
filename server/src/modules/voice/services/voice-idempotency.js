/**
 * Duplicate-call protection for voice tools that create money records
 * (master prompt §67).
 *
 * A voice/network retry can deliver the same confirmed call twice
 * ("Create the invoice." heard again). Within a short window, an
 * identical call by the same user (same tool, same validated args) does
 * NOT run again: a concurrent duplicate waits for the first call's
 * outcome, a later one gets the stored result. Failures are never
 * remembered, so a failed attempt can always be retried.
 *
 * Deliberate limits, stated plainly:
 *  - In-memory and per server process. With several server instances a
 *    retry that lands on a different instance is NOT caught.
 *  - Two genuinely identical actions inside the window (e.g. two 500-taka
 *    payments a minute apart) are treated as one; the doctor is told so
 *    and can wait out the window or vary the request.
 */
const TTL_MS = 120_000;
const MAX_ENTRIES = 500;
const store = new Map(); // key -> { promise, expiresAt }

const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
};

export const buildIdempotencyKey = (actorId, toolName, args) => {
  const { confirmed: _c, ...rest } = args || {};
  return `${String(actorId)}|${toolName}|${stable(rest)}`;
};

const purge = (now) => {
  for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
};

export const runOnce = async (key, fn, { ttlMs = TTL_MS, now = Date.now } = {}) => {
  purge(now());
  const hit = store.get(key);
  if (hit) return { result: await hit.promise, duplicate: true };

  const promise = Promise.resolve().then(fn);
  store.set(key, { promise, expiresAt: now() + ttlMs });
  try {
    return { result: await promise, duplicate: false };
  } catch (err) {
    store.delete(key); // never remember a failure
    throw err;
  }
};

export const _resetIdempotencyStoreForTests = () => store.clear();
