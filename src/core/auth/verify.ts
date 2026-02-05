import { jose } from "./jose";

/**
 * Verifies a JWT access token against a remote JWKS.
 *
 * Configuration (via env):
 *  - AUTH_ISSUER   : expected token issuer (e.g., https://tenant.auth0.com or http://localhost:3001 in dev)
 *  - AUTH_AUDIENCE : expected audience claim
 *  - AUTH_JWKS_URL : JWKS endpoint; defaults to `${AUTH_ISSUER}/.well-known/jwks.json`
 *
 * Behavior:
 *  - Fetches signing keys using a cached remote JWKS (with cooldown/ttl/timeout).
 *  - Enforces issuer/audience and a small clock tolerance.
 *  - Restricts algorithm to RS256 (aligns with dev issuer); adjust as needed.
 *  - Throws an Error with a concise, developer-friendly message on failure.
 */
export async function verifyBearer(token: string) {
  const { jwtVerify, createRemoteJWKSet } = await jose();

  const issuer   = process.env.AUTH_ISSUER   || "http://localhost:3001";
  const audience = process.env.AUTH_AUDIENCE || "genassista-api";
  const jwksUrl  = process.env.AUTH_JWKS_URL || `${issuer}/.well-known/jwks.json`;

  // Remote JWKS with simple caching and timeouts to avoid per-request network overhead.
  const JWKS = createRemoteJWKSet(new URL(jwksUrl), {
    cooldownDuration: 30_000, // how long to wait before re-fetching after a miss
    cacheMaxAge:      60_000, // how long to keep a successful JWKS in memory
    timeoutDuration:   5_000, // HTTP fetch timeout for the JWKS endpoint
  });

  try {
    const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
      issuer,
      audience,
      clockTolerance: "5s",
    });

    // Align accepted algorithms with the issuer configuration (dev uses RS256).
    if (protectedHeader.alg !== "RS256") {
      throw new Error("Unsupported JWT algorithm");
    }

    return { payload: payload as any, header: protectedHeader };
  } catch (e: any) {
    // Convert common jose errors into short, actionable messages.
    const message =
      e?.code === "ERR_JWT_EXPIRED"                           ? "Token expired" :
      (e?.code === "ERR_JWT_CLAIM_INVALID" && /nbf/.test(e?.message ?? "")) ? "Token not yet valid" :
      e?.code === "ERR_JWKS_NO_MATCHING_KEY"                  ? "No matching key (kid) in JWKS" :
      e?.message || "Invalid token";

    // Let upstream middleware format the HTTP response consistently.
    throw new Error(message);
  }
}