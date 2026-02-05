/**
 * Ambient type for the `csv-parser` package.
 *
 * Why we need this:
 * - `csv-parser` doesn’t ship TypeScript types.
 * - Declaring a module here tells TS what the default export looks like.
 * - Keeps our code type-safe without sprinkling `any` everywhere.
 *
 * Scope:
 * - This is global to the project (picked up via `typeRoots` in tsconfig).
 */

declare module "csv-parser" {
  import { Transform } from "stream";
  function csv(options?: any): Transform;
  export default csv;
}