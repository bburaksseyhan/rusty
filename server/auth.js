import { timingSafeEqual } from "node:crypto";

const ADMIN_USER = (process.env.ADMIN_USER || "").trim();
const ADMIN_PASS = (process.env.ADMIN_PASS || "").trim();

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function parseBasicAuth(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return null;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return {
      user: decoded.slice(0, sep),
      pass: decoded.slice(sep + 1),
    };
  } catch {
    return null;
  }
}

function sendChallenge(req, res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="Rusty Admin", charset="UTF-8"');
  const wantsHtml = String(req.headers.accept || "").includes("text/html");
  if (wantsHtml) {
    res.status(401).type("text/html; charset=utf-8").send(
      "<!DOCTYPE html><html lang=\"tr\"><body><p>Yetkisiz. Kullanıcı adı ve şifre gerekli.</p></body></html>",
    );
  } else {
    res.status(401).json({ error: "unauthorized" });
  }
}

/** Admin paneli yapılandırılmış mı? */
export function isAdminConfigured() {
  return Boolean(ADMIN_USER && ADMIN_PASS);
}

/**
 * Basic Auth zorunlu. Başarılıysa true; yanıt gönderildiyse false.
 */
export function enforceAdminAuth(req, res) {
  if (!isAdminConfigured()) {
    res.status(503).json({
      error: "admin_not_configured",
      message: "ADMIN_USER ve ADMIN_PASS ortam değişkenlerini ayarlayın.",
    });
    return false;
  }

  const creds = parseBasicAuth(req);
  if (
    !creds
    || !safeEqual(creds.user, ADMIN_USER)
    || !safeEqual(creds.pass, ADMIN_PASS)
  ) {
    sendChallenge(req, res);
    return false;
  }

  return true;
}

/** Express middleware uyumluluğu */
export function requireAdmin(req, res, next) {
  if (enforceAdminAuth(req, res)) next();
}
