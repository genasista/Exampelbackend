/**
 * Readiness endpoint: /ready
 *
 * - Returns 200 only if critical deps are reachable (DB for now).
 * - If DB is down: 503 with a short JSON reason.
 * - Keep it fast; no heavy queries.
 */
import { Router } from "express";
import { getDb } from "@core/db";

export const readyRouter = Router();

readyRouter.get("/ready", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  
   if (!process.env.DATABASE_URL) {
    return res.status(503).json({ ok: false, reason: "DATABASE_URL not set" });
  }
  try {
    await getDb().query("SELECT 1");
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(503).json({
      ok: false,
      reason: "db_unavailable",
      message: e?.message,
    });
  }
});