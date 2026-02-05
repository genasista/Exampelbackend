import type { Request, Response, NextFunction } from "express";

/**
 * Simple request logger.
 *
 * - Logs method, path, status, correlationId, and server-side duration in ms.
 * - Uses the `finish` event to capture the final status code.
 * - Emits a single JSON line per request (easy to parse/ship).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const t0 = Date.now();

  res.on("finish", () => {
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        correlationId: (req as any).correlationId,
        durationMs: Date.now() - t0,
      })
    );
  });

  next();
}