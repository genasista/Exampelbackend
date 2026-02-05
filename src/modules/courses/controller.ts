/**
 * GET /courses (demo cache)
 *
 * Cursor-based pagination over a static JSON fixture, with a small in-memory
 * cache so the first request is a MISS and subsequent requests within TTL are HITs.
 *
 * - Keyed by: start (cursor offset) + pageSize
 * - TTL: process.env.COURSES_CACHE_TTL_MS (default 30s)
 * - Logs: cache_hit / cache_miss with correlationId
 * - Still returns X-Next-Cursor when another page exists
 *
 * NOTE:
 * - This is an in-process cache only (resets on restart).
 * - SCRUM-10 will replace this with a DB-backed cache + invalidation.
 */

import { Request, Response, NextFunction } from "express";
import { decodeCursor, encodeCursor } from "../../utils/cursor";
import all from "./fixtures/courses.json";
import { CourseList } from "@core/contracts/types";
// import { cacheGet, cacheSet } from "@core/cache/memory";
import { cacheGet, cacheSet } from "@core/cache/db"; // not memory


const TTL_MS = Number(process.env.COURSES_CACHE_TTL_MS ?? 30_000);

function keyFor(start: number, pageSize: number) {
  // include a version segment ("v1") so you can invalidate all keys by bumping it
  return `courses:v1:start=${start}:size=${pageSize}`;
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 50), 1), 200);
    const start = decodeCursor(req.query.cursor as string | undefined);
    const key = keyFor(start, pageSize);
    // const now = Date.now();

    // Try cache first
    const cached = await cacheGet<CourseList>(key);
    if (cached) {
      res.setHeader("X-Cache", "HIT");

      const hasMore = start + pageSize < (all as any[]).length;
      if (hasMore) res.setHeader("X-Next-Cursor", encodeCursor(start + pageSize));

      console.info(JSON.stringify({
        event: "cache_hit",
        route: "GET /courses",
        correlationId: (req as any).correlationId,
        key,
      }));

      return res.json(cached);
    }

    // MISS → build payload
    const items = (all as any[]).slice(start, start + pageSize);
    const nextCursor = start + pageSize < (all as any[]).length ? encodeCursor(start + pageSize) : "";
    if (nextCursor) res.setHeader("X-Next-Cursor", nextCursor);

    const payload: CourseList = { items, count: items.length };

    // Store via shared cache (TTL handled inside)
    cacheSet<CourseList>(key, payload, TTL_MS);
    res.setHeader("X-Cache", "MISS");

    console.info(JSON.stringify({
      event: "cache_miss",
      route: "GET /courses",
      correlationId: (req as any).correlationId,
      key,
      ttlMs: TTL_MS,
    }));

    return res.json(payload);
  } catch (e) {
    next(e);
  }
}