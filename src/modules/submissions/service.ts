/**
 * SubmissionsService
 *
 * Encapsulates the business logic for creating, listing, and reading submissions.
 * - Storage abstraction via `StorageProvider` (local dev vs Azure in production).
 * - DB writes to `app.submissions` and `app.submission_events`.
 * - Simple heuristics to decide OCR needs and initial extraction status.
*/

import { getDb } from "@core/db";
import { pdfLikelyHasTextLayer } from "../../utils/pdfHeuristics";
import type { StorageProvider } from "../../types/storage";
import type { SubmissionRowDb } from "../../types/submission-row";
import { cacheDelByPrefix } from "@core/cache/db";
import crypto from "crypto";


// Compute hex SHA-256 of the upload buffer (for demo; not cryptographic use)
function sha256(buf: Buffer) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/** Pick a file extension to use in storage path based on MIME type. */
function pickExt(mime: string) {
  switch (mime) {
    case "application/pdf": return ".pdf";
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "text/plain": return ".txt";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": return ".docx";
    default: return "";
  }
}

/**
 * Decide initial extraction state.
 * - Images → OCR required → `pending_ocr`
 * - PDFs → check if a text layer is likely present (simple heuristic)
 * - DOCX/TXT → treat as parsed for demo
 * - Unknown → conservative: OCR required
 */
function decideExtraction(mime: string, buf: Buffer) {
  if (mime === "image/jpeg" || mime === "image/png") {
    return { ocrRequired: true, extractionStatus: "pending_ocr" as const, extractedText: null };
  }
  if (mime === "application/pdf") {
    const hasText = pdfLikelyHasTextLayer(buf);
    return hasText
      ? { ocrRequired: false, extractionStatus: "parsed" as const, extractedText: "[stub] Extracted text from PDF" }
      : { ocrRequired: true,  extractionStatus: "pending_ocr" as const, extractedText: null };
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/plain"
  ) {
    return { ocrRequired: false, extractionStatus: "parsed" as const, extractedText: "[stub] Extracted text from document" };
  }
  // Fallback
  return { ocrRequired: true, extractionStatus: "pending_ocr" as const, extractedText: null };
}

export class SubmissionsService {
  constructor(private storage: StorageProvider) {}

