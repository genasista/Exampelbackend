import multer from "multer";
import type { Request } from "express";

/**
 * Multer setup for handling single file uploads in memory.
 *
 * Why memoryStorage?
 * - We only need the bytes briefly to forward to our storage provider (Azure/local).
 * - Avoids temporary files on disk and simplifies cleanup.
 * - Keep MAX_BYTES conservative to protect the process from large payloads.
 *
 * NOTE: Errors thrown here (unsupported mime, file too large) are normalized by
 * the `multerErrors` error middleware to proper HTTP codes (415/413/400).
 */

// Max payload: 10 MB
export const MAX_BYTES = 10 * 1024 * 1024;

// Allowed MIME types the API accepts.
// (Keep in sync with OpenAPI: pdf, docx, jpg, png, txt)
const allowed = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "image/jpeg",
  "image/png",
  "text/plain",
]);

export const upload = multer({
  // Keep the uploaded file in memory as Buffer (req.file.buffer)
  storage: multer.memoryStorage(),
  // Enforce size and 1 file per request
  limits: { fileSize: MAX_BYTES, files: 1 },
  // Validate content type early for fast rejection paths
  fileFilter(_req: Request, file, cb) {
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported mime: ${file.mimetype}`));
  },
});