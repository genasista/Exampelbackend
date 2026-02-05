import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // 1) Keep existing data valid by allowing both new and legacy values
  await knex.raw(`
    ALTER TABLE app.submission_events
    DROP CONSTRAINT IF EXISTS submission_events_event_type_check;
  `);

  await knex.raw(`
    ALTER TABLE app.submission_events
    ADD CONSTRAINT submission_events_event_type_check
    CHECK (
      event_type IN (
        'submission.created',
        'submission.updated',
        'submission.parsed',
        'submission.ocr_pending',
        'submission.received' -- legacy rows still in DB
      )
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Revert to the likely original set (adjust if your original differed)
  await knex.raw(`
    ALTER TABLE app.submission_events
    DROP CONSTRAINT IF EXISTS submission_events_event_type_check;
  `);

  await knex.raw(`
    ALTER TABLE app.submission_events
    ADD CONSTRAINT submission_events_event_type_check
    CHECK (
      event_type IN (
        'submission.received',
        'submission.parsed',
        'submission.ocr_pending'
      )
    );
  `);
}