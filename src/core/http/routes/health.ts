/**
 * Liveness endpoint: /health
 *
 * Goals:
 * - Stay GREEN unless the process is actually unhealthy. Orchestrators use this
 *   to decide restarts, so avoid failing for transient infra issues.
 * - Be FAST and SIMPLE. No auth, no heavy work, no external calls beyond an
 *   optional lightweight DB ping.
 * - Report times in UTC (ISO 8601 with "Z") to avoid timezone ambiguity.
 *
 * Notes:
 * - This is *not* a readiness probe. If you need to fail when DB/Queue are down,
 *   add a separate /ready endpoint.
 * - Do not throw inside this handler; return a JSON body describing any issues.
 */

import { Router } from "express";
import { getDb } from "@core/db";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  
  // Minimal base payload. Keep it stable to avoid breaking monitors.
  const now = new Date();
  const body: {
    ok: true;
    appTimeUtc: string;
    dbTimeUtc?: string | null;
  } = {
    ok: true,
    appTimeUtc: now.toISOString(), // always UTC
  };

  // Optional DB visibility: if DATABASE_URL exists, try a cheap SELECT NOW().
  // IMPORTANT: even if the DB is down, we don't fail liveness here.
  if (process.env.DATABASE_URL) {
    try {
      // Alias the column so it's consistent across drivers.
      const r = await getDb().query("SELECT NOW() AS now");
      // Normalize to ISO-UTC string regardless of DB timezone settings.
      body.dbTimeUtc = new Date(r.rows[0].now).toISOString();
    } catch {
      // Don’t fail liveness; just signal that DB time is not available.
      body.dbTimeUtc = null;
    }
  }

  // No cache headers needed; health is dynamic.
  res.json(body);
});

/**
 * Readiness endpoint: /ready
 *
 * Returns 200 when core dependencies are OK.
 * Returns 503 when something essential (e.g. DB) is unavailable.
 * Orchestrators should use this to decide if the app can receive traffic.
 */

