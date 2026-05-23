import app from "./app.js";
import { isAdminConfigured } from "./auth.js";
import { rateLimitConfig } from "./rateLimit.js";

app.use((_req, res) => {
  res.status(404).json({ error: "not_found" });
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  const rl = rateLimitConfig();
  console.log(`[feedback-api] http://localhost:${PORT}`);
  console.log(`[feedback-api] rate limit: ${rl.max_requests} req / ${rl.window_ms}ms per IP`);
  if (isAdminConfigured()) {
    console.log("[feedback-api] admin raporları: /admin (Basic Auth — ADMIN_USER / ADMIN_PASS)");
  } else {
    console.warn(
      "[feedback-api] UYARI: ADMIN_USER / ADMIN_PASS yok — /admin ve /api/admin/* kapalı (503).",
    );
  }
});
