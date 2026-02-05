import type { Request, Response, NextFunction } from "express";

/**
 * API key guard.
 *
 * - Accepts API keys from either:
 *   - `X-Api-Key` (our default)
 *   - `Ocp-Apim-Subscription-Key` (Azure APIM convention)
 * - Valid keys are configured via `API_KEYS` (comma-separated) in .env.
 *
 * Responses:
 * - Missing key  -> 401 Unauthorized
 * - Invalid key  -> 403 Forbidden
 *
 * Side effects:
 * - Attaches `req.apiKey` so downstream middlewares (e.g., rate limit) can use it.
 * - Echoes `x-correlation-id` set by the correlation middleware.
 */
const API_KEYS = (process.env.API_KEYS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req as any).correlationId;

  // Support both our header and APIM's default header.
  const headerKey =
    (req.header("x-api-key") ||
      req.header("ocp-apim-subscription-key") || // APIM default
      "").trim();

  if (!headerKey) {
    res.setHeader("x-correlation-id", correlationId);
    return res.status(401).json({
      code: "Unauthorized",
      message: "Missing API key in X-Api-Key header.",
      correlationId,
    });
  }

  if (!API_KEYS.includes(headerKey)) {
    res.setHeader("x-correlation-id", correlationId);
    return res.status(403).json({
      code: "Forbidden",
      message: "Invalid API key.",
      correlationId,
    });
  }

  // Make the key available to other middlewares/handlers.
  (req as any).apiKey = headerKey;
  return next();
}