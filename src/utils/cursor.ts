/**
 * Utilities for handling pagination cursors in API endpoints.
 *
 * Instead of exposing a raw numeric offset (?offset=100),
 * we encode/decode it as a base64url string (?cursor=MTAw).
 *
 * Benefits:
 * - Clients see an opaque cursor, not an internal offset.
 * - The API contract stays stable even if pagination logic changes later.
 * - Works seamlessly with endpoints that support pagination:
 *   e.g. GET /courses?pageSize=50&cursor=MTAw
 *
 * Usage:
 *   const offset = decodeCursor(req.query.cursor);
 *   const nextCursor = encodeCursor(offset + pageSize);
 */

// =========================================================================

/**
 * Encode a numeric offset into a base64url string.
 * Used as a cursor for pagination (opaque to clients).
 */
export function encodeCursor(n: number) {
  return Buffer.from(String(n), "utf8").toString("base64url");
}

/**
 * Decode a base64url cursor back into a numeric offset.
 * Returns 0 if the cursor is missing, invalid, or negative.
 */
export function decodeCursor(c?: string) {
  if (!c) {
    return 0;
  }
  const s = Buffer.from(c, "base64url").toString("utf8");
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}