/**
 * In-memory sliding-window rate limiter per client key (IP).
 * Returns 429 when the window is exceeded.
 */

const buckets = new Map();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 8;

function pruneOld(timestamps, now) {
  const cutoff = now - WINDOW_MS;
  while (timestamps.length && timestamps[0] <= cutoff) {
    timestamps.shift();
  }
}

export function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

export function rateLimitMiddleware(req, res, next) {
  const key = clientKey(req);
  const now = Date.now();

  let timestamps = buckets.get(key);
  if (!timestamps) {
    timestamps = [];
    buckets.set(key, timestamps);
  }

  pruneOld(timestamps, now);

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfterSec = Math.ceil(
      (timestamps[0] + WINDOW_MS - now) / 1000,
    );
    res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
    return res.status(429).json({
      error: "too_many_requests",
      message: "Çok fazla geri bildirim gönderildi. Lütfen biraz sonra tekrar deneyin.",
      retry_after_seconds: Math.max(1, retryAfterSec),
    });
  }

  timestamps.push(now);
  next();
}

/** Test / graceful shutdown helper */
export function resetRateLimitStore() {
  buckets.clear();
}

export function rateLimitConfig() {
  return { window_ms: WINDOW_MS, max_requests: MAX_REQUESTS };
}
