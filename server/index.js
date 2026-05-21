import app from "./app.js";
import { rateLimitConfig } from "./rateLimit.js";

const PORT = Number(process.env.PORT) || 3001;
const ADMIN_USER = process.env.ADMIN_USER || "";

app.listen(PORT, () => {
  const rl = rateLimitConfig();
  console.log(`[feedback-api] http://localhost:${PORT}`);
  console.log(`[feedback-api] rate limit: ${rl.max_requests} req / ${rl.window_ms}ms per IP`);
  if (ADMIN_USER) {
    console.log("[feedback-api] admin dashboard: /admin");
  }
});
