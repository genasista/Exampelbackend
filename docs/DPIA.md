# DPIA (Draft) — Arc Unified Core + Learning App (Sandbox)

Status: Draft (local sandbox, no egress)

## Scope
- Components: Arc Unified Core (API, Postgres, local storage), Learning App (Control Center), RabbitMQ (events)
- Data: demo school data (municipality/school/teacher/student/course/assignment), submission metadata, usage metrics
- Processing: read-only demo CSV, sandbox uploads as dummy content

## Lawful basis (sandbox)
- Demo/training only with synthetic data.

## Roles
- Controller: Demo team (sandbox)
- Processor: N/A (same team, local)

## Data flows (high-level)
- Ingress: HTTP → Core (API key), optional dev JWT for admin
- Processing: Core (Express/TS), events to RabbitMQ
- Storage: Postgres (app.*), local filesystem ./artifacts
- Egress: Blocked by fetch guard (see /__sandbox/prove-egress-block)
- Observability: correlation logs, submission_events, usage_daily

## Risks & Controls
- R1 Unintended egress → fetch guard + negative test route
- R2 Excessive logging → compact JSON logs, no bodies, correlationId
- R3 Retention creep → documented retention; dummy data only
- R4 Weak auth (demo) → API key at gateway; dev JWT for admin only

## Controls (summary)
- Access: API key; dev JWT in demo; CORS local origins
- Minimisation: limited schemas; no sensitive PII in demo
- Auditability: correlation id, submission_events, usage_daily
- Storage: local-only in sandbox; Azure private containers (prod)
- Egress: guard + test route

## Human-in-the-loop (HIL)
- Any AI feedback must be teacher-reviewed before release to students.

## Retention (sandbox)
- Demo CSV/artifacts local; purge as needed
- Logs/usage retained locally for demo graphs

## Residual risk (sandbox)
- Low, given synthetic data, local-only processing, egress blocked.
