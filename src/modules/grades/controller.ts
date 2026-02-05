/**
 * Grades controller (demo/sandbox data).
 *
 * Supports optional filtering by `assignmentId`, and cursor-based pagination.
 * Returns `X-Next-Cursor` when there’s another page.
 */

import { Request, Response, NextFunction } from "express";
import { decodeCursor, encodeCursor } from "../../utils/cursor";
import all from "./fixtures/grades.json";
import { GradeList } from "../../core/contracts/types";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const assignmentId = (req.query.assignmentId as string | undefined) || undefined;
    const filtered = assignmentId
      ? (all as any[]).filter(g => g.assignmentId === assignmentId)
      : (all as any[]);

    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 50), 1), 200);
    const start = decodeCursor(req.query.cursor as string | undefined);

    const items = filtered.slice(start, start + pageSize);
    const nextCursor = start + pageSize < filtered.length ? encodeCursor(start + pageSize) : "";
    if (nextCursor) res.setHeader("X-Next-Cursor", nextCursor);

    const payload: GradeList = { items, count: items.length };
    res.json(payload);
  } catch (e) {
    next(e);
  }
}