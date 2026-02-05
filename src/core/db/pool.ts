import { Pool } from "pg";

let pool: Pool | null = null;

/**
 * getDb()
 * Lazily creates (and reuses) a single pg.Pool instance.
 *
 * Env:
 * - DATABASE_URL: standard Postgres connection string.
 *
 * Pool settings:
 * - max: cap concurrent connections for predictable resource usage.
 * - idleTimeoutMillis: close idle connections after a short period.
 * - connectionTimeoutMillis: fail fast if DB is unreachable.
 *
 * On each new connection we set the search_path to "app, public" so we can
 * query tables like `select * from submission` without qualifying the schema.
 *
 * Fatal pool errors:
 * - If the pool emits an "error", we log and exit the process. This is common
 *   in pg-backed services—let the orchestrator (Docker/K8s/systemd) restart us.
 */
export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on("connect", (client) => {
      client.query(`SET search_path TO app, public`).catch((err) => {
        console.error("Failed to set search_path", err);
      });
    });

    pool.on("error", (err: Error) => {
      console.error("Unexpected DB error", err);
      process.exit(-1);
    });
  }
  return pool;
}

/**
 * closeDbIfAny()
 * Gracefully drains the pool if it exists. Call this during shutdown
 * (SIGTERM/SIGINT) to avoid dropping in-flight queries.
 */
export async function closeDbIfAny() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}