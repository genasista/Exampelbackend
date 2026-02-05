/**
 * Express Request augmentation (ambient module).
 *
 * Adds project-specific fields to `express-serve-static-core`'s Request:
 * - correlationId: set by our correlation middleware; echoed to responses.
 * - user:          populated by JWT auth (`requireAuth`).
 * - dataMode:      "sandbox" | "live", set by dataMode middleware.
 *
 * Because this is in `typeRoots`, any file importing `express` will see these.
 */

import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    correlationId?: string;
    user?: { sub?: string; roles: string[] };
    dataMode?: "sandbox" | "live";
  }
}