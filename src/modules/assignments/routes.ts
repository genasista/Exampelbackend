/**
 * Assignments routes.
 *
 * Mounted under `/assignments` by the feature router.
 * Currently exposes:
 *   GET /assignments → list (paginated, optional ?courseId)
 */

import { Router } from "express";
import * as ctrl from "./controller";

const r = Router();
r.get("/", ctrl.list);

export default r;