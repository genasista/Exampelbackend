// db/migrations/001_init.ts
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1) Schema
  await knex.raw(`CREATE SCHEMA IF NOT EXISTS app;`);

  // 2) Enums
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
        CREATE TYPE app.submission_status AS ENUM ('received','error','deleted');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'extraction_status') THEN
        CREATE TYPE app.extraction_status AS ENUM ('parsed','pending_ocr');
      END IF;
    END$$;
  `);

  // 3) submissions
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app.submissions (
      submission_id      TEXT PRIMARY KEY,
      assignment_id      TEXT        NOT NULL,
      student_id         TEXT        NOT NULL,
      mime               TEXT        NOT NULL,
      size               INTEGER     NOT NULL CHECK (size > 0 AND size <= 10485760),
      sha256             TEXT,
      storage_path       TEXT        NOT NULL,
      status             app.submission_status NOT NULL,
      extraction_status  app.extraction_status NOT NULL,
      ocr_required       BOOLEAN     NOT NULL,
      extracted_text     TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      correlation_id     TEXT
    );
    COMMENT ON TABLE  app.submissions IS 'Stores metadata for uploaded artifacts (originals live in Blob).';
    COMMENT ON COLUMN app.submissions.size         IS 'Original file size in bytes (≤ 10 MB).';
    COMMENT ON COLUMN app.submissions.storage_path IS 'Blob path to the original.';
    COMMENT ON COLUMN app.submissions.extracted_text IS 'Stub text when parsed; NULL otherwise.';
    COMMENT ON COLUMN app.submissions.correlation_id IS 'Echo of request correlation id for tracing.';
  `);

  // 4) updated_at trigger
  await knex.raw(`
    CREATE OR REPLACE FUNCTION app.set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END$$;

    DROP TRIGGER IF EXISTS trg_submissions_updated_at ON app.submissions;
    CREATE TRIGGER trg_submissions_updated_at
    BEFORE UPDATE ON app.submissions
    FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
  `);

  // 5) Indexes
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id  ON app.submissions (assignment_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_student_id     ON app.submissions (student_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_status         ON app.submissions (status);
    CREATE INDEX IF NOT EXISTS idx_submissions_extraction     ON app.submissions (extraction_status);
    CREATE INDEX IF NOT EXISTS idx_submissions_created_at     ON app.submissions (created_at DESC);
  `);

  // 6) Events table
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app.submission_events (
      event_id        BIGSERIAL PRIMARY KEY,
      submission_id   TEXT        NOT NULL REFERENCES app.submissions(submission_id) ON DELETE CASCADE,
      event_type      TEXT        NOT NULL CHECK (event_type IN ('submission.received','submission.parsed','submission.ocr_pending')),
      payload         JSONB,
      correlation_id  TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_submission_events_sub  ON app.submission_events (submission_id);
    CREATE INDEX IF NOT EXISTS idx_submission_events_type ON app.submission_events (event_type);
    CREATE INDEX IF NOT EXISTS idx_submission_events_time ON app.submission_events (created_at DESC);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop in reverse order; down() should be idempotent-ish
  await knex.raw(`DROP TABLE IF EXISTS app.submission_events;`);
  await knex.raw(`DROP TABLE IF EXISTS app.submissions;`);
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'extraction_status') THEN
        DROP TYPE app.extraction_status;
      END IF;
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
        DROP TYPE app.submission_status;
      END IF;
    END$$;
  `);
  await knex.raw(`DROP SCHEMA IF EXISTS app CASCADE;`);
}
