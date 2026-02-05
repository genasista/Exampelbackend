/**
 * Knex configuration (JS CommonJS, loaded by CLI and migration tooling).
 *
 * - Uses dotenv (via `require('dotenv/config')`) to read DATABASE_URL.
 * - Registers ts-node so TypeScript migrations in ./db/migrations run directly.
 * - Puts the *migration metadata* table in the PUBLIC schema (schemaName: "public").
 * - Sets searchPath to ["public","app"] so raw SQL without schema qualifier
 *   defaults to PUBLIC, but we can still reference objects under APP.
 *
 * Dev/Prod:
 * - We reuse the same base config for both; DATABASE_URL decides the target.
 * - If DATABASE_URL is missing, fall back to a local dev connection.
 */

require('dotenv/config');
require('ts-node').register();

/** @type {import('knex').Knex.Config} */
const base = {
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: '127.0.0.1',
    port: 5433,
    user: 'arc_user',
    password: 'arc_pw',
    database: 'arc_sandbox',
  },
  // Put PUBLIC first so anything “default” lands there
  searchPath: ['public', 'app'],
  pool: { min: 0, max: 10 },
  migrations: {
    directory: './db/migrations',
    extension: 'ts',
    tableName: 'knex_migrations',
    schemaName: 'public',     // <-- keep metadata in PUBLIC
  },
};

module.exports = { development: base, production: base };