/**
* Admin feature routes.
 *
 * Mounting:
 * - In `app.ts` we mount this router under `/api/admin` **after**
 *   `requireAuth` and `requireAdmin`, so every route here:
 *     - requires a valid JWT (verified via JWKS)
 *     - requires the "admin" role
 *
 * Purpose:
 * - `/api/admin/ping` is a simple smoke-test endpoint used to verify
 *   SCRUM-9 requirements:
 *     - Valid token → 200 and the role claim is logged
 *     - Non-admin token → 403 (blocked by `requireAdmin` upstream)
 *     - Invalid/missing token → 401 (blocked by `requireAuth` upstream)
 *
 * Response:
 * - Echoes the authenticated subject (`sub`) and `roles` extracted by
 *   `requireAuth` middleware for quick troubleshooting.
 */

import { Router, Request, Response } from "express";

const r = Router();

/**
 * GET /api/admin/ping
 * Returns a minimal OK payload plus the caller identity (sub, roles).
 * Since this router is mounted behind `requireAuth` + `requireAdmin`,
 * only admin users will reach this handler.
 */
r.get("/ping", (req: Request, res: Response) => {
  // `req.user` is attached by `requireAuth` (see core/http/middlewares/auth.ts)
  const user = (req as any).user ?? {};

  res.json({
    ok: true,
    at: new Date().toISOString(),
    sub: user.sub ?? null,
    roles: Array.isArray(user.roles) ? user.roles : [],
  });
});

export default r;