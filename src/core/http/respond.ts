import type { Request, Response } from "express";

/**
 * Unified response helpers for consistent API behavior.
 *
 * Error shape:
 * {
 *   code: "BadRequest" | "Unauthorized" | "Forbidden" | "NotFound" | "TooManyRequests" | "InternalError",
 *   message: string,
 *   correlationId: string,
 *   details?: object
 * }
 *
 * These helpers also ensure we echo `x-correlation-id` in headers when present.
 */

// Canonical error code list (keep in sync with OpenAPI components.responses)
export const ERROR_CODES = [
  "BadRequest",
  "Unauthorized",
  "Forbidden",
  "NotFound",
  "TooManyRequests",
  "InternalError",
] as const;

export type ErrorCode = typeof ERROR_CODES[number];

export function isErrorCode(x: unknown): x is ErrorCode {
  return typeof x === "string" && (ERROR_CODES as readonly string[]).includes(x);
}

/** Coerces unknown error codes to a safe default for responses/logging. */
export function normalizeErrorCode(x: unknown): ErrorCode {
  return isErrorCode(x) ? x : "InternalError";
}

/** Ensures the correlation id is visible to clients (header mirrors body). */
function withCorrelationHeader(req: Request, res: Response) {
  if (req.correlationId) res.setHeader("x-correlation-id", req.correlationId);
}

/** Sends a standardized error response with correlation id and optional details. */
export function sendError(
  req: Request,
  res: Response,
  http: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
) {
  withCorrelationHeader(req, res);
  return res.status(http).json({
    code,
    message,
    correlationId: req.correlationId,
    ...(details ? { details } : {}),
  });
}

/** Sends 200 with correlation id header set when available. */
export function sendOk<T>(req: Request, res: Response, body: T) {
  withCorrelationHeader(req, res);
  return res.status(200).json(body);
}

/** Sends 201 with correlation id header set when available. */
export function sendCreated<T>(req: Request, res: Response, body: T) {
  withCorrelationHeader(req, res);
  return res.status(201).json(body);
}