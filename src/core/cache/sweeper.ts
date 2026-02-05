import { cacheSweepExpired } from "./db";

/**
 * startCacheSweeper
 * -----------------
 * Background housekeeping for the DB-backed cache (table: app.cache).
 *
 * What it does:
 * - On a fixed interval, DELETEs all rows whose `expires_at <= NOW()`.
 * - Logs a compact JSON line when it actually removes something, so we can
 *   observe activity without spamming the logs.
 *
 * When to call:
 * - Call **once** at process startup (e.g., in index.ts) after the DB is ready.
 * - Don’t call it in unit tests or short-lived/serverless processes.
 *
 * Configuration (environment variables):
 * - CACHE_SWEEPER_INTERVAL_MS: interval in milliseconds between sweeps.
 *   Defaults to 60_000 (60s) if not set.
 * - ENABLE_CACHE_SWEEPER: set to "false" (case-insensitive) to disable.
 *   Any other value (or unset) ⇒ enabled.
 *
 * Observability:
 * - Success log (only when something was deleted):
 *     {"event":"cache_sweep","removed": <number>}
 * - Error log (if the sweep throws):
 *     {"event":"cache_sweep_error","message":"..."}
 *
 * Notes:
 * - This uses `setInterval` and intentionally does not store/clear the timer.
 *   On graceful shutdown, the Node process exits and the timer dies with it.
 *   If you ever need manual teardown, return the timer handle from this
 *   function and clear it in your shutdown handler.
 */
export function startCacheSweeper() {
  // How often to run the sweep (defaults to once per minute).
  const intervalMs = Number(process.env.CACHE_SWEEPER_INTERVAL_MS ?? 60_000);

  // Feature flag: allow disabling via ENABLE_CACHE_SWEEPER=false
  const enabled =
    (process.env.ENABLE_CACHE_SWEEPER ?? "true").toLowerCase() !== "false";

  // If disabled, do nothing. Useful for tests or serverless builds.
  if (!enabled) return;

  // Fire-and-forget loop: periodically remove expired cache rows.
  setInterval(async () => {
    try {
      // DELETE FROM app.cache WHERE expires_at <= NOW()
      const n = await cacheSweepExpired();

      // Only log when we actually delete something to keep logs tidy.
      if (n > 0) {
        console.info(JSON.stringify({ event: "cache_sweep", removed: n }));
      }
    } catch (e: any) {
      // Never throw from background jobs; emit a structured error log instead.
      console.error(
        JSON.stringify({ event: "cache_sweep_error", message: e?.message })
      );
    }
  }, intervalMs);
}