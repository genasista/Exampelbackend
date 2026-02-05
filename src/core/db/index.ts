/**
 * Thin re-export layer for DB helpers.
 *
 * Why:
 * - Keeps import paths stable (`@core/db`) even if we move the actual
 *   implementation later.
 * - Avoids deep relative imports throughout modules.
 */
export { getDb, closeDbIfAny } from "./pool";