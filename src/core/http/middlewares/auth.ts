import type { RequestHandler } from "express";
import { verifyBearer } from "@core/auth/verify";
import { sendError } from "@core/http/respond";

/**
 * Extracts a normalized roles array from common claim shapes.
 * Supports:
 *  - payload.roles: string[] | string
 *  - payload.role:  string
 *  - payload.realm_access?.roles: string[] (e.g., Keycloak)
 *  - payload.permissions: string[] (some IdPs use permissions)
 */
function extractRoles(payload: any): string[] {
  const out = new Set<string>();

  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) out.add(v.trim());
    if (Array.isArray(v)) v.forEach(push);
  };

  push(payload?.roles);
  push(payload?.role);
  push(payload?.realm_access?.roles);
  push(payload?.permissions);

  return Array.from(out);
}

/**
 * requireAuth
 *
 * What it does:
 * - Reads `Authorization: Bearer <JWT>` header
 * - Verifies the token signature/claims using JWKS (see @core/auth/verify)
 * - Attaches `req.user = { sub, roles }` for downstream use
 * - Logs subject + roles for troubleshooting
 *
 * Error cases:
 * - Missing Authorization header -> 401 { code: "Unauthorized", ... }
 * - Invalid/expired token       -> 401 { code: "Unauthorized", ... }
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const h = req.header("authorization") || "";
    const m = /^bearer\s+(.+)$/i.exec(h);
    if (!m) {
      return sendError(req, res, 401, "Unauthorized", "Missing Bearer token");
    }

    const { payload } = await verifyBearer(m[1]);
    req.user = { sub: payload.sub, roles: extractRoles(payload) };

    if (req.user.roles.length) {
      console.info(`[auth] sub=${req.user.sub ?? "?"} roles=${req.user.roles.join(",")}`);
    }

    return next();
  } catch (err: any) {
    // verifyBearer provides concise messages (expired, no matching kid, etc.)
    return sendError(req, res, 401, "Unauthorized", err?.message || "Invalid token");
  }
};

/**
 * requireAdmin
 *
 * What it does:
 * - Ensures `requireAuth` has already run (i.e., `req.user` exists)
 * - Requires the user to have the "admin" role
 *
 * Error cases:
 * - No req.user          -> 401 (acts as if no token provided)
 * - Missing "admin" role -> 403
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    return sendError(req, res, 401, "Unauthorized", "Missing Bearer token");
  }
  if (!req.user.roles.includes("admin")) {
    return sendError(req, res, 403, "Forbidden", "Admin role required");
  }
  return next();
};