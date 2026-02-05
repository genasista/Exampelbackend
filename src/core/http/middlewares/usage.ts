import type { Request, Response, NextFunction } from "express";
import { getDb } from "@core/db";

type Key = string; // `${yyyy-mm-dd}:${schoolId}`
const counters = new Map<Key, number>();

function utcDay(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Middleware: track usage per school/day.
 * - Reads schoolId from header `x-school-id` (demo/local convention).
 * - Increments an in-memory counter on response finish.
 */
export function usageTracker() {
  return function (req: Request, res: Response, next: NextFunction) {
    const schoolIdHeader = req.header("x-school-id");
    const schoolId = schoolIdHeader ? parseInt(String(schoolIdHeader), 10) : NaN;
    if (!Number.isFinite(schoolId)) {
      return next(); // no school context → skip
    }

    const day = utcDay(new Date());
    const key: Key = `${day}:${schoolId}`;

    res.on("finish", () => {
      counters.set(key, (counters.get(key) ?? 0) + 1);
    });

    next();
  };
}

/**
 * Background job: flush in-memory counters into app.usage_daily (upsert).
 * - Interval controlled by USAGE_FLUSH_INTERVAL_MS (default 30000 ms)
 */
export function startUsageFlushJob() {
  const intervalMs = Number(process.env.USAGE_FLUSH_INTERVAL_MS ?? 30_000);
  setInterval(async () => {
    if (counters.size === 0) return;
    const db = getDb();
    const entries = Array.from(counters.entries());
    counters.clear();

    const text = `
      INSERT INTO app.usage_daily (day, school_id, count)
      VALUES ${entries.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(", ")}
      ON CONFLICT (day, school_id)
      DO UPDATE SET count = app.usage_daily.count + EXCLUDED.count
    `;
    const values: any[] = [];
    for (const [k, n] of entries) {
      const [day, sid] = k.split(":");
      values.push(day, Number(sid), n);
    }
    try {
      await db.query(text, values);
      console.info(JSON.stringify({ event: "usage_flush", rows: entries.length }));
    } catch (e: any) {
      console.error(JSON.stringify({ event: "usage_flush_error", message: e?.message }));
    }
  }, intervalMs);
}