  /**
   * Create a new submission:
   * - Validates size (multer already enforces; this is a backstop)
   * - Saves the original to StorageProvider
   * - Inserts submission + event rows
   * - Emits a second event immediately when we already consider it "parsed"
   */
  async createSubmission(opts: {
    assignmentId: string;
    studentId: string;
    grade: string | null;
    buf: Buffer;
    mime: string;
    originalName?: string;
    correlationId?: string | null;
    dataMode?: string;
  }): Promise<{
    submissionId: string;
    status: "received";
    extractionStatus: "parsed" | "pending_ocr";
    ocrRequired: boolean;
  }> {
    const db = getDb();

    // Defensive max-size check (10 MB)
    if (opts.buf.length > 10 * 1024 * 1024) {
      throw Object.assign(new Error("Max file size is 10 MB"), { http: 413, code: "too_large" });
    }

    // ---- Idempotency pre-check using (assignmentId, studentId, sha256) ----
    const contentSha = sha256(opts.buf);
    {
      const q = await db.query(
        `SELECT
           submission_id       AS "id",
           extraction_status   AS "extractionStatus",
           ocr_required        AS "ocrRequired"
         FROM app.submissions
         WHERE assignment_id = $1
           AND student_id    = $2
           AND sha256        = $3
         ORDER BY created_at ASC
         LIMIT 1`,
        [opts.assignmentId, opts.studentId, contentSha]
      );

      const hit = q.rows[0];
      if (hit) {
        // Idempotent duplicate → return existing submission (no new created event)
        console.info(JSON.stringify({
          event: "idempotent_hit",
          route: "POST /submissions",
          correlationId: opts.correlationId,
          submissionId: hit.id,
        }));
        return {
          submissionId: hit.id,
          status: "received",
          extractionStatus: hit.extractionStatus,
          ocrRequired: hit.ocrRequired,
        };
      }
    }

    

    // Generate a simple submission id (good enough for demo)
    const ext = pickExt(opts.mime);
    const submissionId = `sub_${Date.now().toString(16)}_${Math.random().toString(36).slice(2, 8)}`;

    // Persist original in storage (local or cloud)
    const saved = await this.storage.saveOriginal({
      buf: opts.buf,
      grade: opts.grade,
      assignmentId: opts.assignmentId,
      submissionId,
      ext,
    });

    // Initial extraction state
    const { ocrRequired, extractionStatus, extractedText } = decideExtraction(opts.mime, opts.buf);

    // Insert main submission row
    try {
      await db.query(
        `INSERT INTO app.submissions
          (submission_id, assignment_id, student_id, mime, size, sha256, storage_path,
            status, extraction_status, ocr_required, extracted_text, correlation_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          submissionId,
          opts.assignmentId,
          opts.studentId,
          opts.mime,
          saved.size,
          // saved.sha256,
          contentSha, 
          saved.storagePath,
          "received",
          extractionStatus,
          ocrRequired,
          extractedText,
          opts.correlationId ?? null,
        ]
      );
    } catch (e: any) {
      // Postgres unique_violation
      if (e?.code === "23505") {
        const r = await db.query(
          `SELECT submission_id AS "id", extraction_status AS "extractionStatus", ocr_required AS "ocrRequired"
          FROM app.submissions
          WHERE assignment_id = $1 AND student_id = $2 AND sha256 = $3
          ORDER BY created_at ASC LIMIT 1`,
          [opts.assignmentId, opts.studentId, contentSha]
        );
        const hit = r.rows[0];
        if (hit) {
          console.info(JSON.stringify({
            event: "idempotent_race_winner",
            correlationId: opts.correlationId,
            submissionId: hit.id,
          }));
          return {
            submissionId: hit.id,
            status: "received",
            extractionStatus: hit.extractionStatus,
            ocrRequired: hit.ocrRequired,
          };
        }
        throw e; // fallback
      }
      throw e;
    }
    
    // Emit created event
    await db.query(
      `INSERT INTO app.submission_events (submission_id, event_type, payload, correlation_id)
       VALUES ($1,$2,$3,$4)`,
      [
        submissionId,
        "submission.created",
        JSON.stringify({
          fileName: opts.originalName ?? "editor.txt",
          size: saved.size,
          dataMode: opts.dataMode ?? "sandbox",
        }),
        opts.correlationId ?? null,
      ]
    );

    // Invalidate related caches (e.g., course listing)
    const removed = await cacheDelByPrefix("courses:v1:");
    console.info(JSON.stringify({
      event: "cache_invalidate",
      reason: "submission.created",
      prefix: "courses:v1:",
      removed,
      correlationId: opts.correlationId ?? null,
    }));


    // Emit a follow-up event when parsed immediately
    if (extractionStatus === "parsed") {
      await db.query(
        `INSERT INTO app.submission_events (submission_id, event_type, payload, correlation_id)
         VALUES ($1,$2,$3,$4)`,
        [submissionId, "submission.parsed", JSON.stringify({ stub: true }), opts.correlationId ?? null]
      );
    } else if (ocrRequired) {
      await db.query(
        `INSERT INTO app.submission_events (submission_id, event_type, payload, correlation_id)
         VALUES ($1,$2,$3,$4)`,
        [submissionId, "submission.ocr_pending", JSON.stringify({ reason: "image_or_scanned_pdf" }), opts.correlationId ?? null]
      );
    }

    return { submissionId, status: "received", extractionStatus, ocrRequired };
  }

  /** List a window of submissions (internal DB shape). */
  async listSubmissions(
    limit: number,
    offset: number
  ): Promise<{ items: SubmissionRowDb[]; count: number }> {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT
         submission_id     AS "id",
         assignment_id     AS "assignmentId",
         student_id        AS "studentId",
         mime, size, status,
         extraction_status AS "extractionStatus",
         ocr_required      AS "ocrRequired",
         extracted_text    AS "extractedText",
         storage_path      AS "storagePath",
         created_at        AS "createdAt",
         updated_at        AS "updatedAt"
       FROM app.submissions
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { items: rows, count: rows.length };
  }

  /** Fetch a single submission by id (internal DB shape). */
  async getSubmission(id: string): Promise<SubmissionRowDb | null> {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT
         submission_id     AS "id",
         assignment_id     AS "assignmentId",
         student_id        AS "studentId",
         mime, size, status,
         extraction_status AS "extractionStatus",
         ocr_required      AS "ocrRequired",
         extracted_text    AS "extractedText",
         storage_path      AS "storagePath",
         created_at        AS "createdAt",
         updated_at        AS "updatedAt"
       FROM app.submissions
       WHERE submission_id = $1`,
      [id]
    );
    return rows[0] ?? null;
  }

  /**
   * Resolve how to read the original artifact for a submission:
   * - local dev → absolute file path
   * - cloud (e.g., Azure) → time-limited URL
   */
  async getArtifactLocator(id: string) {
    const db = getDb();
    const { rows } = await db.query(
      `SELECT storage_path FROM app.submissions WHERE submission_id = $1`,
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    return this.storage.getReadLocator(row.storage_path);
  }
}