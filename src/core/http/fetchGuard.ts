import { trackEvent } from "@core/observability/telemetry";
import { dataMode } from "./middlewares/dataMode";

const ALLOWLIST: RegExp[] = [
    /\.internal$/i,
    /\.svc\.cluster\.local$/i,
    /\.azurewebsites\.net$/i,
    /^localhost$/i,
    /^127\.0\.0\.1$/,
  ];

  function isExternal(host: string) {
    return !ALLOWLIST.some((rx) => rx.test(host));
  }
  
  // Global guard for Node 20+ fetch
  export function installFetchGuard() {
    const mode = (process.env.DATA_MODE ?? "sandbox").toLowerCase();
    if (mode !== "sandbox" || typeof globalThis.fetch !== "function") return;
  
    const origFetch = globalThis.fetch.bind(globalThis);
  
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input.toString() : (input as Request).url);
  
      // block external egress in sandbox
      if ((url.protocol === "http:" || url.protocol === "https:") && isExternal(url.hostname)) {
        trackEvent("egress_blocked", { url: url.toString(), hostname: url.hostname, dataMode: mode });
        const err: any = new Error(`Egress blocked by sandbox guard to ${url.hostname}`);
        err.code = "EGRESS_BLOCKED";
        throw err;
      }
  
      // inject X-Data-Mode if missing
      const mergedHeaders = new Headers(
        (init && init.headers) ||
          (typeof input !== "string" && !(input instanceof URL) ? (input as Request).headers : undefined) ||
          {},
      );
      if (!mergedHeaders.has("X-Data-Mode")) mergedHeaders.set("X-Data-Mode", mode);
  
      if (typeof input === "string" || input instanceof URL) {
        return origFetch(url.toString(), { ...(init || {}), headers: mergedHeaders });
      } else {
        const req = new Request(input as Request, { ...(init || {}), headers: mergedHeaders });
        return origFetch(req);
      }
    }) as typeof fetch;
  }