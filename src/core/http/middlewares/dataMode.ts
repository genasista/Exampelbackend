import { RequestHandler } from "express";

/**
 * Data mode middleware.
 *
 * Purpose:
 * - Normalizes and echoes a logical "data mode" used by the app: `sandbox` (default) or `live`.
 * - Reads from request header `x-data-mode`, or `DEFAULT_DATA_MODE` env, or defaults to "sandbox".
 *
 * Effects:
 * - Sets `req.dataMode` to "sandbox" | "live"
 * - Echoes the header back as `x-data-mode` on responses (useful for debugging)
 */
export const dataMode = (): RequestHandler => (req, res, next) => {
  const mode =
    ((req.headers["x-data-mode"] as string) ||
      process.env.DEFAULT_DATA_MODE ||
      "sandbox").toLowerCase();

  const val = mode === "live" ? "live" : "sandbox";
  (req as any).dataMode = val;
  res.setHeader("x-data-mode", val);
  next();
};