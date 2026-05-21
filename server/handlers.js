import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { requireAdmin } from "./auth.js";
import { applyCors, handleOptions } from "./cors.js";
import { insertFeedback, listFeedback, feedbackStats, storageBackend } from "./store.js";
import { rateLimitMiddleware } from "./rateLimit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizePayload(body) {
  if (!body || typeof body !== "object") {
    return { error: "invalid_body" };
  }

  if (body.skipped === true) {
    return { skipped: true };
  }

  const enjoyment = Number(body.enjoyment);
  return {
    skipped: false,
    enjoyment: Number.isFinite(enjoyment) && enjoyment >= 1 && enjoyment <= 5
      ? enjoyment
      : null,
    continue_ch2: typeof body.continue === "string" ? body.continue.slice(0, 64) : null,
    favourite: typeof body.favourite === "string" ? body.favourite.slice(0, 128) : null,
    feel: typeof body.feel === "string" ? body.feel.slice(0, 64) : null,
    comment: typeof body.comment === "string" ? body.comment.slice(0, 2000) : null,
  };
}

function wrap(handler) {
  return (req, res) => {
    applyCors(req, res);
    if (handleOptions(req, res)) return;
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error("[feedback-api]", err);
      res.status(500).json({ error: "internal_error" });
    });
  };
}

export const health = wrap(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  return res.json({ ok: true, storage: storageBackend() });
});

export const feedback = wrap((req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  rateLimitMiddleware(req, res, async () => {
    const payload = normalizePayload(req.body);
    if (payload.error) {
      return res.status(400).json({ error: payload.error });
    }

    try {
      const row = await insertFeedback({
        ...payload,
        client_ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
          || req.socket?.remoteAddress
          || null,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 512),
      });
      return res.status(201).json({ ok: true, id: row.id });
    } catch (err) {
      console.error("[feedback-api] insert failed:", err);
      return res.status(500).json({ error: "storage_failed" });
    }
  });
});

export const adminStats = wrap(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  requireAdmin(req, res, async () => {
    res.json(await feedbackStats());
  });
});

export const adminFeedback = wrap(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  requireAdmin(req, res, async () => {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    res.json({ items: await listFeedback({ limit, offset }) });
  });
});

export const adminPage = wrap(async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  requireAdmin(req, res, () => {
    const adminPath = path.join(__dirname, "admin.html");
    if (!fs.existsSync(adminPath)) {
      return res.status(500).send("admin.html bulunamadı");
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(fs.readFileSync(adminPath, "utf8"));
  });
});
