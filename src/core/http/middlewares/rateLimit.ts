import type { Request, Response, NextFunction } from "express";

/**
 * Per-API-key fixed-window rate limiter (in-memory).
 *
 * Requirements:
 * - Runs after `apiKeyMiddleware` so `req.apiKey` is set.
 *
 * Behavior:
 * - Tracks a counter per key for a 60s window.
 * - If limit exceeded, returns 429 with `Retry-After` (seconds left in window)
 *   and includes `x-correlation-id`.
 *
 * Notes:
 * - In-memory store is fine for a single instance/dev. For multi-instance or prod,
 *   use a distributed store (e.g., Redis) to share counters across nodes.
 */
const WINDOW_MS = 60_000; // 1 minute fixed window
const LIMIT = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60);

type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req as any).correlationId;

  // Prefer `req.apiKey` set by apiKeyMiddleware, fall back to header defensively.
  const key = (req as any).apiKey || (req.header("x-api-key") || "").trim();

  // If there's no key, let the API key middleware handle the failure path.
  if (!key) return next();

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }

  // Start a new window if the previous one elapsed.
  if (now - bucket.windowStart >= WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }

  // Enforce limit.
  if (bucket.count >= LIMIT) {
    const retryAfterSec = Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSec));
    res.setHeader("x-correlation-id", correlationId);
    return res.status(429).json({
      code: "RateLimited",
      message: `Rate limit exceeded. Try again in ${retryAfterSec}s`,
      correlationId,
    });
  }

  bucket.count += 1;
  return next();
}