import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE SCHEMA IF NOT EXISTS app`);

  await knex.schema.withSchema("app").createTable("cache", (t) => {
    t.text("key").primary();
    t.jsonb("payload").notNullable();
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("expires_at", { useTz: true }).notNullable();
  });

  await knex.schema.withSchema("app").raw(`
    CREATE INDEX IF NOT EXISTS cache_expires_idx ON app.cache (expires_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema("app").dropTableIfExists("cache");
}