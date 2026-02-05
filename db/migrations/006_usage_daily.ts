import type { Knex } from "knex";

/**
 * SCRUM-18: Usage aggregation table
 * Aggregates API calls per school and day for dashboard graphs.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE SCHEMA IF NOT EXISTS app`);

  await knex.schema.withSchema("app").createTable("usage_daily", (t) => {
    t.date("day").notNullable();
    t.integer("school_id").notNullable();
    t.integer("count").notNullable().defaultTo(0);
    t.primary(["day", "school_id"], { constraintName: "usage_daily_pk" });
  });

  await knex.schema.withSchema("app").raw(`
    CREATE INDEX IF NOT EXISTS usage_daily_day_idx ON app.usage_daily (day);
    CREATE INDEX IF NOT EXISTS usage_daily_school_idx ON app.usage_daily (school_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema("app").dropTableIfExists("usage_daily");
}


