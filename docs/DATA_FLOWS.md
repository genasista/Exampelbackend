# Data Flows (Sandbox) — Arc + Learning App

Text diagram (high-level)

Client(UI)
  -> HTTP (API key) -> Arc Unified Core (Express/TS)
     -> Postgres (app.* tables)
     -> Local FS ./artifacts (sandbox only)
     -> RabbitMQ (submission events)

Observability
- x-correlation-id on requests/responses
- submission_events for lifecycle
- usage_daily for aggregated API usage

Egress Policy
- Sandbox egress blocked by fetch guard; test via /__sandbox/prove-egress-block

Roles
- Admin routes behind dev JWT (demo only)
- API key gateway for public endpoints

Notes
- No direct UI→Python calls; UI talks to Core only.
- Any Python/ML (future) should be called by Core or via queue.
