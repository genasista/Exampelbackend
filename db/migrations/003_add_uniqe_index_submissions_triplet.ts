import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  // Ensure the index exists on schema "app"
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_triplet
    ON app.submissions (assignment_id, student_id, sha256)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS submissions_unique_triplet
  `);
}