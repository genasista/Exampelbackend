import { randomUUID } from "crypto";
import { RequestHandler } from "express";

/**
 * Correlation ID middleware.
 *
 * - Reads incoming `x-correlation-id` (if present) or generates a new UUID v4.
 * - Stores the value on `req.correlationId`.
 * - Echoes the value back on the response header `x-correlation-id`.
 *
 * Why:
 * - Lets clients and backend logs correlate a single request across services.
 * - Used by error responses and logs for traceability.
 */
export const correlation = (): RequestHandler => (req, res, next) => {
  const id = (req.headers["x-correlation-id"] as string) || randomUUID();
  (req as any).correlationId = id;
  res.setHeader("x-correlation-id", id);
  next();
};