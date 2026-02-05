import "dotenv/config";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const API_KEY = (process.env.API_KEYS || "demo-key").split(",")[0];
const SCHOOL_ID = Number(process.env.DEMO_SCHOOL_ID || 1);

async function hit(path: string) {
  const r = await fetch(`${BASE}${path}`, {
    headers: {
      "X-Api-Key": API_KEY,
      "X-School-Id": String(SCHOOL_ID),
    } as any,
  });
  await r.text().catch(() => undefined);
}

async function main() {
  const paths = [
    "/courses",
    "/users",
    "/assignments",
    "/grades",
  ];
  const n = Number(process.env.DEMO_TRAFFIC_BURST || 20);
  for (let i = 0; i < n; i++) {
    const p = paths[i % paths.length];
    // fire-and-forget parallelism
    hit(p).catch(() => {});
  }
  console.log(`Triggered ${n} demo requests for school ${SCHOOL_ID}`);
}

main();


