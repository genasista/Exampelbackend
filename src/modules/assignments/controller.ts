/**
 * Assignments controller (demo/sandbox data).
 *
 * Exposes a cursor-based paginated list with an optional `courseId` filter.
 * Source data is a JSON fixture to keep things deterministic in demo.
 *
 * Pagination:
 * - `cursor` is an opaque, base64url-encoded offset (see utils/cursor).
 * - `pageSize` is clamped to [1, 200].
 * - If there is another page, `X-Next-Cursor` is set on the response.
 */

import { Request, Response, NextFunction } from "express";
import { decodeCursor, encodeCursor } from "../../utils/cursor";
import all from "./fixtures/assignments.json";
import { AssignmentList } from "../../core/contracts/types";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    // Optional filter by course
    const courseId = (req.query.courseId as string | undefined) || undefined;
    const filtered = courseId
      ? (all as any[]).filter(a => a.courseId === courseId)
      : (all as any[]);

    // Page window (hard-clamped for safety)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 50), 1), 200);

    // Decode opaque cursor → numeric start index
    const start = decodeCursor(req.query.cursor as string | undefined);

    // Slice a window of results
    const items = filtered.slice(start, start + pageSize);

    // Prepare the next cursor if we have more items
    const nextCursor = start + pageSize < filtered.length ? encodeCursor(start + pageSize) : "";
    if (nextCursor) res.setHeader("X-Next-Cursor", nextCursor);

    // Shape matches OpenAPI schema
    const payload: AssignmentList = { items, count: items.length };
    res.json(payload);
  } catch (e) {
    next(e);
  }
}