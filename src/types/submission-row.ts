/**
 * Internal DB-facing shape for submissions (what we read/write in Postgres).
 * Keep this decoupled from the public OpenAPI type so DB changes don’t
 * accidentally break the API contract.
 */
export interface SubmissionRowDb {
  id: string;
  grade?: string | null;
  assignmentId: string;
  studentId: string;
  mime: string;
  size: number;
  status: "received" | "error" | "deleted";
  extractionStatus: "parsed" | "pending_ocr";
  ocrRequired: boolean;
  extractedText: string | null;
  storagePath: string;
  createdAt: string;
  updatedAt?: string;
}