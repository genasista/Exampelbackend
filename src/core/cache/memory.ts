type Entry<T> = { value: T; expiresAt: number };
const map = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const e = map.get(key);
  if (!e) return undefined;
  if (Date.now() >= e.expiresAt) { map.delete(key); return undefined; }
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}