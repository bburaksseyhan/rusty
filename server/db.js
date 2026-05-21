import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "data");

function defaultDbPath() {
  if (process.env.FEEDBACK_DB_PATH) return process.env.FEEDBACK_DB_PATH;
  // Vercel serverless: writable /tmp (warm instance persistence only)
  if (process.env.VERCEL) return "/tmp/feedback.db";
  return path.join(DATA_DIR, "feedback.db");
}

const DB_PATH = defaultDbPath();

let db;

export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      skipped       INTEGER NOT NULL DEFAULT 0,
      enjoyment     INTEGER,
      continue_ch2  TEXT,
      favourite     TEXT,
      feel          TEXT,
      comment       TEXT,
      client_ip     TEXT,
      user_agent    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_created_at
      ON feedback (created_at DESC);
  `);
}

/**
 * @param {object} row
 * @param {boolean} row.skipped
 * @param {number} [row.enjoyment]
 * @param {string} [row.continue_ch2]
 * @param {string} [row.favourite]
 * @param {string} [row.feel]
 * @param {string} [row.comment]
 * @param {string} [row.client_ip]
 * @param {string} [row.user_agent]
 */
export function insertFeedback(row) {
  const stmt = getDb().prepare(`
    INSERT INTO feedback (
      skipped, enjoyment, continue_ch2, favourite, feel, comment, client_ip, user_agent
    ) VALUES (
      @skipped, @enjoyment, @continue_ch2, @favourite, @feel, @comment, @client_ip, @user_agent
    )
  `);

  const result = stmt.run({
    skipped: row.skipped ? 1 : 0,
    enjoyment: row.enjoyment ?? null,
    continue_ch2: row.continue_ch2 ?? null,
    favourite: row.favourite ?? null,
    feel: row.feel ?? null,
    comment: row.comment ?? null,
    client_ip: row.client_ip ?? null,
    user_agent: row.user_agent ?? null,
  });

  return { id: Number(result.lastInsertRowid) };
}

export function listFeedback({ limit = 100, offset = 0 } = {}) {
  const rows = getDb()
    .prepare(
      `
      SELECT
        id, created_at, skipped, enjoyment, continue_ch2,
        favourite, feel, comment, client_ip
      FROM feedback
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    )
    .all(limit, offset);

  return rows.map((r) => ({
    ...r,
    skipped: Boolean(r.skipped),
  }));
}

export function feedbackStats() {
  const database = getDb();
  const totals = database
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN skipped = 1 THEN 1 ELSE 0 END) AS skipped_count,
        AVG(CASE WHEN skipped = 0 AND enjoyment > 0 THEN enjoyment END) AS avg_enjoyment
      FROM feedback
    `,
    )
    .get();

  const continueBreakdown = database
    .prepare(
      `
      SELECT continue_ch2 AS value, COUNT(*) AS count
      FROM feedback
      WHERE skipped = 0 AND continue_ch2 IS NOT NULL
      GROUP BY continue_ch2
    `,
    )
    .all();

  const favouriteBreakdown = database
    .prepare(
      `
      SELECT favourite AS value, COUNT(*) AS count
      FROM feedback
      WHERE skipped = 0 AND favourite IS NOT NULL
      GROUP BY favourite
      ORDER BY count DESC
    `,
    )
    .all();

  const feelBreakdown = database
    .prepare(
      `
      SELECT feel AS value, COUNT(*) AS count
      FROM feedback
      WHERE skipped = 0 AND feel IS NOT NULL
      GROUP BY feel
      ORDER BY count DESC
    `,
    )
    .all();

  return {
    total: totals.total,
    skipped_count: totals.skipped_count,
    submitted_count: totals.total - totals.skipped_count,
    avg_enjoyment: totals.avg_enjoyment
      ? Math.round(totals.avg_enjoyment * 10) / 10
      : null,
    continue: continueBreakdown,
    favourite: favouriteBreakdown,
    feel: feelBreakdown,
  };
}
