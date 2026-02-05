import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { trackEvent } from "@core/observability/telemetry";

export function sandboxMarker() {
    return (req: Request, res: Response, next: NextFunction) => {
      // const dataMode = (req.header("X-Data-Mode") ?? "sandbox").toLowerCase();
      const dataMode = ((req as any).dataMode ?? req.header("x-data-mode") ?? "sandbox").toLowerCase();
      const corrId =
        (typeof res.getHeader === "function" ? String(res.getHeader("x-correlation-id") ?? "") : "") ||
        req.header("x-correlation-id") ||
        randomUUID();
  
      trackEvent("sandbox_marker", {
        dataMode,
        correlationId: corrId,
        path: req.originalUrl,
        method: req.method,
      });
  
      next();
    };
  }