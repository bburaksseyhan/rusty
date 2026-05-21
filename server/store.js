import { Redis } from "@upstash/redis";

import * as sqlite from "./db.js";

const FEEDBACK_LIST = "feedback:list";
const FEEDBACK_SEQ = "feedback:seq";

let redis;

/** Vercel Upstash entegrasyonu KV_* verir; doğrudan Upstash UPSTASH_* verir. */
function redisEnv() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL
    || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

function getRedis() {
  if (!redis) {
    const env = redisEnv();
    if (env) {
      redis = new Redis(env);
    }
  }
  return redis;
}

function useRedis() {
  return Boolean(redisEnv());
}

async function insertRedis(row) {
  const client = getRedis();
  const id = await client.incr(FEEDBACK_SEQ);
  const record = {
    id,
    created_at: new Date().toISOString(),
    skipped: row.skipped ? 1 : 0,
    enjoyment: row.enjoyment ?? null,
    continue_ch2: row.continue_ch2 ?? null,
    favourite: row.favourite ?? null,
    feel: row.feel ?? null,
    comment: row.comment ?? null,
    client_ip: row.client_ip ?? null,
    user_agent: row.user_agent ?? null,
  };
  await client.zadd(FEEDBACK_LIST, {
    score: Date.now(),
    member: JSON.stringify(record),
  });
  return { id };
}

async function listRedis({ limit = 100, offset = 0 } = {}) {
  const client = getRedis();
  const raw = await client.zrange(FEEDBACK_LIST, offset, offset + limit - 1, {
    rev: true,
  });
  return raw.map((entry) => {
    const r = typeof entry === "string" ? JSON.parse(entry) : entry;
    return { ...r, skipped: Boolean(r.skipped) };
  });
}

async function statsRedis() {
  const client = getRedis();
  const raw = await client.zrange(FEEDBACK_LIST, 0, -1);
  const rows = raw.map((entry) => {
    const r = typeof entry === "string" ? JSON.parse(entry) : entry;
    return { ...r, skipped: Boolean(r.skipped) };
  });

  const total = rows.length;
  const skipped_count = rows.filter((r) => r.skipped).length;
  const submitted = rows.filter((r) => !r.skipped);
  const ratings = submitted
    .map((r) => r.enjoyment)
    .filter((n) => typeof n === "number" && n > 0);
  const avg_enjoyment = ratings.length
    ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
    : null;

  const countBy = (field) => {
    const map = new Map();
    for (const r of submitted) {
      const v = r[field];
      if (!v) continue;
      map.set(v, (map.get(v) || 0) + 1);
    }
    return [...map.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    total,
    skipped_count,
    submitted_count: total - skipped_count,
    avg_enjoyment,
    continue: countBy("continue_ch2"),
    favourite: countBy("favourite"),
    feel: countBy("feel"),
  };
}

export async function insertFeedback(row) {
  if (useRedis()) return insertRedis(row);
  return sqlite.insertFeedback(row);
}

export async function listFeedback(opts) {
  if (useRedis()) return listRedis(opts);
  return sqlite.listFeedback(opts);
}

export async function feedbackStats() {
  if (useRedis()) return statsRedis();
  return sqlite.feedbackStats();
}

export function storageBackend() {
  return useRedis() ? "redis" : "sqlite";
}
