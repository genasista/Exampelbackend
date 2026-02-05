import type { ErrorRequestHandler, Request, Response } from "express";
import { sendError, ErrorCode } from "../respond";

/**
 * Maps HTTP status codes to our canonical error codes (OpenAPI).
 */
function mapStatusToCode(status: number): ErrorCode {
  switch (status) {
    case 400: return "BadRequest";
    case 401: return "Unauthorized";
    case 403: return "Forbidden";
    case 404: return "NotFound";
    case 429: return "TooManyRequests";
    default:  return status >= 500 ? "InternalError" : "BadRequest";
  }
}

/**
 * 404 handler — run when no route matched.
 * Returns our unified error shape and includes the correlationId header/body.
 */
export function notFoundHandler(req: Request, res: Response) {
  return sendError(req, res, 404, "NotFound", `No route: ${req.method} ${req.path}`);
}

/**
 * Final error handler — last in the chain.
 *
 * Behavior:
 * - Determines the HTTP status (explicit `err.statusCode` > `res.statusCode` > 500)
 * - Maps to our canonical `code` via `mapStatusToCode`
 * - Responds using `sendError`, which also sets `x-correlation-id`
 *
 * Notes:
 * - Keep this last so previous middlewares/routers can set a more specific status.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const explicit = (err as any)?.statusCode;
  const status =
    typeof explicit === "number"
      ? explicit
      : res.statusCode >= 400
      ? res.statusCode
      : 500;

  const code = mapStatusToCode(status);
  const message = (err as any)?.message || "Unexpected error";

  const correlationId = (req as any).correlationId ?? "";
    console.error(JSON.stringify({
      event: "error",
      method: req.method,
      path: req.originalUrl,
      status,
      code,
      correlationId,
      message,
    }));

  return sendError(req, res, status, code, message);
};