import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import app from "./server/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "dist");
const port = Number(process.env.PORT) || 3000;

// Vite build — oyun statik dosyaları
app.use(express.static(distDir, { index: false }));

// SPA fallback (API ve /admin hariç)
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/admin") {
    return next();
  }
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.use((req, res) => {
  if (req.path.startsWith("/api") || req.path === "/admin") {
    return res.status(404).json({ error: "not_found" });
  }
  res.status(404).send("Not found");
});

// Vercel, listen() ile Node sunucusunu yakalar
app.listen(port, () => {
  console.log(`[rusty] http://localhost:${port}`);
});
