// src/core/http/router.ts
/**
 * Aggregates feature routers (no global middleware here).
 * Mounted by app.ts after gateway middlewares.
 */
import { Router } from "express";

import users from "@modules/users/routes";
import courses from "@modules/courses/routes";
import assignments from "@modules/assignments/routes";
import grades from "@modules/grades/routes";
import submissions from "@modules/submissions/routes";
import demo from "@modules/demo/routes";

import sandboxProof from "./routes/sandboxProof.route";
import sandboxLogs from "./routes/sandboxLogs.route";
import { getBufferedEvents } from "../observability/telemetry";

import submissionSandbox from "./routes/submissionSandbox.route";

export const router = Router();

// Feature modules at top level (matches OpenAPI paths)
router.use("/users", users);
router.use("/courses", courses);
router.use("/assignments", assignments);
router.use("/grades", grades);
router.use("/submissions", submissions);

// Demo utilities
router.use("/api/demo", demo);

// Sandbox routes (no auth, no rate limit, no admin)
router.use("/__sandbox", sandboxProof);
router.use("/__sandbox", sandboxLogs);
router.use("/__sandbox", submissionSandbox);

/** TEMP: levnadsbevis för __sandbox-mount */
router.get("/__sandbox/_alive", (_req, res) => res.json({ ok: true }));

