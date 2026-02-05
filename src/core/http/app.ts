/**
 * Express app composition and middleware order of operations.
 *
 * Order matters (top → bottom):
 * 1) Core plumbing: JSON parsing, correlationId, request logging, data mode, CORS
 * 2) Public endpoints: /health, /docs
 * 3) Dev issuer (JWT mint + JWKS) when DEMO_MODE === "true"
 * 4) Gateway concerns: API key auth, per-key rate limiting
 * 5) Feature routers: users/courses/assignments/grades/submissions/demo
 * 6) Admin router (protected by JWT + admin role)
 * 7) Error handling: multer errors, 404, then unified error handler
 *
 * Environment:
 * - DEMO_MODE: when true, exposes /.well-known/jwks.json and /auth/dev/token
 * - API_KEYS, RATE_LIMIT_PER_MINUTE, CORS_* handled by respective middlewares
 */

import express from "express";
import { correlation } from "./middlewares/correlation";
import { dataMode } from "./middlewares/dataMode";
import { corsMiddleware } from "./middlewares/cors";
import { apiKeyMiddleware } from "./middlewares/apiKey";
import { rateLimitMiddleware } from "./middlewares/rateLimit";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler";
import { router } from "./router";
import { healthRouter } from "./routes/health";
import { mountDocs } from "@core/docs";
import { requestLogger } from "./middlewares/logger";
import { multerErrors } from "./middlewares/multerErrors";
import { requireAuth, requireAdmin } from "./middlewares/auth";
import adminRouter from "@modules/admin/routes";
import { devIssuerRouter } from "@core/auth/devIssuer";
import { readyRouter } from "./routes/ready";
import { sandboxMarker } from "./middlewares/sandboxMarker";
import { installFetchGuard } from "./fetchGuard";
import { usageTracker } from "./middlewares/usage";
import usageRouter from "./routes/usage";
import controlRouter from "./routes/control";
// import { getBufferedEvents } from "@core/observability/telemetry";

export function buildApp() {
  const app = express();

  // 1) Core plumbing
  app.use(express.json({ limit: "2mb" }));
  app.use(correlation());     // adds req.correlationId and echoes it back
  app.use(requestLogger);     // logs method/path/status/correlationId

  app.use(dataMode());        // reads/echoes x-data-mode (sandbox|live)
  app.use(sandboxMarker());   // log X-Data-Mode + correlation-id per request
  installFetchGuard();

  app.use(corsMiddleware);    // CORS + preflight, exposes headers

  // 2) Public endpoints (no auth)
  app.use(readyRouter);       // /ready
  app.use(healthRouter);       // /health (liveness)
  mountDocs(app);             // /openapi.json + /docs

  // 3) Dev issuer endpoints (JWT mint + JWKS) for local/demo use only
  if ((process.env.DEMO_MODE || "false").toLowerCase() === "true") {
    app.use(devIssuerRouter());
  }

  // 4) Gateway layer
  app.use(apiKeyMiddleware);      // X-Api-Key / Ocp-Apim-Subscription-Key
  app.use(rateLimitMiddleware);   // per-key fixed-window rate limit
  app.use(usageTracker());        // track usage per school/day (after auth)

  // 5) Feature routers (unprivileged)
  app.use(router);
  app.use("/usage", usageRouter); // usage analytics API
  app.use("/control", controlRouter); // simple control center pages

  // 6) Admin endpoints: require valid JWT + "admin" role
  app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

  // 7) Errors (specific → generic)
  app.use(multerErrors);     // multer upload errors → 4xx with friendly message
  app.use(notFoundHandler);  // 404 JSON with correlationId
  app.use(errorHandler);     // unified error shape for everything else


  return app;
}