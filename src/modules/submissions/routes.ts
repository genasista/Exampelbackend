/**
 * Submissions routes.
 *
 * Endpoints:
 * - POST /submissions                → create (multipart or JSON editorText)
 * - GET  /submissions                → list (cursor pagination)
 * - GET  /submissions/:id            → fetch a single submission
 * - GET  /submissions/:id/artifact   → resolve to local file or time-limited URL
 *
 * Notes:
 * - File upload uses multer (memory storage) with a mime/size guard in utils/uploads.
 * - All responses adhere to the Error model and include X-Next-Cursor where applicable.
 */

import { Router } from "express";
import { upload } from "../../utils/uploads";
import { postSubmission, listSubmissions, getSubmission, getSubmissionArtifact } from "./controller";

const r = Router();

r.post("/", upload.single("file"), postSubmission);
r.get("/", listSubmissions);
r.get("/:id", getSubmission);
r.get("/:id/artifact", getSubmissionArtifact);

export default r;