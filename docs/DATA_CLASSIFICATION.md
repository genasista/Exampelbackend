# Data Classification (Sandbox Draft)

| Category                 | Examples                                         | Retention         | Logs/Trace                     | Access (role)           |
|--------------------------|--------------------------------------------------|-------------------|-------------------------------|-------------------------|
| Reference data (demo)    | municipality, school, teacher, student, course   | For demo only     | request logs (corrId)         | developer (local)       |
| Assignment metadata      | assignment id/title/due                          | For demo only     | request logs (corrId)         | developer (local)       |
| Submission metadata      | submission_id, mime, size, extraction status     | For demo only     | submission_events, corrId     | developer (local)       |
| Submission artifact (fs) | ./artifacts/original.ext                         | For demo only     | none (path in DB)             | developer (local)       |
| Usage metrics            | app.usage_daily (day, school_id, count)          | For demo only     | request logs (corrId), usage  | developer (local)       |

Notes
- Demo environment only; all data is synthetic.
- Link to audit/usage: `app.submission_events`, `app.usage_daily`.
- No external egress in sandbox; see `/__sandbox/prove-egress-block`.
