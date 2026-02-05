import "dotenv/config";
import { buildApp } from "./core/http/app";
import { closeDbIfAny } from "@core/db";
import { startCacheSweeper } from "@core/cache/sweeper";
import { startUsageFlushJob } from "@core/http/middlewares/usage";

/**
 * Process entrypoint.
 * - Loads env vars via dotenv (for local dev).
 * - Builds the Express app (middlewares, routes, docs).
 * - Starts HTTP server on PORT (default 3001).
 * - Handles SIGTERM/SIGINT for graceful shutdown (e.g., Docker/K8s).
 */

const app = buildApp();
const port = Number(process.env.PORT ?? 3001);

// Start background cache housekeeping once per process.
// Disable with ENABLE_CACHE_SWEEPER=false (checked inside the function).
startCacheSweeper();
startUsageFlushJob();

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

/**
 * Graceful shutdown:
 * - Stop accepting new connections
 * - Close DB pool if present
 * - Exit with code 0
 */
const shutdown = async () => {
  console.log("Shutting down…");
  server.close(async () => {
    try {
      await closeDbIfAny();
    } catch (e) {
      console.error("DB close error", e);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);