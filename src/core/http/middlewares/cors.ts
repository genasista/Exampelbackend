import type { Request, Response, NextFunction } from "express";

/**
 * CORS middleware.
 *
 * Config:
 * - Allowed origins via CORS_ORIGIN (plus optional _2/_3)
 * - Optional credentials via CORS_ALLOW_CREDENTIALS=true
 *
 * Behavior:
 * - For allowed origins, sets `Access-Control-Allow-Origin: <origin>`
 * - Exposes select response headers (Retry-After, X-Correlation-Id, X-Next-Cursor)
 * - Handles preflight (OPTIONS):
 *     - Allows configured methods/headers
 *     - Caches preflight for 10 minutes
 */
const ALLOWED_ORIGINS = new Set(
  [
    process.env.CORS_ORIGIN ?? "http://localhost:3000", // primary
    process.env.CORS_ORIGIN_2,                          // optional
    process.env.CORS_ORIGIN_3,                          // optional
  ].filter(Boolean) as string[]
);

// Only enable if using cookies/credentials across origins (and never with '*').
const ALLOW_CREDENTIALS =
  (process.env.CORS_ALLOW_CREDENTIALS ?? "false").toLowerCase() === "true";

const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",             // for Bearer tokens when applicable
  "X-Api-Key",                 // our API key header
  "Ocp-Apim-Subscription-Key", // APIM default
  "X-Data-Mode",               // "sandbox" | "live"
  "X-Correlation-Id",
];

const EXPOSED_HEADERS = [
  "Retry-After", // for 429 responses
  "X-Correlation-Id", // our custom header for tracing
  "X-Next-Cursor", // pagination
  "X-Cache", // custom header to signal cache HIT vs MISS
  "X-Data-Mode",
];

const ALLOWED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.header("origin");

  // Help caches/CDNs vary properly based on CORS-relevant request headers.
  res.setHeader("Vary", "Origin, Access-Control-Request-Headers, Access-Control-Request-Method");

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    if (ALLOW_CREDENTIALS) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
  }

  // Expose specific response headers to frontend JS.
  res.setHeader("Access-Control-Expose-Headers", EXPOSED_HEADERS.join(", "));

  // Handle browser preflight quickly.
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
    res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));
    res.setHeader("Access-Control-Max-Age", "600"); // 10 minutes
    return res.status(204).send();
  }

  return next();
}