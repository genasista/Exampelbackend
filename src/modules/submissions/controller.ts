/**
 * Submissions HTTP controller
 * --------------------------
 * Responsibilities:
 *  - Validate/normalize HTTP inputs (query/body/headers)
 *  - Call domain/service layer (`SubmissionsService`)
 *  - Map internal DB shapes → public API shapes (from OpenAPI)
 *  - Set HTTP-specific headers (e.g., X-Next-Cursor)
 *  - Return standardized error bodies via `sendError(...)`
 *
 * Design notes:
 *  - The service returns an *internal* row shape (`SubmissionRowDb`) that matches
 *    what we store in the database. We convert that to the public OpenAPI types
 *    (`Submission`, `SubmissionList`) in this controller. This keeps storage
 *    concerns decoupled from the API contract.
 *  - File uploads are handled by the route-level multer middleware
 *    (`upload.single("file")`) which populates `req.file`. As an alternative,
 *    clients may send `editorText` in JSON to simulate a text submission.
 */

import type { Request, Response } from "express";
import { encodeCursor, decodeCursor } from "../../utils/cursor";
import { SubmissionsService } from "./service";
import { getStorage } from "../../storage";
import { sendError, normalizeErrorCode } from "@core/http/respond";
import type { Submission, SubmissionList } from "@contracts";
import type { SubmissionRowDb } from "../../types/submission-row";

// Service is constructed with a storage implementation (local dev vs cloud).
const service = new SubmissionsService(getStorage());

/**
 * Adapter: internal DB shape → public API shape (OpenAPI)
 * - Only expose fields defined by the OpenAPI schema.
 * - Keep any internal-only details out of the response on purpose.
 * - Nullish handling: some fields are nullable in the contract, so we normalize
 *   `undefined` → `null` where appropriate.
 *
 * If you add fields to the API schema later (e.g., `meta`), extend this
 * mapping function in one place.
 */
function toApi(row: SubmissionRowDb): Submission {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    mime: row.mime,
    size: row.size,
    status: row.status,
    extractionStatus: row.extractionStatus,
    ocrRequired: row.ocrRequired,
    extractedText: row.extractedText ?? null,
    storagePath: row.storagePath,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    // meta: undefined // include when/if you have it in the contract
  };
}

// ========================= POST /submissions =========================
/**
 * Accepts either:
 *  - multipart/form-data with a single `file` (max 10MB, whitelisted mimes), or
 *  - JSON with `editorText` as a plain text alternative.
 *
 * Validates required fields, forwards to the service, and returns a minimal
 * "created" payload (submissionId + extraction flags). Does not return the
 * full submission row.
 *
 * Headers:
 *  - Uses `req.correlationId` (injected by correlation middleware) so the
 *    service can record it in events.
 *  - Echoes/reads `x-data-mode` (set by dataMode middleware) to record whether
 *    this happened in "sandbox" or "live" mode.
 */
export async function postSubmission(req: Request, res: Response) {
  try {
    const assignmentId = String(req.body.assignmentId || "").trim();
    const studentId    = String(req.body.studentId || "").trim();

    if (!assignmentId || !studentId) {
      return sendError(req, res, 400, "BadRequest", "assignmentId and studentId are required");
    }

    let buf: Buffer;
    let mime: string;
    let originalName = "editor.txt";

    // Path A: uploaded file via multer
    if (req.file?.buffer) {
      buf = req.file.buffer;
      mime = req.file.mimetype;
      originalName = req.file.originalname;
    }
    // Path B: plain text body
    else if (typeof req.body.editorText === "string") {
      buf = Buffer.from(req.body.editorText, "utf8");
      mime = "text/plain";
    }
    // Neither provided → 400
    else {
      return sendError(req, res, 400, "BadRequest", "Upload a file (file) or provide editorText.");
    }

    const grade = req.body.grade ? String(req.body.grade) : null;

    const result = await service.createSubmission({
      assignmentId,
      studentId,
      grade,
      buf,
      mime,
      originalName,
      correlationId: req.correlationId,
      dataMode: req.header("x-data-mode") ?? "sandbox",
    });

    // Matches OpenAPI 201 response for POST /submissions
    return res.status(201).json(result);
  } catch (err: any) {
    // Service may set `err.http` (status) and `err.code` (domain code).
    const http = Number.isInteger(err?.http) ? err.http : 500;
    const code = normalizeErrorCode(err?.code);
    console.error("[POST /submissions] error", err);
    return sendError(req, res, http, code, err?.message ?? "Unexpected error");
  }
}

// ========================= GET /submissions =========================
/**
 * Paginates through submissions for the dashboard/table UI.
 * - `pageSize` is clamped to [1, 200]
 * - `cursor` is an opaque base64url offset (encode/decode helpers)
 * - Sets `X-Next-Cursor` header when there is another page
 *
 * Returns the public API shape (`SubmissionList`).
 */
export async function listSubmissions(req: Request, res: Response) {
  const pageSize = Math.min(parseInt(String(req.query.pageSize ?? "20"), 10) || 20, 200);
  const cursor = String(req.query.cursor ?? "");
  const offset = decodeCursor(cursor);

  const { items, count } = await service.listSubmissions(pageSize, offset);
  const nextCursor = items.length === pageSize ? encodeCursor(offset + pageSize) : "";

  if (nextCursor) res.setHeader("X-Next-Cursor", nextCursor);

  // Map internal rows → API schema type
  const apiItems: Submission[] = items.map(toApi);
  const payload: SubmissionList = { items: apiItems, count };

  return res.json(payload);
}

// ========================= GET /submissions/:id =========================
/**
 * Returns a single submission by id in the public API shape.
 * - 404 when the submission does not exist.
 */
export async function getSubmission(req: Request, res: Response) {
  const row = await service.getSubmission(String(req.params.id));
  if (!row) return sendError(req, res, 404, "NotFound", "Submission not found");

  const payload: Submission = toApi(row);
  return res.json(payload);
}

// ========================= GET /submissions/:id/artifact =========================
/**
 * Returns how to fetch the original artifact:
 *  - In local/dev storage → streams/sends the file content
 *  - In cloud storage (e.g., Azure) → 302 redirect to a time-limited URL
 *
 * The storage implementation decides which one to use.
 */
export async function getSubmissionArtifact(req: Request, res: Response) {
  const loc = await service.getArtifactLocator(String(req.params.id));
  if (!loc) return sendError(req, res, 404, "NotFound", "Submission not found");

  if (loc.kind === "url") return res.redirect(302, loc.url);
  return res.sendFile(loc.absolutePath);
}