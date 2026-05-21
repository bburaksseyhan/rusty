import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { insertFeedback, listFeedback, feedbackStats } from "./db.js";
import { rateLimitMiddleware, rateLimitConfig } from "./rateLimit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));

app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

function normalizePayload(body) {
  if (!body || typeof body !== "object") {
    return { error: "invalid_body" };
  }

  if (body.skipped === true) {
    return { skipped: true };
  }

  const enjoyment = Number(body.enjoyment);
  const payload = {
    skipped: false,
    enjoyment: Number.isFinite(enjoyment) && enjoyment >= 1 && enjoyment <= 5
      ? enjoyment
      : null,
    continue_ch2: typeof body.continue === "string" ? body.continue.slice(0, 64) : null,
    favourite: typeof body.favourite === "string" ? body.favourite.slice(0, 128) : null,
    feel: typeof body.feel === "string" ? body.feel.slice(0, 64) : null,
    comment: typeof body.comment === "string" ? body.comment.slice(0, 2000) : null,
  };

  return payload;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/feedback", rateLimitMiddleware, (req, res) => {
  const payload = normalizePayload(req.body);
  if (payload.error) {
    return res.status(400).json({ error: payload.error });
  }

  try {
    const row = insertFeedback({
      ...payload,
      client_ip: req.ip || null,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 512),
    });
    return res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    console.error("[feedback-api] insert failed:", err);
    return res.status(500).json({ error: "storage_failed" });
  }
});

function requireAdmin(req, res, next) {
  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(503).json({
      error: "admin_not_configured",
      message: "ADMIN_USER ve ADMIN_PASS ortam değişkenlerini ayarlayın.",
    });
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Rusty Feedback"');
    return res.status(401).json({ error: "unauthorized" });
  }

  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const sep = decoded.indexOf(":");
  const user = decoded.slice(0, sep);
  const pass = decoded.slice(sep + 1);

  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Rusty Feedback"');
    return res.status(401).json({ error: "unauthorized" });
  }

  return next();
}

app.get("/api/admin/stats", requireAdmin, (_req, res) => {
  res.json(feedbackStats());
});

app.get("/api/admin/feedback", requireAdmin, (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  res.json({ items: listFeedback({ limit, offset }) });
});

app.get("/admin", requireAdmin, (_req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

app.listen(PORT, () => {
  const rl = rateLimitConfig();
  console.log(`[feedback-api] http://localhost:${PORT}`);
  console.log(`[feedback-api] CORS: ${CORS_ORIGIN}`);
  console.log(
    `[feedback-api] rate limit: ${rl.max_requests} req / ${rl.window_ms}ms per IP`,
  );
  if (ADMIN_USER) {
    console.log("[feedback-api] admin dashboard: /admin");
  }
});
