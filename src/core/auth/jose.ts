 /**
 * Lazy loader for the `jose` library.
 *
 * What is `jose`?
 * - A standards-compliant JOSE/JWT toolkit for Node/TS.
 * - You use it to:
 *   • Sign JWTs (SignJWT)
 *   • Verify JWTs (jwtVerify)
 *   • Work with JWKS (createRemoteJWKSet) — fetches public keys from
 *     an issuer’s `/.well-known/jwks.json`
 *   • Generate/export keys (generateKeyPair, exportJWK)
 *
 * Why lazy-load?
 * - `jose` pulls in crypto code; deferring the import improves startup time.
 * - Dynamic `import()` works in both ESM and CommonJS setups.
 * - We cache the *in-flight promise* so concurrent callers don’t trigger
 *   multiple imports — the first call starts the import, others await it.
 */

let _mod: typeof import('jose') | null = null;
export async function jose() {
  // First call: _josePromise is null → start dynamic import and cache the promise.
  // Later calls: return the same promise (already in-flight or resolved).
  return (_mod ??= await import('jose')); // caching after first import
}