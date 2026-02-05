import { Router } from "express";
import { getBufferedEvents } from "../../observability/telemetry";

type TelemetryEvent = {
  ts: string;            // ISO-tid
  name: string;          // t.ex. "sandbox_marker", "egress_blocked"
  properties?: Record<string, any>;
};

const router = Router();

// GET /__sandbox/logs?name=sandbox_marker&minutes=120
router.get("/logs", (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name : "";
  const minutes = Number(req.query.minutes ?? 60);
  const dataMode = typeof req.query.dataMode === "string" ? req.query.dataMode.toLowerCase() : "";
  const since = Date.now() - minutes * 60_000;

  const events: TelemetryEvent[] = (getBufferedEvents?.() ?? []) as any[];
  const items = events.filter((e) => {
    const t = Date.parse(e.ts);
    const okTime = Number.isFinite(t) ? t >= since : true;
    const okName = name ? e.name === name : true;
    const evMode = String(e.properties?.dataMode ?? "").toLowerCase();
    const okMode = dataMode ? evMode === dataMode : true;
    return okTime && okName && okMode;
  });

  res.json({ count: items.length, items });
});

export default router;