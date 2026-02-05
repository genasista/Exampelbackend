import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import type { Express, Request, Response } from "express";

/**
 * Mounts API documentation:
 * - GET /openapi.json → serves the OpenAPI spec as JSON (for tooling/APIM).
 * - GET /docs → Swagger UI that fetches /openapi.json.
 *
 * Implementation details:
 * - In production, we load YAML once and cache it for performance.
 * - In development, we reload on each request to reflect spec edits live.
 *
 * Source spec is versioned at: api/contracts/openapi.yml
 */

// Absolute path to the OpenAPI spec file
const SPEC_PATH = path.join(process.cwd(), "api/contracts/openapi.yml");

export function mountDocs(app: Express) {
  // Lazy loader with env-aware cache behavior
  const load = (() => {
    if (process.env.NODE_ENV === "production") {
      const spec = YAML.load(SPEC_PATH); // one-time parse, then reuse
      return () => spec;
    }
    // Dev: hot-reload so changes appear without restarting the server
    return () => YAML.load(SPEC_PATH);
  })();

  // Raw JSON spec (handy for APIM import and automated clients)
  app.get("/openapi.json", (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store"); // always fresh in browsers
    res.json(load());
  });

  // Interactive Swagger UI, configured to load the spec from /openapi.json
  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: "/openapi.json" },
      customSiteTitle: "Genassista API Docs",
      // Minor cosmetic tweaks to the topbar title
      customCss: `
        .swagger-ui .topbar .link span { display: none !important; }
        .swagger-ui .topbar .link:after {
          content: "Genassista API Docs";
          font-size: 1.1rem;
          font-weight: 600;
          margin-left: 1rem;
          width: 100%;
        }
      `,
    })
  );
}