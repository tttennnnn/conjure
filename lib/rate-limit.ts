// In-memory sliding window rate limiter.
//
// Vercel serverless limitation: each function instance has its own memory,
// and cold starts reset all state. This means rate limits are best-effort --
// they catch rapid abuse within a warm instance but won't persist across
// cold starts or concurrent instances. For a production system, use a
// persistent store (e.g., Upstash Redis or a database table).

interface RateLimitResult {
  success: boolean;
  remaining: number;
}

interface SlidingWindow {
  timestamps: number[];
}

const store = new Map<string, SlidingWindow>();

export function createRateLimiter(
  name: string,
  config: { maxRequests: number; windowMs: number },
) {
  return function check(key: string): RateLimitResult {
    const now = Date.now();
    const storeKey = `${name}:${key}`;
    const windowStart = now - config.windowMs;

    let entry = store.get(storeKey);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(storeKey, entry);
    }

    // Prune timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= config.maxRequests) {
      return { success: false, remaining: 0 };
    }

    entry.timestamps.push(now);
    return {
      success: true,
      remaining: config.maxRequests - entry.timestamps.length,
    };
  };
}

// Periodic cleanup to prevent unbounded memory growth
const CLEANUP_INTERVAL_MS = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > now - 120_000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);
