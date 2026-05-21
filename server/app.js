import express from "express";
import cors from "cors";

import {
  health,
  feedback,
  adminStats,
  adminFeedback,
  adminPage,
} from "./handlers.js";

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "https://rusty-sigma.vercel.app",
];

const CORS_ORIGIN = process.env.CORS_ORIGIN
  || DEFAULT_ORIGINS.join(",");

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));
app.use(
  cors({
    origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/api/health", health);
app.post("/api/feedback", feedback);
app.get("/api/admin/stats", adminStats);
app.get("/api/admin/feedback", adminFeedback);
app.get("/admin", adminPage);
app.get("/api/admin", adminPage);

export default app;
