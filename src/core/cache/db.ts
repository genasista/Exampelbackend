import { getDb } from "@core/db";

/**
 * DB-backed cache helpers (table: app.cache)
 * ------------------------------------------
 * Key features:
 * - Values are stored as JSONB (`payload` column).
 * - Entries are considered valid only while `expires_at > NOW()` (DB clock).
 * - Reads/writes are parameterized (safe from SQL injection).
 *
 * Notes & gotchas:
 * - `cacheSet` JSON-serializes the value; make sure `value` is JSON-safe and
 *   not `undefined` (undefined becomes SQL NULL and will violate NOT NULL).
 * - We compute `expires_at` using the *app clock*. If your DB clock is ahead
 *   by a few ms, an entry written "now" might read as expired immediately.
 *   If you see MISS → MISS patterns, consider computing `expires_at` in SQL
 *   (e.g., `NOW() + make_interval(msecs => $3)`).
 */

/**
 * Read a cached value by key if it hasn't expired.
 *
 * @returns the cached payload (typed as T) or `undefined` if missing/expired.
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | undefined> {
  const db = getDb();
  const r = await db.query(
    `SELECT payload
       FROM app.cache
      WHERE key = $1
        AND expires_at > NOW()`, // expire check uses DB clock (NOW)
    [key]
  );
  if (!r.rows[0]) return undefined;
  return r.rows[0].payload as T;
}

/**
 * Upsert a cache entry with TTL.
 *
 * Behavior:
 * - Inserts (key, payload, created_at, expires_at).
 * - On conflict (same key) updates payload + expires_at.
 *
 * @param key     Stable identifier (e.g., 'courses:v1:start=0:size=50')
 * @param value   JSON-serializable payload (must not be `undefined`)
 * @param ttlMs   Time-to-live in milliseconds
 */
export async function cacheSet<T = unknown>(key: string, value: T, ttlMs: number): Promise<void> {
  const db = getDb();

  // Compute the expiry timestamp using the app clock.
  // See the module docstring for clock skew considerations.
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  // Guard: undefined serializes to undefined (→ SQL NULL) and violates NOT NULL.
  // If you expect undefined sometimes, coerce to null-safe JSON (e.g., null) upstream.
  const json = JSON.stringify(value);
  if (json === undefined) {
    throw new Error(`cacheSet(${key}): value is undefined; cannot serialize to JSON`);
  }

  await db.query(
    `INSERT INTO app.cache (key, payload, created_at, expires_at)
     VALUES ($1, $2::jsonb, NOW(), $3::timestamptz)
     ON CONFLICT (key)
     DO UPDATE SET payload = EXCLUDED.payload,
                   expires_at = EXCLUDED.expires_at`,
    [key, json, expiresAt]
  );
}

/**
 * Delete exactly one cache row by key.
 *
 * @returns number of rows deleted (0 or 1).
 */
export async function cacheDel(key: string): Promise<number> {
  const db = getDb();
  const r = await db.query(`DELETE FROM app.cache WHERE key = $1`, [key]);
  return r.rowCount ?? 0;
}

/**
 * Delete multiple cache rows by key prefix.
 *
 * Useful for coarse-grained invalidation (e.g., delete all 'courses:v1:*').
 * NOTE: This uses `LIKE 'prefix%'`. Ensure your prefixes are stable and
 * choose them so you don't delete unintended keys.
 *
 * @returns number of rows deleted.
 */
export async function cacheDelByPrefix(prefix: string): Promise<number> {
  const db = getDb();
  const r = await db.query(`DELETE FROM app.cache WHERE key LIKE $1`, [prefix + "%"]);
  return r.rowCount ?? 0;
}

/**
 * Sweep expired entries (hard delete).
 *
 * Called by the background sweeper at intervals. Even without sweeping,
 * expired rows are *not* served (cacheGet checks expires_at), but sweeping
 * keeps the table small and avoids unbounded growth.
 *
 * @returns number of rows removed.
 */
export async function cacheSweepExpired(): Promise<number> {
  const db = getDb();
  const r = await db.query(`
    WITH del AS (
      DELETE FROM app.cache
       WHERE expires_at <= NOW()
       RETURNING 1
    )
    SELECT COUNT(*)::int AS n FROM del
  `);
  return r.rows[0]?.n ?? 0;
}