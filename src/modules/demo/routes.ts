/**
 * Demo utilities (dev/test only).
 *
 * This router provides:
 * - A fake auth-protected ping using a static token (NOT for prod)
 * - A small per-IP rate-limited ping
 * - Quick DB table dumps for local inspection (search_path configured to app,public)
 * - Static artifact serving for demo "open artifact" flows
 * - A tiny "dashboard" endpoint that returns row counts per table
 * - Auth probes that reuse the real JWT middlewares (requireAuth/requireAdmin)
 *
 * Note: This module intentionally keeps everything in a single file to reduce
 * overhead for demo/testing. If it grows, feel free to split into controller/service.
 */

import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { getDb } from "@core/db";
import { requireAuth, requireAdmin } from "@core/http/middlewares/auth";

const router = express.Router();

// --- 401 → 200 using a **static** Bearer token (for demo only) ----------------
function requireDemoAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const auth = req.header("authorization");
  if (auth !== "Bearer demo-token") {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// --- 429 limiter for demo spam testing ---------------------------------------
const demoLimiter = rateLimit({
  windowMs: 15_000,  // 15 seconds
  max: 5,            // allow at most 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth required (static) → simple ping
router.get("/secure/ping", requireDemoAuth, (_req, res) =>
  res.json({ ok: true, at: new Date().toISOString() })
);

// Rate-limited ping (no auth)
router.get("/limited/ping", demoLimiter, (_req, res) =>
  res.json({ ok: true, at: new Date().toISOString() })
);

// --- Generic "dump table" routes (for demo data visibility) -------------------
function listRoute(table: string) {
  // Relies on `SET search_path TO app, public` in DB pool init.
  return async (_req: express.Request, res: express.Response) => {
    const rows = (await getDb().query(`select * from ${table} order by 1`)).rows;
    res.json(rows);
  };
}

router.get("/municipalities", listRoute("municipality"));
router.get("/schools",        listRoute("school"));
router.get("/teachers",       listRoute("teacher"));
router.get("/students",       listRoute("student"));
router.get("/courses",        listRoute("course"));
router.get("/class-groups",   listRoute("class_group"));
router.get("/enrolments",     listRoute("enrolment"));
router.get("/assignments",    listRoute("assignment"));
router.get("/submissions",    listRoute("submission"));

// Crash route to exercise global error handling
router.get("/crash", () => { throw new Error("boom"); });

// --- Static artifact server (for demo) ---------------------------------------
router.use("/artifacts", express.static(path.join(process.cwd(), "artifacts")));

// --- Tiny "dashboard" with row counts ----------------------------------------
router.get("/dashboard", async (_req, res) => {
  const db = getDb();
  const tables = ["municipality","school","teacher","student","course","class_group","enrolment","assignment","submission"];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const r = await db.query(`select count(*)::int from ${t}`);
    counts[t] = r.rows[0].count;
  }
  res.json({ counts });
});

// --- Probes using the real JWT middleware ------------------------------------

// Who am I? (requires valid Bearer JWT)
router.get("/auth/me", requireAuth, (req, res) => {
  res.json({
    sub: (req as any).user?.sub ?? null,
    roles: (req as any).user?.roles ?? [],
  });
});

// Admin-only ping (requires valid JWT + admin role)
router.get("/admin/ping", requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

export default router;