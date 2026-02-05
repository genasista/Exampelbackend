/**
 * Users controller (demo/sandbox data).
 *
 * Optional filtering by `role`, cursor-based pagination,
 * `X-Next-Cursor` header when more pages are available.
 */

import { Request, Response, NextFunction } from "express";
import { decodeCursor, encodeCursor } from "../../utils/cursor";
import all from "./fixtures/users.json";
import { UserList } from "../../core/contracts/types";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const role = (req.query.role as string | undefined) || undefined;
    const filtered = role
      ? (all as any[]).filter(u => u.role === role)
      : (all as any[]);

    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 50), 1), 200);
    const start = decodeCursor(req.query.cursor as string | undefined);

    const items = filtered.slice(start, start + pageSize);
    const nextCursor = start + pageSize < filtered.length ? encodeCursor(start + pageSize) : "";
    if (nextCursor) res.setHeader("X-Next-Cursor", nextCursor);

    const payload: UserList = { items, count: items.length };
    res.json(payload);
  } catch (e) {
    next(e);
  }
}