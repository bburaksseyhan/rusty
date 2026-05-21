const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";

export function requireAdmin(req, res, next) {
  if (!ADMIN_USER || !ADMIN_PASS) {
    return res.status(503).json({
      error: "admin_not_configured",
      message: "Vercel'de ADMIN_USER ve ADMIN_PASS ortam değişkenlerini ayarlayın.",
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
