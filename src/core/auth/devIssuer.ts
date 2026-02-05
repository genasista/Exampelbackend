import { Router } from "express";
import type { KeyLike, JWK } from "jose";
import { jose } from "./jose";

/**
 * DEV ISSUER
 * ----------
 * A JWT “issuer” for local/testing:
 * - Serves a JWKS at `/.well-known/jwks.json` (public keys)
 * - Mints RS256-signed test tokens at `/auth/dev/token`
 *
 * IMPORTANT: Mount this only in dev/demo. In production, tokens should be issued
 * by a real IdP (Auth0, Azure AD, Google, …) and verified by your API.
 */

type KeyBundle = {
  privateKey: KeyLike;
  publicJwk: JWK; 
  kid: string;
};

/**
 * We keep a single keypair (and its JWK) for the process lifetime.
 * `keyPromise` caches the *in-flight promise* so concurrent calls don’t race.
 */
let keyPromise: Promise<KeyBundle> | null = null;

/**
 * ensureKey()
 * - Generates an RS256 keypair once, exports public key as JWK, assigns a kid,
 *   and caches the result.
 * - For production, you’d persist keys and implement rotation (and stable KIDs).
 */
async function ensureKey(): Promise<KeyBundle> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const { generateKeyPair, exportJWK } = await jose();

      // RS256 (RSA + SHA-256). `extractable: true` is fine here because we only export the *public* key.
      const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });

      // Publishable public JWK for the JWKS endpoint
      const jwk: JWK = await exportJWK(publicKey);

      // Simple, non-cryptographic kid for dev. In real issuers, use a stable ID (e.g., key fingerprint).
      const kid = Math.random().toString(36).slice(2);

      // add standard JWK metadata used by verifiers
      jwk.kid = kid;
      jwk.alg = "RS256";
      jwk.use = "sig";

      return { privateKey, publicJwk: jwk, kid };
    })();
  }
  return keyPromise;
}

/**
 * devIssuerRouter()
 * - GET `/.well-known/jwks.json`: serves the public key set (JWKS)
 * - GET `/auth/dev/token`: mints a short-lived JWT with simple role claims
 *
 * Clients verifying tokens:
 * - Read the JWT header.kid
 * - Fetch JWKS from `/.well-known/jwks.json`
 * - Pick the matching JWK by kid and verify RS256 signature + claims (iss/aud/exp/nbf)
 */
export function devIssuerRouter() {
  const r = Router();

  // Standard JWKS endpoint (well-known path). Contains *public* keys only.
  r.get("/.well-known/jwks.json", async (_req, res) => {
    const { publicJwk } = await ensureKey();
    res.json({ keys: [publicJwk] as JWK[] });
  });

  /**
   * Mint test JWTs
   * Example:
   *   /auth/dev/token?role=admin&sub=admin_1
   *   /auth/dev/token?role=teacher&sub=teacher_1&ttl=1h
   *
   * Query params:
   * - role: "admin" | "teacher" (default: "teacher")
   * - sub: subject/user id (default: based on role)
   * - ttl / expiresIn: jose duration (e.g., 15m, 1h, 24h). Default: "15m"
   */
r.get("/auth/dev/token", async (req, res) => {
  // Coerce role to the two we support
  const rawRole = (req.query.role as string | undefined)?.toLowerCase();
  const role = rawRole === "admin" ? "admin" : "teacher";

  const sub = (req.query.sub as string | undefined) || (role === "admin" ? "admin-1" : "teacher-1");

  const iss = process.env.AUTH_ISSUER   || "http://localhost:3001";
  const aud = process.env.AUTH_AUDIENCE || "genassista-api";

  // Optional TTL (?ttl=15m|1h|24h). Guard a bit so nobody asks for 10-15 years instead of minutes.
  const ttlParam = (req.query.ttl as string | undefined)
                || (req.query.expiresIn as string | undefined)
                || "15m";
  const ttl = /^[0-9]+(s|m|h|d)$/.test(ttlParam) ? ttlParam : "15m";

  const { SignJWT } = await jose();
  const { privateKey, kid } = await ensureKey();

  const token = await new SignJWT({ roles: [role] })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(iss)
    .setAudience(aud)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(privateKey);

  res.json({
    token,
    tokenType: "Bearer",
    role,
    sub,
    iss,
    aud,
    expiresIn: ttl,
  });
});

  return r;
}
