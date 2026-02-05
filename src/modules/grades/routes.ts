/**
 * Grades routes.
 * GET /grades → list grades (optional ?assignmentId, paginated)
 */

import { Router } from "express";
import * as ctrl from "./controller";
const r = Router();

r.get("/", ctrl.list);

export default r;