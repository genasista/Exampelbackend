import { Router } from "express";
import { getDb } from "@core/db";

const r = Router();

// GET /usage/daily?schoolId=123&from=2025-10-01&to=2025-10-31
r.get("/daily", async (req, res, next) => {
  try {
    const schoolId = req.query.schoolId ? parseInt(String(req.query.schoolId), 10) : undefined;
    const from = (req.query.from as string | undefined) || undefined; // YYYY-MM-DD
    const to = (req.query.to as string | undefined) || undefined;     // YYYY-MM-DD

    const where: string[] = [];
    const params: any[] = [];

    if (typeof schoolId === "number" && Number.isFinite(schoolId)) {
      params.push(schoolId);
      where.push(`school_id = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`day >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`day <= $${params.length}`);
    }

    const sql = `
      SELECT day, school_id AS "schoolId", count
      FROM app.usage_daily
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY day ASC, school_id ASC
    `;

    const { rows } = await getDb().query(sql, params);
    res.json({ items: rows, count: rows.length });
  } catch (e) {
    next(e);
  }
});

export default r;


